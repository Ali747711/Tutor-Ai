"use strict";

const express = require("express");
const { connectDb } = require("../db");
const Lesson = require("../models/Lesson");
const GrammarPoint = require("../models/GrammarPoint");
const PronunciationPoint = require("../models/PronunciationPoint");
const Vocab = require("../models/Vocab");
const WeeklyKeyword = require("../models/WeeklyKeyword");
const Expression = require("../models/Expression");

const router = express.Router();

/**
 * GET /api/curriculum
 * Ordered list of Book 1 lessons grouped-ready for the Lessons view.
 * -> [{ lessonId, chapter, order, category, title, titleKorean, counts: {...} }]
 */
router.get("/curriculum", async (_req, res) => {
  try {
    await connectDb();
    const lessons = await Lesson.find({ book: 1 })
      .sort({ order: 1 })
      .select(
        "lessonId chapter order category title titleKorean vocabIds extendedVocabIds grammarIds pronunciationIds"
      )
      .lean();

    const list = lessons.map((l) => ({
      lessonId: l.lessonId,
      chapter: l.chapter,
      order: l.order,
      category: l.category,
      title: l.title,
      titleKorean: l.titleKorean || "",
      counts: {
        vocab: (l.vocabIds?.length || 0) + (l.extendedVocabIds?.length || 0),
        grammar: l.grammarIds?.length || 0,
        pronunciation: l.pronunciationIds?.length || 0,
      },
    }));
    res.json(list);
  } catch (err) {
    console.error("[GET /api/curriculum]", err?.message || err);
    res.status(502).json({ error: "Failed to load curriculum." });
  }
});

/**
 * GET /api/lessons/:lessonId
 * Full lesson detail with joined vocab, grammar, and pronunciation.
 */
router.get("/lessons/:lessonId", async (req, res) => {
  const { lessonId } = req.params;
  try {
    await connectDb();
    const lesson = await Lesson.findOne({ lessonId }).lean();
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found." });
    }

    const [vocab, grammar, pronunciation] = await Promise.all([
      Vocab.find({ lessonId }).sort({ scope: 1, order: 1 }).lean(),
      GrammarPoint.find({ lessonId }).sort({ slot: 1 }).lean(),
      PronunciationPoint.find({ lessonId }).sort({ slot: 1 }).lean(),
    ]);

    res.json({
      lessonId: lesson.lessonId,
      chapter: lesson.chapter,
      order: lesson.order,
      category: lesson.category,
      title: lesson.title,
      titleKorean: lesson.titleKorean || "",
      shortDialogue: lesson.shortDialogue || [],
      longDialogue: lesson.longDialogue || [],
      culturalTip: lesson.culturalTip || "",
      koreanReview: lesson.koreanReview || "",
      vocab: vocab.filter((v) => v.scope === "core"),
      extendedVocab: vocab.filter((v) => v.scope === "extended"),
      grammar,
      pronunciation,
    });
  } catch (err) {
    console.error("[GET /api/lessons/:lessonId]", err?.message || err);
    res.status(502).json({ error: "Failed to load lesson." });
  }
});

/**
 * GET /api/grammar?chapter=7
 * All 80 grammar points in book order (optionally filtered by chapter).
 */
router.get("/grammar", async (req, res) => {
  try {
    await connectDb();
    const filter = { book: 1 };
    const chapter = Number(req.query.chapter);
    if (Number.isInteger(chapter) && chapter > 0) filter.chapter = chapter;

    const grammar = await GrammarPoint.find(filter).sort({ order: 1 }).lean();
    res.json(grammar);
  } catch (err) {
    console.error("[GET /api/grammar]", err?.message || err);
    res.status(502).json({ error: "Failed to load grammar." });
  }
});

/**
 * GET /api/grammar/:grammarId
 */
router.get("/grammar/:grammarId", async (req, res) => {
  try {
    await connectDb();
    const grammar = await GrammarPoint.findOne({ grammarId: req.params.grammarId }).lean();
    if (!grammar) return res.status(404).json({ error: "Grammar point not found." });
    res.json(grammar);
  } catch (err) {
    console.error("[GET /api/grammar/:grammarId]", err?.message || err);
    res.status(502).json({ error: "Failed to load grammar point." });
  }
});

// ---------------------------------------------------------------------------
// Book 2 — weekly vocabulary
// ---------------------------------------------------------------------------

/**
 * GET /api/vocabulary/weeks
 * -> [{ week, days: [{ keywordId, day, keyword, romanization, meaning }] }]
 */
