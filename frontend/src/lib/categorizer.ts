/**
 * Lightweight transaction categorizer.
 *
 * Trained on existing transactions that share the target account, it learns
 * which counter-accounts are associated with which description keywords, then
 * scores new descriptions using a TF-IDF-like approach.
 */

import type { Account, Transaction } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Text normalisation
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the','and','for','inc','llc','des','web','ppd','ach','com','www',
  'corp','co','ltd','dba','via','from','pos','pmt','payment','purchase',
  'transaction','transfer','dep','deposit','withdrawal','chk','check',
  'debit','credit','online','mobile','indn','ccd','tel','prv',
]);

/**
 * Strip structured bank metadata (DES:..., ID:..., INDN:... etc.) and
 * tokenise what remains into lowercase alphabetic words.
 */
export function extractTokens(description: string): string[] {
  const cleaned = description
    // remove everything from bank metadata markers onward
    .replace(/\s+(?:DES|ID|INDN|CO\s*ID|SEC|CCD|PPD|WEB|ACH|TEL|PRV)[:\s].*$/i, '')
    // remove masked account numbers (XXXXX1234) and pure digit sequences
    .replace(/X+\d*/gi, '')
    .replace(/\b\d{3,}\b/g, '')
    .toLowerCase();

  return cleaned
    .replace(/[^a-z\s&]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

// ─────────────────────────────────────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────────────────────────────────────

export interface CategorizerModel {
  /** token → Map<accountId, occurrenceCount> */
  tokenCounts: Map<string, Map<string, number>>;
  /** accountId → total training transactions */
  totalByAccount: Map<string, number>;
  /** Most common counter-account (used as high-confidence fallback) */
  mostCommonAccountId: string | null;
}

/**
 * Build a model from all transactions that include a split on `targetAccountId`.
 * Excludes placeholder, imbalance, and ROOT accounts from counter-account targets.
 */
export function buildModel(
  transactions: Transaction[],
  targetAccountId: string,
  accounts: Account[],
): CategorizerModel {
  const accMap = new Map(accounts.map((a) => [a.id, a]));
  const tokenCounts = new Map<string, Map<string, number>>();
  const totalByAccount = new Map<string, number>();

  for (const txn of transactions) {
    if (!txn.splits.some((s) => s.accountId === targetAccountId)) continue;

    // Find the best "other" split to use as the label
    const others = txn.splits.filter((s) => {
      if (s.accountId === targetAccountId) return false;
      const acc = accMap.get(s.accountId);
      if (!acc || acc.placeholder || acc.type === 'ROOT') return false;
      if (/imbalance/i.test(acc.name)) return false;
      return true;
    });
    if (others.length === 0) continue;

    // Prefer INCOME/EXPENSE accounts as labels (most specific categorisation),
    // but also learn ASSET/BANK/CREDIT/LIABILITY targets for transfers
    const PREFERRED = new Set(['INCOME', 'EXPENSE', 'ASSET', 'BANK', 'CASH', 'CREDIT', 'LIABILITY']);
    const labelSplit =
      others.find((s) => PREFERRED.has(accMap.get(s.accountId)?.type ?? '')) ?? others[0];

    const accountId = labelSplit.accountId;
    const tokens = extractTokens(txn.description);

    totalByAccount.set(accountId, (totalByAccount.get(accountId) ?? 0) + 1);

    for (const token of tokens) {
      if (!tokenCounts.has(token)) tokenCounts.set(token, new Map());
      const m = tokenCounts.get(token)!;
      m.set(accountId, (m.get(accountId) ?? 0) + 1);
    }
  }

  // Most common counter-account across all training data
  const mostCommonAccountId =
    [...totalByAccount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { tokenCounts, totalByAccount, mostCommonAccountId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Prediction
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryPrediction {
  accountId: string;
  /** 0–1: share of total score held by the winning account */
  confidence: number;
  /** true when the model had no matching tokens and fell back */
  isFallback: boolean;
}

function predictOne(
  description: string,
  model: CategorizerModel,
  fallbackAccountId: string,
): CategoryPrediction {
  const tokens = extractTokens(description);
  const scores = new Map<string, number>();

  for (const token of tokens) {
    const counts = model.tokenCounts.get(token);
    if (!counts) continue;

    // IDF: penalise tokens that appear across many different accounts
    const docFreq = counts.size;
    const idfWeight = 1 / Math.log(1 + docFreq);

    for (const [accountId, count] of counts) {
      const total = model.totalByAccount.get(accountId) ?? 1;
      const tf = count / total;
      scores.set(accountId, (scores.get(accountId) ?? 0) + tf * idfWeight);
    }
  }

  if (scores.size === 0) {
    return { accountId: fallbackAccountId, confidence: 0, isFallback: true };
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const topScore = sorted[0][1];
  const totalScore = sorted.reduce((s, [, v]) => s + v, 0);
  const confidence = totalScore > 0 ? topScore / totalScore : 0;

  return {
    accountId: sorted[0][0],
    confidence,
    isFallback: false,
  };
}

export function predictBatch(
  descriptions: string[],
  model: CategorizerModel,
  fallbackAccountId: string,
): CategoryPrediction[] {
  return descriptions.map((d) => predictOne(d, model, fallbackAccountId));
}
