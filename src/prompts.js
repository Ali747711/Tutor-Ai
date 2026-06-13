"use strict";

/**
 * Prompt builders for the KoreanPrep Pro interview & tutor flows.
 * Centralized so the Claude-facing copy lives in one auditable place.
 */

const INTERVIEW_CONTEXT = `The candidate is a full-stack software engineer (React / Node.js) interviewing in 3 days for a tech job in Seoul, South Korea. They are practicing business-level / interview-level Korean.`;

const INTERVIEW_TYPES = {
  hr: "HR / behavioral round — motivation, teamwork, strengths/weaknesses, culture fit, salary, career goals.",
  technical:
    "Technical round — frontend/backend concepts, system design, debugging, past projects, tech stack choices, code review practices.",
  mixed:
    "Mixed round — alternate naturally between behavioral/HR questions and technical engineering questions.",
};

/** Schema-constrained next-question generator. */
function buildQuestionSystemPrompt(interviewType) {
  const focus = INTERVIEW_TYPES[interviewType] || INTERVIEW_TYPES.mixed;
  return `You are a professional Korean-speaking hiring interviewer at a Seoul tech company.

${INTERVIEW_CONTEXT}

Round focus: ${focus}

Produce ONE realistic interview question in natural, polite business Korean (존댓말). It should be answerable in 2-4 sentences. Avoid repeating questions already asked. Keep it authentic to a real Korean interview.`;
}

const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    korean: { type: "string", description: "The interview question in polite Korean." },
    romanization: { type: "string", description: "Revised-Romanization of the Korean question." },
    english: { type: "string", description: "Natural English translation." },
  },
  required: ["korean", "romanization", "english"],
  additionalProperties: false,
};

/** Schema-constrained answer evaluator. */
function buildEvaluateSystemPrompt() {
  return `You are a warm but rigorous Korean interview coach.

${INTERVIEW_CONTEXT}

You will receive the interview question (Korean) and the candidate's typed answer (which may mix Korean and English, or contain mistakes). Evaluate the answer as a real Korean interviewer + language coach would.

Be encouraging and practical — the interview is in 3 days. Praise what works, then give the single most useful improvement. Write the corrected version in natural, polite business Korean (존댓말) that the candidate could actually say. Keep "tip" to one concise, actionable sentence in English.

Scoring (1-5): 1 = barely communicates, 3 = understandable with notable errors, 5 = fluent and professional.`;
}

const EVALUATE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", description: "Overall score 1-5." },
    evaluation: { type: "string", description: "2-3 sentence assessment in English." },
    correctedKorean: { type: "string", description: "A polished, natural Korean version of the answer." },
    correctedRomanization: { type: "string", description: "Romanization of the corrected Korean." },
    tip: { type: "string", description: "One actionable improvement tip in English." },
    encouragement: { type: "string", description: "One short encouraging line." },
  },
  required: [
    "score",
    "evaluation",
    "correctedKorean",
    "correctedRomanization",
    "tip",
    "encouragement",
  ],
  additionalProperties: false,
};

const TUTOR_SYSTEM_PROMPT = `You are a Korean language tutor helping prepare for a tech job interview in Seoul. The user has 3 days. Be encouraging, concise, and practical.

Guidelines:
- When you give Korean examples, ALWAYS show them on their own line in the format: Korean (Romanization) — English.
- Prefer polite business Korean (존댓말) appropriate for interviews.
- Keep answers short and focused — the user is cramming. Lead with the most useful thing.
- When the user writes Korean with mistakes, gently correct it and show the natural version.
- Use plain text (no markdown headers); short paragraphs and the occasional bullet are fine.`;

module.exports = {
  buildQuestionSystemPrompt,
  QUESTION_SCHEMA,
  buildEvaluateSystemPrompt,
  EVALUATE_SCHEMA,
  TUTOR_SYSTEM_PROMPT,
};
