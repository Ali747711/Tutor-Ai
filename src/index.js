"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");

const {
  buildQuestionSystemPrompt,
  QUESTION_SCHEMA,
  buildEvaluateSystemPrompt,
  EVALUATE_SCHEMA,
  TUTOR_SYSTEM_PROMPT,
} = require("./prompts");
const progressRouter = require("./routes/progress");
const curriculumRouter = require("./routes/curriculum");

const PORT = process.env.PORT || 3001;
const MODEL = "claude-opus-4-8";

// ---- Fail fast on missing secrets (security.md: validate secrets at startup) ----
if (!process.env.CLAUDE_API_KEY) {
  console.error("FATAL: CLAUDE_API_KEY is not set in backend/.env");
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error("FATAL: OPENAI_API_KEY is not set in backend/.env");
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pull the first JSON object out of a structured-output text block. */
function parseStructured(message) {
  const block = message.content.find((b) => b.type === "text");
  if (!block) throw new Error("No text block in model response");
  return JSON.parse(block.text);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL });
});

/**
 * POST /api/interview/question
 * body: { interviewType: "hr" | "technical" | "mixed", askedQuestions?: string[] }
 * -> { korean, romanization, english }
 */
app.post("/api/interview/question", async (req, res) => {
  try {
    const interviewType = req.body?.interviewType || "mixed";
    const asked = Array.isArray(req.body?.askedQuestions)
      ? req.body.askedQuestions.slice(0, 20)
      : [];

    const avoid =
      asked.length > 0
        ? `\n\nDo NOT repeat any of these already-asked questions:\n- ${asked.join("\n- ")}`
        : "";

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: buildQuestionSystemPrompt(interviewType),
      output_config: { format: { type: "json_schema", schema: QUESTION_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Generate the next interview question for a ${interviewType} round.${avoid}`,
        },
      ],
    });

    res.json(parseStructured(message));
  } catch (err) {
    console.error("[/api/interview/question]", err?.message || err);
    res.status(502).json({ error: "Failed to generate interview question." });
  }
});

/**
 * POST /api/interview/evaluate
 * body: { question: string, answer: string }
 * -> { score, evaluation, correctedKorean, correctedRomanization, tip, encouragement }
 */
app.post("/api/interview/evaluate", async (req, res) => {
  try {
    const question = req.body?.question;
    const answer = req.body?.answer;

    if (!isNonEmptyString(question) || !isNonEmptyString(answer)) {
      return res
        .status(400)
        .json({ error: "Both 'question' and 'answer' are required." });
    }

    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: buildEvaluateSystemPrompt(),
      output_config: { format: { type: "json_schema", schema: EVALUATE_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Interview question (Korean):\n${question}\n\nCandidate's answer:\n${answer}`,
        },
      ],
    });

    const parsed = parseStructured(message);
    // Clamp score defensively.
    parsed.score = Math.max(1, Math.min(5, Number(parsed.score) || 3));
    res.json(parsed);
  } catch (err) {
    console.error("[/api/interview/evaluate]", err?.message || err);
    res.status(502).json({ error: "Failed to evaluate answer." });
  }
});

/**
 * POST /api/chat/message
 * body: { messages: [{ role: "user"|"assistant", content: string }] }
 * -> Server-Sent Events stream of { type: "delta", text } then { type: "done" }
 */
app.post("/api/chat/message", async (req, res) => {
  const history = Array.isArray(req.body?.messages) ? req.body.messages : null;

  if (!history || history.length === 0) {
    return res.status(400).json({ error: "'messages' array is required." });
  }

  // Normalize + guard the conversation shape.
  const messages = history
    .filter((m) => isNonEmptyString(m?.content))
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content),
    }));

  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return res
      .status(400)
      .json({ error: "Conversation must end with a user message." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 1500,
      system: TUTOR_SYSTEM_PROMPT,
      messages,
    });

    stream.on("text", (delta) => send({ type: "delta", text: delta }));

    await stream.finalMessage();
    send({ type: "done" });
  } catch (err) {
    console.error("[/api/chat/message]", err?.message || err);
    send({ type: "error", error: "The tutor is unavailable right now." });
  } finally {
    res.end();
  }
});

/**
 * POST /api/tts
 * body: { text: string }
 * -> audio/mpeg buffer (OpenAI tts-1, voice "nova")
 */
app.post("/api/tts", async (req, res) => {
  try {
    const text = req.body?.text;
    if (!isNonEmptyString(text)) {
      return res.status(400).json({ error: "'text' is required." });
    }
    if (text.length > 500) {
      return res.status(400).json({ error: "'text' exceeds 500 characters." });
    }

    const speech = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: text,
      response_format: "mp3",
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error("[/api/tts]", err?.message || err);
    res.status(502).json({ error: "Failed to synthesize speech." });
  }
});

// ---------------------------------------------------------------------------
// Mounted routers (curriculum content + progress)
// ---------------------------------------------------------------------------
app.use("/api", curriculumRouter);
app.use("/api/progress", progressRouter);

app.listen(PORT, () => {
  console.log(`KoreanPrep Pro API listening on http://localhost:${PORT}`);
});
