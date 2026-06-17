"use strict";

const mongoose = require("mongoose");

const exampleSchema = new mongoose.Schema(
  {
    korean: { type: String, required: true }, // e.g. "서울에"
    pronounced: { type: String, default: "" }, // e.g. "[서우레]"
    romanization: { type: String, default: "" },
  },
  { _id: false }
);

const exerciseSchema = new mongoose.Schema(
  {
    prompt: { type: String, required: true }, // word to transcribe, e.g. "일을"
    answer: { type: String, required: true }, // expected pronunciation, e.g. "이를"
    gloss: { type: String, default: "" }, // optional meaning, e.g. "(nation)"
  },
  { _id: false }
);

/**
 * One pronunciation point (slot A or B of a Book 1 chapter). 80 total.
 */
const pronunciationPointSchema = new mongoose.Schema(
  {
    pronId: { type: String, required: true, unique: true, index: true }, // e.g. "b1-ch07-A"
    lessonId: { type: String, required: true, index: true },
    book: { type: Number, required: true, default: 1 },
    chapter: { type: Number, required: true },
    slot: { type: String, required: true, enum: ["A", "B"] },
    order: { type: Number, required: true }, // 1..80 global

    rule: { type: String, required: true }, // the pronunciation rule text
    examples: { type: [exampleSchema], default: [] },
    exercises: { type: [exerciseSchema], default: [] },
  },
  { timestamps: true }
);

pronunciationPointSchema.index({ book: 1, order: 1 });

module.exports = mongoose.model("PronunciationPoint", pronunciationPointSchema);
