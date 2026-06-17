"use strict";

const mongoose = require("mongoose");

/**
 * A single vocabulary item from a Book 1 chapter (core or extended list).
 */
const vocabSchema = new mongoose.Schema(
  {
    vocabId: { type: String, required: true, unique: true, index: true }, // e.g. "b1-ch07-v03"
    lessonId: { type: String, required: true, index: true },
    book: { type: Number, required: true, default: 1 },
    chapter: { type: Number, required: true },
    scope: { type: String, required: true, enum: ["core", "extended"] },
    order: { type: Number, required: true }, // position within its list

    korean: { type: String, required: true },
    romanization: { type: String, default: "" },
    meaning: { type: String, required: true }, // English gloss
  },
  { timestamps: true }
);

vocabSchema.index({ lessonId: 1, scope: 1, order: 1 });

module.exports = mongoose.model("Vocab", vocabSchema);
