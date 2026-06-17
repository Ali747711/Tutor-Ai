"use strict";

/**
 * Static metadata for the 40 chapters of "Real-Life Korean Conversations for
 * Beginners". Page numbers are PDF page indices (which match the printed page
 * numbers in this book). Each chapter spans 8 pages starting at `startPage`.
 *
 * Title/category are supplied to the extractor as trusted hints and assigned
 * deterministically rather than relying on OCR.
 */

const CATEGORY_BY_CHAPTER = {
  1: "Introductions", 2: "Introductions",
  3: "Friends", 4: "Friends",
  5: "Invitations", 6: "Invitations",
  7: "Family", 8: "Family",
  9: "Shopping", 10: "Shopping", 11: "Shopping", 12: "Shopping",
  13: "Shopping", 14: "Shopping", 15: "Shopping",
  16: "On a Date", 17: "On a Date", 18: "On a Date", 19: "On a Date", 20: "On a Date",
  21: "At Work", 22: "At Work", 23: "At Work", 24: "At Work", 25: "At Work",
  26: "School", 27: "School",
  28: "Food", 29: "Food", 30: "Food", 31: "Food", 32: "Food",
  33: "Health", 34: "Health", 35: "Health",
  36: "Transportation", 37: "Transportation", 38: "Transportation", 39: "Transportation", 40: "Transportation",
};

const TITLE_BY_CHAPTER = {
  1: "Self-Introductions", 2: "Exchanging Numbers", 3: "How are you?", 4: "Plans",
  5: "Dinner", 6: "Wedding", 7: "Coming Home", 8: "Waking Up",
  9: "Marketplace", 10: "Clothing Store", 11: "Shoe Store", 12: "Electronics Store",
  13: "Furniture Store", 14: "Cosmetics Store", 15: "Bookstore", 16: "Blind Date",
  17: "Movie Date", 18: "Park", 19: "Confessing", 20: "Rejection",
  21: "Overtime Work", 22: "Meeting", 23: "Work Schedule", 24: "Getting a Job",
  25: "Company Dinner", 26: "Class", 27: "Exam", 28: "Restaurant",
  29: "Coffee Shop", 30: "Friend's House", 31: "Cooking", 32: "Ordering Delivery",
  33: "Pharmacy", 34: "Hospital", 35: "Not Feeling Well", 36: "Taxi",
  37: "Bus", 38: "Subway", 39: "Airplane", 40: "Bicycle",
};

const FIRST_CHAPTER_PAGE = 12; // PDF page of Dialogue 01 title page
const PAGES_PER_CHAPTER = 8;
const TOTAL_CHAPTERS = 40;

/** Returns metadata for one chapter (1..40). */
function chapterMeta(chapter) {
  if (chapter < 1 || chapter > TOTAL_CHAPTERS) {
    throw new Error(`Chapter ${chapter} out of range (1-${TOTAL_CHAPTERS})`);
  }
  const startPage = FIRST_CHAPTER_PAGE + (chapter - 1) * PAGES_PER_CHAPTER;
  return {
    chapter,
    title: TITLE_BY_CHAPTER[chapter],
    category: CATEGORY_BY_CHAPTER[chapter],
    startPage,
    endPage: startPage + PAGES_PER_CHAPTER - 1,
  };
}

module.exports = { chapterMeta, TOTAL_CHAPTERS, PAGES_PER_CHAPTER };
