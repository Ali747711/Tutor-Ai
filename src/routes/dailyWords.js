"use strict";

const express = require("express");
const { randomUUID } = require("crypto");
const Anthropic = require("@anthropic-ai/sdk");
const { connectDb } = require("../db");
const DailyWordSet = require("../models/DailyWordSet");

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

  if (!isNonEmptyString(deviceId)) {
    return res.status(400).json({ error: "'deviceId' is required." });
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
      extracted = JSON.parse(msg.content[0].text.trim());
    } else {
      const mediaTypeMatch = image.match(/^data:(image\/[a-z]+);base64,/);
      const mediaType = mediaTypeMatch ? mediaTypeMatch[1] : "image/jpeg";
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
      extracted = JSON.parse(msg.content[0].text.trim());
    }

    if (!Array.isArray(extracted) || extracted.length === 0) {
      return res.status(422).json({ error: "No Korean words detected." });
    }

    const items = extracted.map((item) => ({
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
  if (!isNonEmptyString(deviceId)) {
    return res.status(400).json({ error: "'deviceId' query param is required." });
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
  if (!isNonEmptyString(deviceId)) {
    return res.status(400).json({ error: "'deviceId' query param is required." });
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
  if (!isNonEmptyString(deviceId)) {
    return res.status(400).json({ error: "'deviceId' is required." });
  }
  if (!Array.isArray(words)) {
    return res.status(400).json({ error: "'words' must be an array." });
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
