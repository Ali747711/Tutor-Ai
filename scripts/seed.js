"use strict";

/**
 * Seeds MongoDB from the committed JSON in backend/seed/book1/.
 *
 * Idempotent: every document is upserted by its natural key (lessonId,
 * grammarId, pronId, vocabId), so re-running produces no duplicates.
 * Global `order` fields (grammar 1..80, pronunciation 1..80) are derived from
 * chapter + slot so the curriculum stays in book order.
 *
 * Usage: node scripts/seed.js
 */

const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const { connectDb } = require("../src/db");
const Lesson = require("../src/models/Lesson");
const GrammarPoint = require("../src/models/GrammarPoint");
const PronunciationPoint = require("../src/models/PronunciationPoint");
const Vocab = require("../src/models/Vocab");
const WeeklyKeyword = require("../src/models/WeeklyKeyword");
const Expression = require("../src/models/Expression");

const BOOK1_SEED_DIR = path.join(__dirname, "..", "seed", "book1");
const BOOK2_SEED_DIR = path.join(__dirname, "..", "seed", "book2");

const pad2 = (n) => String(n).padStart(2, "0");

/** Build all upsert documents for one chapter's JSON record. */
function buildDocs(record) {
  const { chapter } = record;
  const lessonId = `b1-ch${pad2(chapter)}`;

  const vocabIds = [];
  const extendedVocabIds = [];
  const vocabDocs = [];

  record.coreVocab.forEach((v, i) => {
    const vocabId = `${lessonId}-cv${pad2(i + 1)}`;
    vocabIds.push(vocabId);
    vocabDocs.push({
      vocabId, lessonId, book: 1, chapter, scope: "core", order: i + 1,
      korean: v.korean, romanization: v.romanization || "", meaning: v.meaning,
    });
  });
  record.extendedVocab.forEach((v, i) => {
    const vocabId = `${lessonId}-ev${pad2(i + 1)}`;
    extendedVocabIds.push(vocabId);
    vocabDocs.push({
      vocabId, lessonId, book: 1, chapter, scope: "extended", order: i + 1,
      korean: v.korean, romanization: v.romanization || "", meaning: v.meaning,
    });
  });

  // Two grammar / pronunciation points per chapter → global order 1..80.
  const grammarDocs = [];
  const grammarIds = [];
  record.grammar.forEach((g) => {
    const slotIndex = g.slot === "B" ? 2 : 1;
    const order = (chapter - 1) * 2 + slotIndex;
    const grammarId = `${lessonId}-${g.slot}`;
    grammarIds.push(grammarId);
    grammarDocs.push({
      grammarId, lessonId, book: 1, chapter, slot: g.slot, order,
      title: g.title || "", pattern: g.pattern, meaning: g.meaning || "",
      explanation: g.explanation || "", examples: g.examples || [], exercises: g.exercises || [],
    });
  });

  const pronDocs = [];
  const pronunciationIds = [];
  record.pronunciation.forEach((p) => {
    const slotIndex = p.slot === "B" ? 2 : 1;
    const order = (chapter - 1) * 2 + slotIndex;
    const pronId = `${lessonId}-${p.slot}`;
    pronunciationIds.push(pronId);
    pronDocs.push({
      pronId, lessonId, book: 1, chapter, slot: p.slot, order,
      rule: p.rule, examples: p.examples || [], exercises: p.exercises || [],
    });
  });

  const lessonDoc = {
    lessonId, book: 1, chapter, order: chapter,
    category: record.category, title: record.title,
    titleKorean: record.titleKorean || "",
    shortDialogue: record.shortDialogue || [],
    longDialogue: record.longDialogue || [],
    culturalTip: record.culturalTip || "",
    koreanReview: record.koreanReview || "",
    vocabIds, extendedVocabIds, grammarIds, pronunciationIds,
  };

  return { lessonDoc, vocabDocs, grammarDocs, pronDocs };
}

async function upsert(Model, key, docs) {
  for (const doc of docs) {
    await Model.findOneAndUpdate({ [key]: doc[key] }, { $set: doc }, { upsert: true });
  }
}

/** Build WeeklyKeyword + Expression docs for one Book 2 day record. */
function buildBook2Docs(record) {
  const keywordId = `b2-w${pad2(record.week)}-d${record.day}`;
  const expressionIds = [];
  const expressionDocs = record.expressions.map((e, i) => {
    const expressionId = `${keywordId}-e${pad2(i + 1)}`;
    expressionIds.push(expressionId);
    return {
      expressionId, keywordId, book: 2, order: i + 1,
      korean: e.korean, english: e.english || "", notes: e.notes || "",
    };
  });
  const keywordDoc = {
    keywordId, book: 2, week: record.week, day: record.day, order: record.order,
    keyword: record.keyword, romanization: record.romanization || "",
    meaning: record.meaning, expressionIds,
  };
  return { keywordDoc, expressionDocs };
}

async function seedBook2() {
  if (!fs.existsSync(BOOK2_SEED_DIR)) return null;
  const files = fs.readdirSync(BOOK2_SEED_DIR).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) return null;

  let keywords = 0, expressions = 0;
  for (const file of files) {
    const record = JSON.parse(fs.readFileSync(path.join(BOOK2_SEED_DIR, file), "utf8"));
    const { keywordDoc, expressionDocs } = buildBook2Docs(record);
    await upsert(WeeklyKeyword, "keywordId", [keywordDoc]);
    await upsert(Expression, "expressionId", expressionDocs);
    keywords += 1;
    expressions += expressionDocs.length;
    console.log(`  seeded ${keywordDoc.keywordId} (${record.keyword})`);
  }
  return { keywords, expressions };
}

async function main() {
  if (!fs.existsSync(BOOK1_SEED_DIR)) {
    console.error(`FATAL: seed dir not found: ${BOOK1_SEED_DIR}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(BOOK1_SEED_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length === 0) {
    console.error("FATAL: no chapter JSON files to seed.");
    process.exit(1);
  }

  await connectDb();

  let lessons = 0, grammar = 0, pron = 0, vocab = 0;
  for (const file of files) {
    const record = JSON.parse(fs.readFileSync(path.join(BOOK1_SEED_DIR, file), "utf8"));
    const { lessonDoc, vocabDocs, grammarDocs, pronDocs } = buildDocs(record);

    await upsert(Lesson, "lessonId", [lessonDoc]);
    await upsert(Vocab, "vocabId", vocabDocs);
    await upsert(GrammarPoint, "grammarId", grammarDocs);
    await upsert(PronunciationPoint, "pronId", pronDocs);

    lessons += 1;
    vocab += vocabDocs.length;
    grammar += grammarDocs.length;
    pron += pronDocs.length;
    console.log(`  seeded ${lessonDoc.lessonId} (${record.title})`);
  }

  console.log(`\nBook 1: lessons=${lessons} grammar=${grammar} pronunciation=${pron} vocab=${vocab}`);

  const b2 = await seedBook2();
  if (b2) {
    console.log(`Book 2: keywords=${b2.keywords} expressions=${b2.expressions}`);
  }

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error("Seed failed:", err?.message || err);
  process.exit(1);
});
