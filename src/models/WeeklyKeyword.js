"use strict";

const mongoose = require("mongoose");

/**
 * One daily keyword from "My Weekly Korean Vocabulary Book 1".
 * 84 total (12 weeks × 7 days), globally ordered 1..84.
 */
const weeklyKeywordSchema = new mongoose.Schema(
  {
    keywordId: { type: String, required: true, unique: true, index: true }, // e.g. "b2-w03-d05"
    book: { type: Number, required: true, default: 2 },
    week: { type: Number, required: true }, // 1..12
    day: { type: Number, required: true }, // 1..7
    order: { type: Number, required: true }, // 1..84 global

    keyword: { type: String, required: true },
    romanization: { type: String, default: "" },
    meaning: { type: String, required: true },
    expressionIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

weeklyKeywordSchema.index({ book: 1, order: 1 });

module.exports = mongoose.model("WeeklyKeyword", weeklyKeywordSchema);
