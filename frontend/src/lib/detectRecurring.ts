import type {
  Account, Transaction, RecurringItem, RecurringFrequency,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Frequency specs for pattern hinting
// ─────────────────────────────────────────────────────────────────────────────

interface FrequencySpec {
  freq: RecurringFrequency;
  target: number;   // days
  tolerance: number;
}

const FREQUENCY_SPECS: FrequencySpec[] = [
  { freq: 'weekly',    target: 7,  tolerance: 2  },
  { freq: 'biweekly',  target: 14, tolerance: 4  },
  { freq: 'monthly',   target: 30, tolerance: 8  },
  { freq: 'bimonthly', target: 61, tolerance: 14 },
  { freq: 'quarterly', target: 91, tolerance: 18 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Math helpers
// ─────────────────────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function daysBetween(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}

function classifyInterval(days: number): RecurringFrequency | null {
  let best: { spec: FrequencySpec; dist: number } | null = null;
  for (const spec of FREQUENCY_SPECS) {
    const dist = Math.abs(days - spec.target);
    if (dist <= spec.tolerance && (!best || dist < best.dist)) {
      best = { spec, dist };
    }
  }
  return best?.spec.freq ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build a suggested frequency for a description+account pair by looking at
// ALL historical transactions (not just the 3-month window).
// ─────────────────────────────────────────────────────────────────────────────

function buildSuggestions(
  transactions: Transaction[],
  accounts: Account[],
  kind: 'expense' | 'income',
): Map<string, RecurringFrequency> {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const targetTypes = kind === 'expense' ? new Set(['EXPENSE']) : new Set(['INCOME']);

  // desc+accountId → sorted dates
  const datesByKey = new Map<string, string[]>();

  for (const txn of transactions) {
    for (const split of txn.splits) {
      const acc = accountMap.get(split.accountId);
      if (!acc || !targetTypes.has(acc.type)) continue;
      if (Math.abs(split.value) < 0.01) continue;
      const desc = txn.description.trim().toLowerCase() || split.accountId;
      const key = `${split.accountId}|${desc}`;
      if (!datesByKey.has(key)) datesByKey.set(key, []);
      datesByKey.get(key)!.push(txn.datePosted);
    }
  }

  const suggestions = new Map<string, RecurringFrequency>();
  for (const [key, dates] of datesByKey) {
    const sorted = [...new Set(dates)].sort();
    if (sorted.length < 3) continue;
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(daysBetween(sorted[i - 1], sorted[i]));
    }
    const freq = classifyInterval(median(intervals));
    if (freq) suggestions.set(key, freq);
  }
  return suggestions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Build a flat list of individual transactions for the last 3 months in a
// given account. Sorted newest-first.
// ─────────────────────────────────────────────────────────────────────────────

export function buildTransactionItems(
  transactions: Transaction[],
  accounts: Account[],
  kind: 'expense' | 'income',
  accountId: string,
): RecurringItem[] {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const targetTypes = kind === 'expense' ? new Set(['EXPENSE']) : new Set(['INCOME']);
  const acc = accountMap.get(accountId);
  if (!acc) return [];

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 3);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Build suggestions from full history
  const suggestions = buildSuggestions(transactions, accounts, kind);

  const items: RecurringItem[] = [];

  for (const txn of transactions) {
    if (txn.datePosted < cutoffStr) continue;
    for (const split of txn.splits) {
      if (split.accountId !== accountId) continue;
      const a = accountMap.get(split.accountId);
      if (!a || !targetTypes.has(a.type)) continue;
      const absVal = Math.abs(split.value);
      if (absVal < 0.01) continue;

      const desc = txn.description.trim().toLowerCase() || accountId;
      const suggestionKey = `${accountId}|${desc}`;

      items.push({
        key: `${txn.id}|${accountId}`,
        txnId: txn.id,
        label: txn.description.trim() || a.name,
        kind,
        accountId,
        accountName: a.name,
        amount: absVal,
        datePosted: txn.datePosted,
        frequency: suggestions.get(suggestionKey) ?? 'monthly',
        enabled: false,
        customAmount: null,
        suggestedFrequency: suggestions.get(suggestionKey) ?? null,
      });
    }
  }

  // Newest first
  return items.sort((a, b) => b.datePosted.localeCompare(a.datePosted));
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge saved user settings onto freshly built items
// ─────────────────────────────────────────────────────────────────────────────

export function mergeWithSaved(
  fresh: RecurringItem[],
  saved: RecurringItem[],
): RecurringItem[] {
  const savedMap = new Map(saved.map((s) => [s.key, s]));
  return fresh.map((item) => {
    const s = savedMap.get(item.key);
    if (!s) return item;
    return {
      ...item,
      frequency: s.frequency,
      enabled: s.enabled,
      customAmount: s.customAmount,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Build 6-month projection from enabled items
// ─────────────────────────────────────────────────────────────────────────────

const FREQ_DAYS: Record<RecurringFrequency, number> = {
  weekly:    7,
  biweekly:  14,
  monthly:   30,
  bimonthly: 61,
  quarterly: 91,
};

export interface ProjectionMonth {
  label: string;
  iso: string;
  income: number;
  expenses: number;
  net: number;
  lineItems: { label: string; kind: 'expense' | 'income'; amount: number }[];
}

export function buildProjection(items: RecurringItem[]): ProjectionMonth[] {
  const enabled = items.filter((i) => i.enabled);
  const now = new Date();
  const projStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    return {
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      startDay: d,
      endDay: new Date(d.getFullYear(), d.getMonth() + 1, 0),
    };
  });

  return months.map(({ label, iso, startDay, endDay }) => {
    let income = 0;
    let expenses = 0;
    const lineItems: ProjectionMonth['lineItems'] = [];

    for (const item of enabled) {
      const amount = item.customAmount ?? item.amount;
      const freqDays = FREQ_DAYS[item.frequency];

      // Walk forward from today in freqDays steps; count hits in this month
      let cursor = new Date(now);
      cursor.setDate(cursor.getDate() + freqDays);

      // Advance to first occurrence at or after projStart
      while (cursor < projStart) cursor.setDate(cursor.getDate() + freqDays);

      let hits = 0;
      const temp = new Date(cursor);
      while (temp <= endDay) {
        if (temp >= startDay) hits++;
        temp.setDate(temp.getDate() + freqDays);
      }

      if (hits > 0) {
        const total = Math.round(amount * hits * 100) / 100;
        lineItems.push({ label: item.label, kind: item.kind, amount: total });
        if (item.kind === 'income') income += total;
        else expenses += total;
      }
    }

    lineItems.sort((a, b) => b.amount - a.amount);

    return {
      label, iso,
      income:   Math.round(income   * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net:      Math.round((income - expenses) * 100) / 100,
      lineItems,
    };
  });
}
