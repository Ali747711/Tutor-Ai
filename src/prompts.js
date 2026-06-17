"use strict";

/**
 * Prompt builders for the KoreanPrep Pro interview & tutor flows.
 * Centralized so the Claude-facing copy lives in one auditable place.
 */

const INTERVIEW_CONTEXT = `The candidate is a full-stack software engineer (React / Node.js) interviewing in 3 days for a tech job in Seoul, South Korea. They are practicing business-level / interview-level Korean.`;

const INTERVIEW_TYPES = {
  hr: "HR / behavioral round — motivation, teamwork, strengths/weaknesses, culture fit, salary, career goals.",
  technical:
    "Technical round — frontend/backend concepts, system design, debugging, past projects, tech stack choices, code review practices.",
  mixed:
    "Mixed round — alternate naturally between behavioral/HR questions and technical engineering questions.",
};

/** Schema-constrained next-question generator. */
function buildQuestionSystemPrompt(interviewType) {
  const focus = INTERVIEW_TYPES[interviewType] || INTERVIEW_TYPES.mixed;
  return `You are a professional Korean-speaking hiring interviewer at a Seoul tech company.

${INTERVIEW_CONTEXT}

Round focus: ${focus}

Produce ONE realistic interview question in natural, polite business Korean (존댓말). It should be answerable in 2-4 sentences. Avoid repeating questions already asked. Keep it authentic to a real Korean interview.`;
}

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    korean: { type: "string", description: "The interview question in polite Korean." },
    romanization: { type: "string", description: "Revised-Romanization of the Korean question." },
    english: { type: "string", description: "Natural English translation." },
  },
  required: ["korean", "romanization", "english"],
  additionalProperties: false,
};

/** Schema-constrained answer evaluator. */
function buildEvaluateSystemPrompt() {
  return `You are a warm but rigorous Korean interview coach.

${INTERVIEW_CONTEXT}

You will receive the interview question (Korean) and the candidate's typed answer (which may mix Korean and English, or contain mistakes). Evaluate the answer as a real Korean interviewer + language coach would.

Be encouraging and practical — the interview is in 3 days. Praise what works, then give the single most useful improvement. Write the corrected version in natural, polite business Korean (존댓말) that the candidate could actually say. Keep "tip" to one concise, actionable sentence in English.

Scoring (1-5): 1 = barely communicates, 3 = understandable with notable errors, 5 = fluent and professional.`;
}

const EVALUATE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", description: "Overall score 1-5." },
    evaluation: { type: "string", description: "2-3 sentence assessment in English." },
    correctedKorean: { type: "string", description: "A polished, natural Korean version of the answer." },
    correctedRomanization: { type: "string", description: "Romanization of the corrected Korean." },
    tip: { type: "string", description: "One actionable improvement tip in English." },
    encouragement: { type: "string", description: "One short encouraging line." },
  },
  required: [
    "score",
    "evaluation",
    "correctedKorean",
    "correctedRomanization",
    "tip",
    "encouragement",
  ],
  additionalProperties: false,
};

const TUTOR_SYSTEM_PROMPT = `You are a Korean language tutor helping prepare for a tech job interview in Seoul. The user has 3 days. Be encouraging, concise, and practical.

Guidelines:
- When you give Korean examples, ALWAYS show them on their own line in the format: Korean (Romanization) — English.
- Prefer polite business Korean (존댓말) appropriate for interviews.
- Keep answers short and focused — the user is cramming. Lead with the most useful thing.
- When the user writes Korean with mistakes, gently correct it and show the natural version.
- Use plain text (no markdown headers); short paragraphs and the occasional bullet are fine.`;

// ---------------------------------------------------------------------------
// Book 1 chapter extraction (vision → structured JSON)
// ---------------------------------------------------------------------------

/**
 * System prompt for extracting one chapter of "Real-Life Korean Conversations
 * for Beginners" from its page images into structured JSON. The caller supplies
 * the chapter number, English title, and category as trusted hints.
 */
function buildExtractSystemPrompt({ chapter, title, category }) {
  return `You are a meticulous bilingual (Korean/English) data-entry specialist transcribing one chapter of the textbook "Real-Life Korean Conversations for Beginners" into structured JSON.

This is Chapter ${chapter}: "${title}" (category: ${category}).

You will receive the ${"~8"} page images of this chapter in order: a title page, a Short Dialogue, a Vocabulary list, a Long Dialogue, an extended Vocabulary list, a "Grammar Points & Exercises" page (exactly two points, A and B), a "Pronunciation Points & Exercises" page (exactly two points, A and B), and a Korean-only review page (which also contains the Answer Keys at the bottom).

Transcribe EXACTLY what is printed. Rules:
- Preserve Hangul precisely, including spacing and punctuation. Do not translate, paraphrase, or "correct" anything.
- Romanization appears in the book in [brackets] beneath words — copy it without the brackets. If a word has no printed romanization, use an empty string.
- shortDialogue/longDialogue: one entry per spoken line, in order, with the speaker's name (e.g. "성찬"), the Korean line, its romanization if present (the short/long dialogue lines usually have none — use ""), and the English translation printed beneath.
- coreVocab = the first Vocabulary list (after the short dialogue); extendedVocab = the second Vocabulary list (after the long dialogue). Each item: korean, romanization (from [brackets]), meaning (the English gloss, copied verbatim including any parenthetical).
- grammar: exactly two objects, slot "A" then "B". Capture the bold section title (e.g. "Simple Statement"), the pattern formula line (e.g. "저는 NOUN + -이에요/예요."), a short English meaning, the explanation/notes text, the worked examples (Ex), and the numbered fill-in exercises. For each exercise, "prompt" is the cue shown (e.g. "저는 회사원 + -이에요/예요"), "answer" is the correct completed form from the Answer Key on the review page, and "english" is the English gloss printed under the exercise if any.
- pronunciation: exactly two objects, slot "A" then "B". Capture the rule text, the worked examples (korean, the bracketed [pronunciation], romanization if shown), and the numbered exercises. For each exercise, "prompt" is the word to transcribe, "answer" is the correct pronunciation from the Answer Key, and "gloss" is any parenthetical meaning shown (e.g. "(nation)").
- culturalTip: the full text of the "Cultural Tip" box (omit any example table).
- koreanReview: the Korean-only text from the final review page (both short and long dialogues), newline-separated, no English.

Match the Answer Keys at the bottom of the review page to the correct exercises. If a value is genuinely absent, use an empty string rather than inventing content.`;
}

