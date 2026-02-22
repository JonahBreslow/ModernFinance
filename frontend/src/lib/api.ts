import type { GnuCashData, Transaction, ProjectionsData } from '../types';

const BASE = '/api';

export async function fetchData(): Promise<GnuCashData> {
  const res = await fetch(`${BASE}/data`);
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json();
}

export async function createTransaction(txn: Omit<Transaction, 'id' | 'dateEntered'>): Promise<Transaction> {
  const res = await fetch(`${BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(txn),
  });
  if (!res.ok) throw new Error('Failed to create transaction');
  return res.json();
}

export async function updateTransaction(id: string, txn: Partial<Transaction>): Promise<Transaction> {
  const res = await fetch(`${BASE}/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(txn),
  });
  if (!res.ok) throw new Error('Failed to update transaction');
  return res.json();
}

export async function deleteTransaction(id: string): Promise<void> {
  const res = await fetch(`${BASE}/transactions/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete transaction');
}

export async function deleteAccount(id: string): Promise<void> {
  const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete account');
  }
}

export async function renameAccount(id: string, name: string): Promise<void> {
  const res = await fetch(`${BASE}/accounts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to rename account');
  }
}

export async function createAccount(data: {
  name: string;
  type: string;
  parentId?: string | null;
  description?: string;
  placeholder?: boolean;
}): Promise<import('../types').Account> {
  const res = await fetch(`${BASE}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create account');
  }
  return res.json();
}

export interface BudgetData {
  monthly: Record<string, number>;
}

export async function fetchBudget(): Promise<BudgetData> {
  const res = await fetch(`${BASE}/budget`);
  if (!res.ok) throw new Error('Failed to fetch budget');
  return res.json();
}

export async function saveBudget(data: BudgetData): Promise<void> {
  const res = await fetch(`${BASE}/budget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save budget');
}

export async function fetchProjections(): Promise<ProjectionsData> {
  const res = await fetch(`${BASE}/projections`);
  if (!res.ok) throw new Error('Failed to fetch projections');
  return res.json();
}

export async function saveProjections(data: ProjectionsData): Promise<void> {
  const res = await fetch(`${BASE}/projections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save projections');
}

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ParsedRow {
  fitId: string | null;
  date: string;
  description: string;
  amount: number;
  memo: string | null;
  isDuplicate: boolean;
}

export interface CsvColumnMapping {
  dateCol: number;
  descCol: number;
  amtCol: number;
  memoCol: number | null;
  negateAmount: boolean;
  headerRowIdx?: number;
}

export interface ImportPreviewResult {
  needsMapping: boolean;
  format: 'qfx' | 'csv' | 'xlsx';
  suggestedAccountHint: string | null;
  headers: string[];
  headerRowIdx: number;
  rows: ParsedRow[];
}

export async function previewImport(
  file: File,
  targetAccountId?: string,
  mapping?: CsvColumnMapping,
  headerRowIdx?: number
): Promise<ImportPreviewResult> {
  const form = new FormData();
  form.append('file', file);
  if (targetAccountId) form.append('targetAccountId', targetAccountId);
  if (mapping) form.append('mapping', JSON.stringify(mapping));
  if (headerRowIdx != null) form.append('headerRowIdx', String(headerRowIdx));

  const res = await fetch('/api/import/preview', { method: 'POST', body: form });
  if (!res.ok) throw new Error('Import preview failed');
  return res.json();
}

/** A parsed account-change entry from the GnuCash .log files */
export interface ChangeLogEntry {
  changedAt: string | null;
  transGuid: string;
  splitGuid: string;
  datePosted: string;
  description: string;
  amount: number;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
}

export async function fetchChangeLog(): Promise<ChangeLogEntry[]> {
  const res = await fetch(`${BASE}/change-log`);
  if (!res.ok) throw new Error('Failed to fetch change log');
  return res.json();
}
