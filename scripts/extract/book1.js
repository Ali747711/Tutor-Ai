"use strict";

/**
 * One-time extractor for "Real-Life Korean Conversations for Beginners".
 *
 * For each chapter it renders the chapter's PDF pages to PNG (via poppler's
 * pdftoppm), sends them to Claude with a strict json_schema, and writes a
 * reviewable JSON file to backend/seed/book1/chapter-NN.json. Re-running
 * overwrites the same files (idempotent).
 *
 * Usage:
 *   node scripts/extract/book1.js                # all 40 chapters
 *   node scripts/extract/book1.js --only=1       # just chapter 1
 *   node scripts/extract/book1.js --from=1 --to=5
 *   node scripts/extract/book1.js --only=1 --dpi=200 --model=claude-opus-4-8
 *
 * Requires: poppler (`pdftoppm` on PATH), CLAUDE_API_KEY in backend/.env.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });

const Anthropic = require("@anthropic-ai/sdk");
const { buildExtractSystemPrompt, LESSON_EXTRACT_SCHEMA } = require("../../src/prompts");
const { chapterMeta, TOTAL_CHAPTERS } = require("./chapters");

const PDF_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "real-life-korean-conversations-for-beginners_compress.pdf"
);
const SCRATCH_DIR = path.join(__dirname, "..", "..", "data", "_pages");
const SEED_DIR = path.join(__dirname, "..", "..", "seed", "book1");

function parseArgs(argv) {
  const args = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
    else if (a.startsWith("--")) args[a.slice(2)] = true;
  }
  return args;
}

/** Render pages [start..end] of the PDF to PNG, returns array of file paths. */
function renderPages(start, end, dpi) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
  const prefix = path.join(SCRATCH_DIR, "page");
  execFileSync("pdftoppm", [
    "-png",
    "-r", String(dpi),
    "-f", String(start),
    "-l", String(end),
    PDF_PATH,
    prefix,
  ]);
  // pdftoppm zero-pads the page number to the width of the last page (e.g. -012).
  const paths = [];
  for (let p = start; p <= end; p++) {
    const candidates = [
      `${prefix}-${p}.png`,
      `${prefix}-${String(p).padStart(2, "0")}.png`,
      `${prefix}-${String(p).padStart(3, "0")}.png`,
    ];
    const found = candidates.find((c) => fs.existsSync(c));
    if (!found) throw new Error(`Rendered page ${p} not found (tried: ${candidates.join(", ")})`);
    paths.push(found);
  }
  return paths;
}

function imageBlock(filePath) {
  const data = fs.readFileSync(filePath).toString("base64");
  return {
    type: "image",
    source: { type: "base64", media_type: "image/png", data },
  };
}

function parseStructured(message) {
  const block = message.content.find((b) => b.type === "text");
  if (!block) throw new Error("No text block in model response");
  return JSON.parse(block.text);
}

async function extractChapter(anthropic, model, meta, dpi) {
  const pages = renderPages(meta.startPage, meta.endPage, dpi);
  const content = [
    ...pages.map(imageBlock),
    { type: "text", text: `Extract Chapter ${meta.chapter} ("${meta.title}") as JSON per the schema.` },
  ];

  // Stream to avoid HTTP timeouts on the larger structured outputs.
  const stream = anthropic.messages.stream({
    model,
    max_tokens: 16000,
    system: buildExtractSystemPrompt(meta),
    output_config: { format: { type: "json_schema", schema: LESSON_EXTRACT_SCHEMA } },
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

  let chapters;
  if (args.only) {
    chapters = [Number(args.only)];
  } else {
    const from = Number(args.from) || 1;
    const to = Number(args.to) || TOTAL_CHAPTERS;
    chapters = [];
    for (let c = from; c <= to; c++) chapters.push(c);
  }

  const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  for (const c of chapters) {
    const meta = chapterMeta(c);
    process.stdout.write(`Chapter ${c} (${meta.title}) pages ${meta.startPage}-${meta.endPage}... `);
    try {
      const data = await extractChapter(anthropic, model, meta, dpi);
      const record = {
        chapter: meta.chapter,
        title: meta.title,
        category: meta.category,
        ...data,
      };
      const outPath = path.join(SEED_DIR, `chapter-${String(c).padStart(2, "0")}.json`);
      fs.writeFileSync(outPath, JSON.stringify(record, null, 2) + "\n");
      console.log(
        `ok (vocab ${data.coreVocab.length}+${data.extendedVocab.length}, grammar ${data.grammar.length}, pron ${data.pronunciation.length})`
      );
    } catch (err) {
      console.log("FAILED");
      console.error(`  [chapter ${c}]`, err?.message || err);
    }
  }

  console.log("\nDone. Review the JSON in backend/seed/book1/ before seeding.");
}

main();
