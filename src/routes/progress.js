"use strict";

const express = require("express");
const { connectDb } = require("../db");
const Progress = require("../models/progress");

const router = express.Router();

function isValidDeviceId(deviceId) {
  return Boolean(deviceId) && deviceId.length <= 64;
}

/**
 * GET /api/progress/:deviceId
 * -> { learnedIds, mockCount, scoreSum, scoreCount }
 */
router.get("/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
  if (!isValidDeviceId(deviceId)) {
    return res.status(400).json({ error: "Invalid deviceId." });
  }
  try {
    await connectDb();
    const doc = await Progress.findOne({ deviceId });
    if (!doc) {
      return res.json({
        learnedIds: [], mockCount: 0, scoreSum: 0, scoreCount: 0,
        completedLessonIds: [], completedGrammarIds: [], learnedVocabIds: [],
      });
    }
    res.json({
      learnedIds: doc.learnedIds,
      mockCount: doc.mockCount,
      scoreSum: doc.scoreSum,
      scoreCount: doc.scoreCount,
      completedLessonIds: doc.completedLessonIds || [],
      completedGrammarIds: doc.completedGrammarIds || [],
      learnedVocabIds: doc.learnedVocabIds || [],
    });
  } catch (err) {
    console.error("[GET /api/progress]", err?.message || err);
    res.status(502).json({ error: "Failed to load progress." });
  }
});

/**
 * PUT /api/progress/:deviceId
 * body: { learnedIds?, mockCount?, scoreSum?, scoreCount? }
 * -> { ok: true }
 */
router.put("/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
  if (!isValidDeviceId(deviceId)) {
    return res.status(400).json({ error: "Invalid deviceId." });
  }
  try {
    await connectDb();
    const {
      learnedIds, mockCount, scoreSum, scoreCount,
      completedLessonIds, completedGrammarIds, learnedVocabIds,
    } = req.body ?? {};
    const update = {};
    if (Array.isArray(learnedIds)) update.learnedIds = learnedIds.slice(0, 200);
    if (typeof mockCount === "number" && mockCount >= 0) update.mockCount = mockCount;
    if (typeof scoreSum === "number" && scoreSum >= 0) update.scoreSum = scoreSum;
    if (typeof scoreCount === "number" && scoreCount >= 0) update.scoreCount = scoreCount;
    if (Array.isArray(completedLessonIds)) update.completedLessonIds = completedLessonIds.slice(0, 200);
    if (Array.isArray(completedGrammarIds)) update.completedGrammarIds = completedGrammarIds.slice(0, 200);
    if (Array.isArray(learnedVocabIds)) update.learnedVocabIds = learnedVocabIds.slice(0, 2000);

    await Progress.findOneAndUpdate({ deviceId }, { $set: update }, { upsert: true });
    res.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/progress]", err?.message || err);
    res.status(502).json({ error: "Failed to save progress." });
  }
});

module.exports = router;
