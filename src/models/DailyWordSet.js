"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * A dated set of Korean vocabulary words captured by a device on a specific day.
 * One document per (deviceId, date) pair — enforced by the compound unique index.
 * words[].english and romanization default to "" because AI fills them in after creation.
 * words[].id uses "id" intentionally (not "wordId") to match the FlashcardItem shape
 * used by the frontend; _id:false on the subdoc prevents any Mongoose virtual conflict.
 */
const wordSchema = new Schema(
  {
    id:           { type: String, required: true },
    korean:       { type: String, required: true },
    romanization: { type: String, default: "" },
    english:      { type: String, default: "" },
    source:       { type: String, enum: ["typed", "screenshot"], default: "typed" },
  },
  { _id: false }
);

const dailyWordSetSchema = new Schema(
  {
    deviceId: { type: String, required: true, maxlength: 64 },
    date:     { type: String, required: true }, // "YYYY-MM-DD"
    words: {
      type: [wordSchema],
      validate: [(arr) => arr.length <= 200, "words array exceeds 200-word limit"],
    },
  },
  { timestamps: true }
);

dailyWordSetSchema.index({ deviceId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailyWordSet", dailyWordSetSchema);
