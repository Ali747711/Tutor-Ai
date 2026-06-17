"use strict";

const mongoose = require("mongoose");

const progressSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true, maxlength: 64 },
    learnedIds: { type: [String], default: [] },
    mockCount: { type: Number, default: 0, min: 0 },
    scoreSum: { type: Number, default: 0, min: 0 },
    scoreCount: { type: Number, default: 0, min: 0 },

    // Book-curriculum completion (added with the Korean-learning platform)
    completedLessonIds: { type: [String], default: [] },
    completedGrammarIds: { type: [String], default: [] },
    learnedVocabIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Progress", progressSchema);
