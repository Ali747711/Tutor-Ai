"use strict";

const mongoose = require("mongoose");

const exampleSchema = new mongoose.Schema(
  {
    korean: { type: String, required: true },
    romanization: { type: String, default: "" },
    english: { type: String, default: "" },
  },
  { _id: false }
);

const exerciseSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true }, // the fill-in cue, e.g. "저는 회사원 + -이에요/예요"
    answer: { type: String, required: true }, // answer-key value
    english: { type: String, default: "" }, // optional gloss of the target sentence
  },
  { _id: false }
);

/**
 * One grammar point (slot A or B of a Book 1 chapter).
 * 80 total, globally ordered 1..80 to satisfy "all grammar in book order".
 */
const grammarPointSchema = new mongoose.Schema(
  {
    grammarId: { type: String, required: true, unique: true, index: true }, // e.g. "b1-ch07-A"
    lessonId: { type: String, required: true, index: true },
    book: { type: Number, required: true, default: 1 },
    chapter: { type: Number, required: true },
    slot: { type: String, required: true, enum: ["A", "B"] },
    order: { type: Number, required: true }, // 1..80 global

    title: { type: String, default: "" }, // e.g. "Simple Statement"
    pattern: { type: String, required: true }, // e.g. "저는 NOUN + -이에요/예요."
    meaning: { type: String, default: "" }, // short English meaning of the pattern
    explanation: { type: String, default: "" }, // the rule / notes text
    examples: { type: [exampleSchema], default: [] },
    exercises: { type: [exerciseSchema], default: [] },
  },
  { timestamps: true }
);

grammarPointSchema.index({ book: 1, order: 1 });

module.exports = mongoose.model("GrammarPoint", grammarPointSchema);