const example = {
  type: "object",
  properties: {
    korean: { type: "string" },
    romanization: { type: "string" },
    english: { type: "string" },
  },
  required: ["korean", "romanization", "english"],
  additionalProperties: false,
};

const dialogueLine = {
  type: "object",
  properties: {
    speaker: { type: "string" },
    korean: { type: "string" },
    romanization: { type: "string" },
    english: { type: "string" },
  },
  required: ["speaker", "korean", "romanization", "english"],
  additionalProperties: false,
};

const vocabItem = {
  type: "object",
  properties: {
    korean: { type: "string" },
    romanization: { type: "string" },
    meaning: { type: "string" },
  },
  required: ["korean", "romanization", "meaning"],
  additionalProperties: false,
};

const LESSON_EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    shortDialogue: { type: "array", items: dialogueLine },
    longDialogue: { type: "array", items: dialogueLine },
    culturalTip: { type: "string" },
    koreanReview: { type: "string" },
    coreVocab: { type: "array", items: vocabItem },
    extendedVocab: { type: "array", items: vocabItem },
    grammar: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: { type: "string", enum: ["A", "B"] },
          title: { type: "string" },
          pattern: { type: "string" },
          meaning: { type: "string" },
          explanation: { type: "string" },
          examples: { type: "array", items: example },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                answer: { type: "string" },
                english: { type: "string" },
              },
              required: ["prompt", "answer", "english"],
              additionalProperties: false,
            },
          },
        },
        required: ["slot", "title", "pattern", "meaning", "explanation", "examples", "exercises"],
        additionalProperties: false,
      },
    },
    pronunciation: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slot: { type: "string", enum: ["A", "B"] },
          rule: { type: "string" },
          examples: {
            type: "array",
            items: {
              type: "object",
              properties: {
                korean: { type: "string" },
                pronounced: { type: "string" },
                romanization: { type: "string" },
              },
              required: ["korean", "pronounced", "romanization"],
              additionalProperties: false,
            },
          },
          exercises: {
            type: "array",
            items: {
              type: "object",
              properties: {
                prompt: { type: "string" },
                answer: { type: "string" },
                gloss: { type: "string" },
              },
              required: ["prompt", "answer", "gloss"],
              additionalProperties: false,
            },
          },
        },
        required: ["slot", "rule", "examples", "exercises"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "shortDialogue",
    "longDialogue",
    "culturalTip",
    "koreanReview",
    "coreVocab",
    "extendedVocab",
    "grammar",
    "pronunciation",
  ],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Book 2 day extraction (vision → structured JSON)
// ---------------------------------------------------------------------------

function buildKeywordExtractSystemPrompt({ week, day, keyword, meaning }) {
  return `You are a meticulous bilingual (Korean/English) data-entry specialist transcribing one day of "My Weekly Korean Vocabulary Book 1" into structured JSON.

This is Week ${week}, Day ${day}: keyword "${keyword}" (${meaning}).

You will receive the page images for this day: a title page (the keyword + an illustration) followed by one or two pages listing exactly 20 sample expressions. Each expression has the Korean phrase (bold, left), its English translation directly beneath it, and a "Notes" breakdown in the right-hand column.

Transcribe EXACTLY what is printed. Rules:
- Confirm the keyword's romanization from the [brackets] on the title page; if absent, use an empty string.
- expressions: exactly 20 objects in printed order. Each: "korean" = the bold Korean phrase, "english" = the English translation printed beneath it, "notes" = the full right-column Notes text for that expression joined with newlines (or "" if that expression has no notes).
- Preserve Hangul precisely. Do not translate, paraphrase, or correct anything.`;
}

const KEYWORD_EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    romanization: { type: "string" },
    expressions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          korean: { type: "string" },
          english: { type: "string" },
          notes: { type: "string" },
        },
        required: ["korean", "english", "notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["romanization", "expressions"],
  additionalProperties: false,
};

module.exports = {
  buildQuestionSystemPrompt,
  QUESTION_SCHEMA,
  buildEvaluateSystemPrompt,
  EVALUATE_SCHEMA,
  TUTOR_SYSTEM_PROMPT,
  buildExtractSystemPrompt,
  LESSON_EXTRACT_SCHEMA,
  buildKeywordExtractSystemPrompt,
  KEYWORD_EXTRACT_SCHEMA,
};
