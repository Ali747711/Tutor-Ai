"use strict";

const mongoose = require("mongoose");

/**
 * One sample expression for a Book 2 daily keyword (20 per keyword).
 */
const expressionSchema = new mongoose.Schema(
  {
    expressionId: { type: String, required: true, unique: true, index: true }, // e.g. "b2-w03-d05-e12"
    keywordId: { type: String, required: true, index: true },
    book: { type: Number, required: true, default: 2 },
    order: { type: Number, required: true }, // 1..20 within the keyword

    korean: { type: String, required: true },
    english: { type: String, default: "" },
    notes: { type: String, default: "" }, // the "Notes" breakdown text
  },
  { timestamps: true }
);

expressionSchema.index({ keywordId: 1, order: 1 });

module.exports = mongoose.model("Expression", expressionSchema);
