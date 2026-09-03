/**
 * Intent classification and opportunity scoring.
 *
 * The core idea: for affiliate work, COMMERCIAL intent ("best X", "X vs Y")
 * is worth far more than informational volume. A 200-search/mo "best X for Y"
 * query beats a 5,000-search/mo "what is X" every time.
 */

export type Intent = 'transactional' | 'commercial' | 'informational' | 'navigational';

const TRANSACTIONAL = /\b(buy|price|pricing|cheap|cheapest|deal|deals|discount|coupon|promo|for sale|order|shop)\b/i;
const COMMERCIAL    = /\b(best|top|review|reviews|vs|versus|compare|comparison|alternative|alternatives|worth it|which)\b/i;
const INFORMATIONAL = /\b(how|what|why|when|guide|tutorial|explain|meaning|examples?|tips)\b/i;

export function classify(kw: string): Intent {
  if (TRANSACTIONAL.test(kw)) return 'transactional';
  if (COMMERCIAL.test(kw))    return 'commercial';
  if (INFORMATIONAL.test(kw)) return 'informational';
  return 'navigational';
}

const INTENT_WEIGHT: Record<Intent, number> = {
  transactional: 1.00,   // ready to buy
  commercial:    0.95,   // comparing — the affiliate sweet spot
  informational: 0.35,   // traffic, rarely revenue
  navigational:  0.15,   // looking for a specific brand
};

export interface Scored {
  keyword: string;
  intent: Intent;
  words: number;
  /** 0-100. Higher = better affiliate opportunity. */
  score: number;
  reasons: string[];
  /** 0-100 from a SERP adapter, when one is available. */
  difficulty?: number;
}

export function score(keyword: string, difficulty?: number): Scored {
  const kw = keyword.toLowerCase().trim();
  const intent = classify(kw);
  const words = kw.split(/\s+/).length;
  const reasons: string[] = [];

  let s = INTENT_WEIGHT[intent] * 60;
  reasons.push(`${intent} intent`);

  // Long tail is easier to rank and converts better. Peaks around 4-7 words.
  if (words >= 4 && words <= 7) { s += 20; reasons.push('long-tail (4-7 words)'); }
  else if (words === 3)          { s += 12; reasons.push('mid-tail'); }
  else if (words >= 8)           { s += 8;  reasons.push('very long-tail'); }
  else                           { s -= 10; reasons.push('head term — hard'); }

  // "for <audience>" queries are pre-segmented buyers.
  if (/\bfor\b/.test(kw)) { s += 8; reasons.push('audience-qualified ("for ...")'); }

  // Comparison queries convert unusually well for affiliates.
  if (/\b(vs|versus|alternative)\b/.test(kw)) { s += 10; reasons.push('comparison query'); }

  // Forum-seeking means people distrust the existing SERP — an opening.
  if (/\breddit\b/.test(kw)) { s += 5; reasons.push('SERP distrust signal'); }

  // Local intent is useless for an affiliate site.
  if (/\bnear me\b/.test(kw)) { s -= 25; reasons.push('local intent — not affiliate'); }

  if (typeof difficulty === 'number') {
    s -= difficulty * 0.4;
    reasons.push(`SERP difficulty ${difficulty}`);
  }

  return {
    keyword: kw,
    intent,
    words,
    score: Math.max(0, Math.min(100, Math.round(s))),
    reasons,
    difficulty,
  };
}

export function rank(keywords: string[], difficulties?: Map<string, number>): Scored[] {
  return keywords
    .map(k => score(k, difficulties?.get(k.toLowerCase())))
    .sort((a, b) => b.score - a.score);
}