router.get("/vocabulary/weeks", async (_req, res) => {
  try {
    await connectDb();
    const keywords = await WeeklyKeyword.find({ book: 2 })
      .sort({ order: 1 })
      .select("keywordId week day keyword romanization meaning")
      .lean();
    const byWeek = new Map();
    for (const k of keywords) {
      if (!byWeek.has(k.week)) byWeek.set(k.week, []);
      byWeek.get(k.week).push({
        keywordId: k.keywordId, day: k.day, keyword: k.keyword,
        romanization: k.romanization, meaning: k.meaning,
      });
    }
    res.json([...byWeek.entries()].map(([week, days]) => ({ week, days })));
  } catch (err) {
    console.error("[GET /api/vocabulary/weeks]", err?.message || err);
    res.status(502).json({ error: "Failed to load vocabulary weeks." });
  }
});

/**
 * GET /api/vocabulary?week=3
 * -> [{ keywordId, week, day, order, keyword, romanization, meaning, expressions: [...] }]
 */
router.get("/vocabulary", async (req, res) => {
  try {
    await connectDb();
    const week = Number(req.query.week);
    const filter = { book: 2 };
    if (Number.isInteger(week) && week > 0) filter.week = week;

    const keywords = await WeeklyKeyword.find(filter).sort({ order: 1 }).lean();
    const ids = keywords.map((k) => k.keywordId);
    const expressions = await Expression.find({ keywordId: { $in: ids } })
      .sort({ order: 1 })
      .lean();
    const byKeyword = new Map();
    for (const e of expressions) {
      if (!byKeyword.has(e.keywordId)) byKeyword.set(e.keywordId, []);
      byKeyword.get(e.keywordId).push(e);
    }
    res.json(
      keywords.map((k) => ({
        keywordId: k.keywordId, week: k.week, day: k.day, order: k.order,
        keyword: k.keyword, romanization: k.romanization, meaning: k.meaning,
        expressions: byKeyword.get(k.keywordId) || [],
      }))
    );
  } catch (err) {
    console.error("[GET /api/vocabulary]", err?.message || err);
    res.status(502).json({ error: "Failed to load vocabulary." });
  }
});

/**
 * GET /api/flashcards/deck?source=week&week=3
 * GET /api/flashcards/deck?source=lesson&lessonId=b1-ch07
 * -> [{ id, korean, romanization, english }]
 */
router.get("/flashcards/deck", async (req, res) => {
  const { source, lessonId } = req.query;
  try {
    await connectDb();
    if (source === "lesson" && lessonId) {
      const vocab = await Vocab.find({ lessonId }).sort({ scope: 1, order: 1 }).lean();
      return res.json(
        vocab.map((v) => ({
          id: v.vocabId, korean: v.korean, romanization: v.romanization, english: v.meaning,
        }))
      );
    }
    if (source === "week") {
      const week = Number(req.query.week);
      const filter = { book: 2 };
      if (Number.isInteger(week) && week > 0) filter.week = week;
      const keywords = await WeeklyKeyword.find(filter).sort({ order: 1 }).lean();
      return res.json(
        keywords.map((k) => ({
          id: k.keywordId, korean: k.keyword, romanization: k.romanization, english: k.meaning,
        }))
      );
    }
    res.status(400).json({ error: "source must be 'lesson' (+lessonId) or 'week' (+week)." });
  } catch (err) {
    console.error("[GET /api/flashcards/deck]", err?.message || err);
    res.status(502).json({ error: "Failed to load deck." });
  }
});

/**
 * POST /api/exercises/check
 * body: { grammarId?, pronId?, exerciseIndex, userAnswer }
 * -> { correct, expected }
 *
 * Exact/normalized string match against the stored answer key. No LLM call —
 * the answers are deterministic fill-ins, so a normalized comparison is enough.
 */
function normalize(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[.?!]+$/u, "");
}

router.post("/exercises/check", async (req, res) => {
  const { grammarId, pronId, exerciseIndex, userAnswer } = req.body ?? {};
  const index = Number(exerciseIndex);
  if (!Number.isInteger(index) || index < 0) {
    return res.status(400).json({ error: "exerciseIndex must be a non-negative integer." });
  }
  if (typeof userAnswer !== "string") {
    return res.status(400).json({ error: "userAnswer is required." });
  }
  try {
    await connectDb();
    let exercises;
    if (grammarId) {
      const g = await GrammarPoint.findOne({ grammarId }).select("exercises").lean();
      exercises = g?.exercises;
    } else if (pronId) {
      const p = await PronunciationPoint.findOne({ pronId }).select("exercises").lean();
      exercises = p?.exercises;
    } else {
      return res.status(400).json({ error: "grammarId or pronId is required." });
    }
    const exercise = exercises?.[index];
    if (!exercise) return res.status(404).json({ error: "Exercise not found." });

    res.json({
      correct: normalize(userAnswer) === normalize(exercise.answer),
      expected: exercise.answer,
    });
  } catch (err) {
    console.error("[POST /api/exercises/check]", err?.message || err);
    res.status(502).json({ error: "Failed to check exercise." });
  }
});

module.exports = router;
