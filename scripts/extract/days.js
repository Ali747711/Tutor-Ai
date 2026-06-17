"use strict";

/**
 * Static metadata for the 84 days of "My Weekly Korean Vocabulary Book 1"
 * (12 weeks × 7 days). Page numbers are PDF pages (which match the printed
 * pages). Each day runs from its `startPage` to the next day's start − 1
 * (the final day ends at the last page, 288).
 *
 * keyword/meaning come from the table of contents and are passed to the
 * extractor as trusted hints.
 */

// [week, day, keyword, meaning, startPage]
const RAW = [
  [1, 1, "보다", "to see; to look; to watch; to meet up; to read", 11],
  [1, 2, "전화", "phone call; telephone", 14],
  [1, 3, "듣다", "to hear; to listen", 17],
  [1, 4, "친구", "friend", 20],
  [1, 5, "말하다", "to talk; to say; to speak; to tell", 23],
  [1, 6, "노래", "song", 26],
  [1, 7, "가르치다", "to teach", 29],
  [2, 1, "먹다", "to eat; to drink", 33],
  [2, 2, "공부", "studies, one's learning", 36],
  [2, 3, "마시다", "to drink", 39],
  [2, 4, "일", "work; task", 42],
  [2, 5, "읽다", "to read", 45],
  [2, 6, "질문", "question", 48],
  [2, 7, "쓰다", "to write", 51],
  [3, 1, "빠르다", "to be fast", 55],
  [3, 2, "지각", "being late (for school/work/appointment)", 59],
  [3, 3, "느리다", "to be slow", 62],
  [3, 4, "요리", "cooking, cookery", 66],
  [3, 5, "깨끗하다", "to be clean", 70],
  [3, 6, "냄새", "smell, odor", 73],
  [3, 7, "지저분하다", "to be messy; to be dirty", 76],
  [4, 1, "기다리다", "to wait", 81],
  [4, 2, "운동", "exercise, workout; sport(s)", 84],
  [4, 3, "뛰다", "to run; to jump", 87],
  [4, 4, "길", "road, street; way", 90],
  [4, 5, "걷다", "to walk", 93],
  [4, 6, "요일", "day of the week", 96],
  [4, 7, "앉다", "to sit", 100],
  [5, 1, "배우다", "to learn; to study", 104],
  [5, 2, "손", "hand", 107],
  [5, 3, "잊다", "to forget", 110],
  [5, 4, "발", "foot", 113],
  [5, 5, "있다", "to be there; to exist; to have", 116],
  [5, 6, "눈", "eye", 119],
  [5, 7, "없다", "to not have; to not be there; to not exist", 122],
  [6, 1, "울다", "to cry", 126],
  [6, 2, "짜증", "irritation, annoyance", 129],
  [6, 3, "웃다", "to laugh, smile", 133],
  [6, 4, "걱정", "worry, concern", 136],
  [6, 5, "재미있다", "to be fun; to be funny; to be interesting", 139],
  [6, 6, "문제", "problem, issue, thing; matter", 142],
  [6, 7, "지루하다", "to be boring; to be bored", 145],
  [7, 1, "크다", "to be big; to be tall; to be loud", 149],
  [7, 2, "돈", "money", 152],
  [7, 3, "작다", "to be small, little", 155],
  [7, 4, "시간", "time; hour", 158],
  [7, 5, "좋아하다", "to like", 161],
  [7, 6, "머리", "head; hair", 164],
  [7, 7, "싫어하다", "to dislike, hate", 167],
  [8, 1, "자다", "to sleep", 171],
  [8, 2, "잠", "sleep", 174],
  [8, 3, "일어나다", "to wake up; to get up", 177],
  [8, 4, "거짓말", "lie", 180],
  [8, 5, "만나다", "to meet (up); to be seeing someone", 183],
  [8, 6, "사이", "relationship, relations", 186],
  [8, 7, "헤어지다", "to part; to break up", 189],
  [9, 1, "무섭다", "to be scary; to be scared", 194],
  [9, 2, "돕다", "to help", 198],
  [9, 3, "이상하다", "to be weird, odd, strange", 201],
  [9, 4, "묻다", "to ask", 204],
  [9, 5, "화내다", "to be angry at someone; to yell at someone out of anger", 207],
  [9, 6, "생각", "thought; opinion; idea", 210],
  [9, 7, "부럽다", "to be jealous, envious", 213],
  [10, 1, "만들다", "to make", 217],
  [10, 2, "이유", "reason", 221],
  [10, 3, "입다", "to wear (clothes)", 225],
  [10, 4, "실패", "failure", 228],
  [10, 5, "열다", "to open", 232],
  [10, 6, "성공", "success", 235],
  [10, 7, "닫다", "to close", 238],
  [11, 1, "사다", "to buy", 243],
  [11, 2, "약속", "plans; promise", 246],
  [11, 3, "팔다", "to sell", 249],
  [11, 4, "부족", "shortage, lack, insufficiency", 252],
  [11, 5, "알다", "to know", 256],
  [11, 6, "밥", "food; meal; cooked rice", 259],
  [11, 7, "모르다", "to not know", 262],
  [12, 1, "주다", "to give", 266],
  [12, 2, "사랑", "love", 269],
  [12, 3, "받다", "to receive", 272],
  [12, 4, "연락", "contact", 275],
  [12, 5, "원하다", "to want", 278],
  [12, 6, "문자", "text message", 282],
  [12, 7, "빌리다", "to borrow; to rent", 285],
];

const LAST_PAGE = 288;
const TOTAL_DAYS = RAW.length; // 84

const DAYS = RAW.map(([week, day, keyword, meaning, startPage], i) => {
  const next = RAW[i + 1];
  const endPage = next ? next[4] - 1 : LAST_PAGE;
  return { order: i + 1, week, day, keyword, meaning, startPage, endPage };
});

/** Returns metadata for one global day index (1..84). */
function dayMeta(order) {
  const d = DAYS[order - 1];
  if (!d) throw new Error(`Day ${order} out of range (1-${TOTAL_DAYS})`);
  return d;
}

module.exports = { dayMeta, DAYS, TOTAL_DAYS };
