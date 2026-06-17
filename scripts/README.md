# Content pipeline

Turns the source PDFs in `backend/data/` into the curriculum stored in MongoDB.
Two stages: **extract** (PDF → committed JSON) and **seed** (JSON → MongoDB).

## Prerequisites

- `poppler` on PATH (`pdftoppm`) — macOS: `brew install poppler`
- `backend/.env` with `CLAUDE_API_KEY` and `DB_URL`

## Stage A — extract (one-time, committed to the repo)

Renders each chapter's pages to PNG and asks Claude (vision + strict
`json_schema`) to transcribe them into `backend/seed/book1/chapter-NN.json`.
Re-running overwrites the same files.

```bash
node scripts/extract/book1.js --only=1      # one chapter (cheap, for review)
node scripts/extract/book1.js --from=1 --to=5
node scripts/extract/book1.js               # all 40 chapters
# flags: --dpi=200 (default), --model=claude-opus-4-8 (default)
```

**Always hand-review the JSON before seeding** — vision OCR on Korean +
romanization can transpose characters or mis-pair answer keys. Re-extract a
single chapter with `--only=N` after fixing the prompt.

## Stage B — seed (idempotent)

Loads all committed JSON into MongoDB, upserting by natural key, and derives
the global `order` fields (grammar 1..80, pronunciation 1..80).

```bash
node scripts/seed.js
```

Expected counts for the full Book 1: 40 lessons, 80 grammar points, 80
pronunciation points, ~800 vocab.
