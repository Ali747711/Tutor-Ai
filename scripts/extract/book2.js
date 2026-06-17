"use strict";

/**
 * One-time extractor for "My Weekly Korean Vocabulary Book 1".
 *
 * For each day it renders the day's PDF pages to PNG, sends them to Claude
 * with a strict json_schema, and writes backend/seed/book2/week-WW-day-D.json.
 * Idempotent (re-running overwrites).
 *
 * Usage:
 *   node scripts/extract/book2.js                 # all 84 days
 *   node scripts/extract/book2.js --only=1        # global day index 1
 *   node scripts/extract/book2.js --from=1 --to=7 # week 1
 *   flags: --dpi=200 (default), --model=claude-opus-4-8 (default)
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const Anthropic = require("@anthropic-ai/sdk");
const {
  buildKeywordExtractSystemPrompt,
  KEYWORD_EXTRACT_SCHEMA,
} = require("../../src/prompts");
const { dayMeta, TOTAL_DAYS } = require("./days");

const PDF_PATH = path.join(
  __dirname, "..", "..", "data",
  "yoonjian_my_weekly_korean_vocabulary_book_1_1_by_talk_to_me.pdf"
);
const SCRATCH_DIR = path.join(__dirname, "..", "..", "data", "_pages");
const SEED_DIR = path.join(__dirname, "..", "..", "seed", "book2");
const PREFIX = "b2page"; // distinct from book1 to avoid render collisions

const pad2 = (n) => String(n).padStart(2, "0");

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
    else if (a.startsWith("--")) args[a.slice(2)] = true;
  }
  return args;
}

function renderPages(start, end, dpi) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  const prefix = path.join(SCRATCH_DIR, PREFIX);
  execFileSync("pdftoppm", [
    "-png", "-r", String(dpi), "-f", String(start), "-l", String(end), PDF_PATH, prefix,
  ]);
  const paths = [];
  for (let p = start; p <= end; p++) {
    const candidates = [
      `${prefix}-${p}.png`,
      `${prefix}-${String(p).padStart(2, "0")}.png`,
      `${prefix}-${String(p).padStart(3, "0")}.png`,
    ];
    const found = candidates.find((c) => fs.existsSync(c));
    if (!found) throw new Error(`Rendered page ${p} not found`);
    paths.push(found);
  }
  return paths;
}

function imageBlock(filePath) {
  const data = fs.readFileSync(filePath).toString("base64");
  return { type: "image", source: { type: "base64", media_type: "image/png", data } };
}

function parseStructured(message) {
  const block = message.content.find((b) => b.type === "text");
  if (!block) throw new Error("No text block in model response");
  return JSON.parse(block.text);
}

async function extractDay(anthropic, model, meta, dpi) {
  const pages = renderPages(meta.startPage, meta.endPage, dpi);
  const content = [
    ...pages.map(imageBlock),
    { type: "text", text: `Extract Week ${meta.week} Day ${meta.day} ("${meta.keyword}") — all 20 expressions.` },
  ];
  const stream = anthropic.messages.stream({
    model,
    max_tokens: 16000,
    system: buildKeywordExtractSystemPrompt(meta),
    output_config: { format: { type: "json_schema", schema: KEYWORD_EXTRACT_SCHEMA } },
    messages: [{ role: "user", content }],
  });
  const message = await stream.finalMessage();
  return parseStructured(message);
}

async function main() {
  const args = parseArgs(process.argv);
  const dpi = Number(args.dpi) || 200;
  const model = args.model || "claude-opus-4-8";

  if (!process.env.CLAUDE_API_KEY) {
    console.error("FATAL: CLAUDE_API_KEY is not set in backend/.env");
    process.exit(1);
  }
  if (!fs.existsSync(PDF_PATH)) {
    console.error(`FATAL: PDF not found at ${PDF_PATH}`);
    process.exit(1);
  }

  let days;
  if (args.only) {
    days = [Number(args.only)];
  } else {
    const from = Number(args.from) || 1;
    const to = Number(args.to) || TOTAL_DAYS;
    days = [];
    for (let d = from; d <= to; d++) days.push(d);
  }

  const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  for (const order of days) {
    const meta = dayMeta(order);
    process.stdout.write(
      `Day ${order} W${meta.week}D${meta.day} (${meta.keyword}) pages ${meta.startPage}-${meta.endPage}... `
    );
    try {
      const data = await extractDay(anthropic, model, meta, dpi);
      const record = {
        week: meta.week, day: meta.day, order: meta.order,
        keyword: meta.keyword, meaning: meta.meaning,
        romanization: data.romanization || "",
        expressions: data.expressions,
      };
      const outPath = path.join(SEED_DIR, `week-${pad2(meta.week)}-day-${meta.day}.json`);
      fs.writeFileSync(outPath, JSON.stringify(record, null, 2) + "\n");
      console.log(`ok (${data.expressions.length} expressions)`);
    } catch (err) {
      console.log("FAILED");
      console.error(`  [day ${order}]`, err?.message || err);
    }
  }

  console.log("\nDone. Review the JSON in backend/seed/book2/ before seeding.");
}

main();
