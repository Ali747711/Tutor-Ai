"use strict";

const mongoose = require("mongoose");

/** A single spoken line in a dialogue. */
const dialogueLineSchema = new mongoose.Schema(
  {
    speaker: { type: String, default: "" },
    korean: { type: String, required: true },
    romanization: { type: String, default: "" },
    english: { type: String, default: "" },
  },
  { _id: false }
);

/**
 * One Book 1 chapter ("Real-Life Korean Conversations for Beginners").
 * Sub-content (vocab, grammar, pronunciation) lives in its own collections and
 * is referenced by natural-key id arrays so each piece is independently queryable.
 */
const lessonSchema = new mongoose.Schema(
  {
    lessonId: { type: String, required: true, unique: true, index: true }, // e.g. "b1-ch07"
    book: { type: Number, required: true, default: 1 },
    chapter: { type: Number, required: true }, // 1..40
    order: { type: Number, required: true }, // global ordering within the book
    category: { type: String, required: true }, // one of the 11 themes
    title: { type: String, required: true }, // English title, e.g. "Self-Introductions"
    titleKorean: { type: String, default: "" }, // e.g. "반갑습니다"

    shortDialogue: { type: [dialogueLineSchema], default: [] },
    longDialogue: { type: [dialogueLineSchema], default: [] },
    culturalTip: { type: String, default: "" },
    koreanReview: { type: String, default: "" },

    vocabIds: { type: [String], default: [] },
    extendedVocabIds: { type: [String], default: [] },
    grammarIds: { type: [String], default: [] }, // length 2 (A, B)
    pronunciationIds: { type: [String], default: [] }, // length 2 (A, B)
  },
  { timestamps: true }
);

lessonSchema.index({ book: 1, order: 1 });

module.exports = mongoose.model("Lesson", lessonSchema);
