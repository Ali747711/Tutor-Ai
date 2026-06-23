"use strict";

const express = require("express");
const { randomUUID } = require("crypto");
const Anthropic = require("@anthropic-ai/sdk");
const { connectDb } = require("../db");
const DailyWordSet = require("../models/DailyWordSet");

function parseJsonFromLlm(text) {
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  return JSON.parse(stripped)
}

const router = express.Router();

const EXTRACT_MODEL = "claude-haiku-4-5-20251001";
const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

function isValidDate(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * POST /api/daily-words/extract
 * body: { words?: string[], image?: string (base64), deviceId: string }
 * -> DailyWord[]
 */
router.post("/extract", async (req, res) => {
  const { words, image, deviceId } = req.body ?? {};

  if (!isNonEmptyString(deviceId) || deviceId.length > 64) {
    return res.status(400).json({ error: "'deviceId' must be a non-empty string (max 64 chars)." });
  }

  const hasWords = Array.isArray(words) && words.length > 0;
  const hasImage = isNonEmptyString(image);

  if (!hasWords && !hasImage) {
    return res.status(400).json({ error: "Provide 'words' array or 'image' base64 string." });
  }

  try {
    let extracted;

    if (hasWords) {
      const wordList = words.map((w) => String(w).trim()).filter(Boolean).join("\n");
      const msg = await anthropic.messages.create({
        model: EXTRACT_MODEL,
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: `You are a Korean language assistant. For each Korean word below, provide the romanization and an English meaning.

Return ONLY a valid JSON array. No markdown, no explanation, no code fences.
Format: [{"korean":"사랑","romanization":"sarang","english":"love"}]

Korean words:
${wordList}`,
          },
        ],
      });
      try {
        extracted = parseJsonFromLlm(msg.content[0].text)
      } catch {
        return res.status(422).json({ error: "AI returned unexpected response. Please retry." })
      }
    } else {
      const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])
      const mediaTypeMatch = image.match(/^data:(image\/[a-z]+);base64,/)
      const detectedType = mediaTypeMatch?.[1]
      if (!ALLOWED_MEDIA_TYPES.has(detectedType)) {
        return res.status(400).json({ error: "Image must be JPEG, PNG, GIF, or WebP." })
      }
      const mediaType = detectedType
      const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "");

      const msg = await anthropic.messages.create({
        model: EXTRACT_MODEL,
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64Data },
              },
              {
                type: "text",
                text: `Extract all Korean words or phrases visible in this image. Provide romanization and English meaning for each.

Return ONLY a valid JSON array. No markdown, no explanation, no code fences.
Format: [{"korean":"사랑","romanization":"sarang","english":"love"}]`,
              },
            ],
          },
        ],
      });
      try {
        extracted = parseJsonFromLlm(msg.content[0].text)
      } catch {
        return res.status(422).json({ error: "AI returned unexpected response. Please retry." })
      }
    }

    if (!Array.isArray(extracted) || extracted.length === 0) {
      return res.status(422).json({ error: "No Korean words detected." });
    }

    const items = extracted
      .filter((item) => String(item.korean ?? "").trim().length > 0)
      .map((item) => ({
        id:           randomUUID(),
        korean:       String(item.korean ?? "").trim(),
        romanization: String(item.romanization ?? "").trim(),
        english:      String(item.english ?? "").trim(),
        source:       hasImage ? "screenshot" : "typed",
      }));

    res.json(items);
  } catch (err) {
    console.error("[POST /api/daily-words/extract]", err?.message || err);
    res.status(502).json({ error: "AI extraction failed. Please try again." });
  }
});

/**
 * GET /api/daily-words
 * query: { deviceId }
 * -> string[] of dates with saved words, newest first
 */
router.get("/", async (req, res) => {
  const { deviceId } = req.query;
  if (!isNonEmptyString(deviceId) || deviceId.length > 64) {
    return res.status(400).json({ error: "'deviceId' must be a non-empty string (max 64 chars)." });
  }
  try {
    await connectDb();
    const sets = await DailyWordSet.find({ deviceId })
      .select("date")
      .sort({ date: -1 })
      .lean();
    res.json(sets.map((s) => s.date));
  } catch (err) {
    console.error("[GET /api/daily-words]", err?.message || err);
    res.status(502).json({ error: "Failed to load daily word dates." });
  }
});

/**
 * GET /api/daily-words/:date
 * query: { deviceId }
 * -> { date, words: DailyWord[] }
 */
router.get("/:date", async (req, res) => {
  const { date } = req.params;
  const { deviceId } = req.query;

  if (!isValidDate(date)) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
  }
  if (!isNonEmptyString(deviceId) || deviceId.length > 64) {
    return res.status(400).json({ error: "'deviceId' must be a non-empty string (max 64 chars)." });
  }

  try {
    await connectDb();
    const set = await DailyWordSet.findOne({ deviceId, date }).lean();
    if (!set) return res.json({ date, words: [] });
    res.json({ date: set.date, words: set.words });
  } catch (err) {
    console.error("[GET /api/daily-words/:date]", err?.message || err);
    res.status(502).json({ error: "Failed to load daily words." });
  }
});

/**
 * PUT /api/daily-words/:date
 * body: { deviceId, words: DailyWord[] }
 * -> { date, words }
 */
router.put("/:date", async (req, res) => {
  const { date } = req.params;
  const { deviceId, words } = req.body ?? {};

  if (!isValidDate(date)) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
  }
  if (!isNonEmptyString(deviceId) || deviceId.length > 64) {
    return res.status(400).json({ error: "'deviceId' must be a non-empty string (max 64 chars)." });
  }
  if (!Array.isArray(words)) {
    return res.status(400).json({ error: "'words' must be an array." });
  }
  if (words.length > 200) {
    return res.status(400).json({ error: "words array cannot exceed 200 items." });
  }

  const isValidWord = (w) =>
    w && isNonEmptyString(w.id) && isNonEmptyString(w.korean)
  if (!words.every(isValidWord)) {
    return res.status(400).json({ error: "Each word must have 'id' and 'korean'." })
  }

  try {
    await connectDb();
    const set = await DailyWordSet.findOneAndUpdate(
      { deviceId, date },
      { $set: { words } },
      { upsert: true, new: true }
    ).lean();
    res.json({ date: set.date, words: set.words });
  } catch (err) {
    console.error("[PUT /api/daily-words/:date]", err?.message || err);
    res.status(502).json({ error: "Failed to save daily words." });
  }
});

module.exports = router;
