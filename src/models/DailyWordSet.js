"use strict";

const mongoose = require("mongoose");
const { Schema } = mongoose;

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
    deviceId: { type: String, required: true, index: true },
    date:     { type: String, required: true }, // "YYYY-MM-DD"
    words:    [wordSchema],
  },
  { timestamps: true }
);

dailyWordSetSchema.index({ deviceId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailyWordSet", dailyWordSetSchema);
