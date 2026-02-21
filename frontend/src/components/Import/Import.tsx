import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload, FileText, CheckCircle2, AlertTriangle, ChevronRight,
  RotateCcw, CheckSquare, Square, X, ArrowRight, Loader2, Sparkles,
} from 'lucide-react';
import type { Account, Transaction } from '../../types';
import { cn, formatCurrency, formatDate, generateGuid } from '../../lib/utils';
import { previewImport, createTransaction } from '../../lib/api';
import type { ParsedRow, ImportPreviewResult, CsvColumnMapping } from '../../lib/api';
import { buildModel, predictBatch } from '../../lib/categorizer';
import type { CategoryPrediction } from '../../lib/categorizer';

interface ImportProps {
  accounts: Account[];
  transactions: Transaction[];
}

type Step = 'upload' | 'map' | 'review' | 'done';

const ACCEPTED = '.qfx,.ofx,.csv,.xlsx,.xls';

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'map',    label: 'Map Columns' },
    { id: 'review', label: 'Review' },
    { id: 'done',   label: 'Done' },
  ];
  const order: Step[] = ['upload', 'map', 'review', 'done'];
  const current = order.indexOf(step);

  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => {
        const idx = order.indexOf(s.id);
        const active   = s.id === step;
        const complete = idx < current;
        if (s.id === 'map' && step !== 'map' && current > 1) return null; // hide map step when not needed
        return (
          <div key={s.id} className="flex items-center">
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              active   && 'bg-blue-600 text-white',
              complete && 'bg-blue-600/20 text-blue-400',
              !active && !complete && 'text-gray-600'
            )}>
              {complete
                ? <CheckCircle2 size={13} />
                : <span className={cn(
                    'w-4 h-4 rounded-full border text-center leading-none flex items-center justify-center text-[10px]',
                    active ? 'border-white' : 'border-current'
                  )}>{idx + 1}</span>
              }
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight size={14} className="text-gray-700 mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Account picker (simple select)
// ─────────────────────────────────────────────────────────────────────────────

function AccountSelect({
  accounts, value, onChange, label, placeholder, filter,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  placeholder: string;
  filter?: (a: Account) => boolean;
}) {
  const opts = accounts.filter(filter ?? (() => true)).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500 w-full"
      >
        <option value="">{placeholder}</option>
        {opts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Column mapper
// ─────────────────────────────────────────────────────────────────────────────

function ColumnMapper({
  headers,
  onConfirm,
}: {
  headers: string[];
  onConfirm: (m: CsvColumnMapping) => void;
}) {
  const [dateCol,  setDateCol]  = useState<number | ''>(headers.findIndex((h) => /date/i.test(h)));
  const [descCol,  setDescCol]  = useState<number | ''>(headers.findIndex((h) => /desc|payee|name|memo/i.test(h)));
  const [amtCol,   setAmtCol]   = useState<number | ''>(headers.findIndex((h) => /amount|debit|credit/i.test(h)));
  const [memoCol,  setMemoCol]  = useState<number | ''>('');
  const [negate,   setNegate]   = useState(false);

  const ready = dateCol !== '' && descCol !== '' && amtCol !== '';

  const ColSelect = ({ value, onChange, label }: {
    value: number | ''; onChange: (v: number | '') => void; label: string;
  }) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value === '' ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? '' : parseInt(e.target.value))}
        className="bg-gray-800 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500 w-full"
      >
        <option value="">— select column —</option>
        {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        We couldn't auto-detect your CSV format. Map the columns below and we'll re-parse the file.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <ColSelect value={dateCol}  onChange={setDateCol}  label="Date column *" />
        <ColSelect value={descCol}  onChange={setDescCol}  label="Description / Payee column *" />
        <ColSelect value={amtCol}   onChange={setAmtCol}   label="Amount column *" />
        <ColSelect value={memoCol}  onChange={setMemoCol}  label="Memo column (optional)" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
        <input type="checkbox" checked={negate} onChange={(e) => setNegate(e.target.checked)}
          className="rounded border-white/20" />
        Negate amounts (debits are positive in this file)
      </label>
      <button
        onClick={() => ready && onConfirm({
          dateCol: dateCol as number,
          descCol: descCol as number,
          amtCol:  amtCol  as number,
          memoCol: memoCol === '' ? null : memoCol as number,
          negateAmount: negate,
        })}
        disabled={!ready}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm rounded-lg transition-colors"
      >
        Parse with these columns
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent transactions for the selected account
// ─────────────────────────────────────────────────────────────────────────────

function RecentTransactions({
  accountId,
  transactions,
}: {
  accountId: string;
  transactions: Transaction[];
}) {
  const recent = transactions
    .filter((t) => t.splits.some((s) => s.accountId === accountId))
    .sort((a, b) => b.datePosted.localeCompare(a.datePosted))
    .slice(0, 5);

  if (recent.length === 0) return null;

  const mostRecentDate = recent[0].datePosted;

  return (
    <div className="mt-3 rounded-lg border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800/60 border-b border-white/5">
        <span className="text-xs font-medium text-gray-400">Last 5 transactions in this account</span>
        <span className="text-xs text-blue-400 font-medium">
          Most recent: {formatDate(mostRecentDate)} — download from this date onwards
        </span>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {recent.map((txn) => {
            const split = txn.splits.find((s) => s.accountId === accountId)!;
            return (
              <tr key={txn.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                <td className="px-3 py-1.5 text-gray-600 font-mono whitespace-nowrap w-24">
                  {formatDate(txn.datePosted)}
                </td>
                <td className="px-3 py-1.5 text-gray-300 max-w-xs truncate">
                  {txn.description || <span className="italic text-gray-600">No description</span>}
                </td>
                <td className={cn(
                  'px-3 py-1.5 text-right font-mono whitespace-nowrap',
                  split.value >= 0 ? 'text-emerald-400' : 'text-red-400'
                )}>
                  {split.value >= 0 ? '+' : ''}{formatCurrency(split.value)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Import component
// ─────────────────────────────────────────────────────────────────────────────

export function Import({ accounts, transactions }: ImportProps) {
  const queryClient = useQueryClient();

  const [step, setStep]             = useState<Step>('upload');
  const [dragOver, setDragOver]     = useState(false);
  const [file, setFile]             = useState<File | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // Preview result
  const [preview, setPreview]       = useState<ImportPreviewResult | null>(null);

  // Account selection
  const [targetAccId,    setTargetAccId]    = useState('');
  const [imbalanceAccId, setImbalanceAccId] = useState('');

  // CSV header row override (null = use auto-detected)
  const [headerRowIdx, setHeaderRowIdx] = useState<number | null>(null);

  // Per-row ML category predictions and user overrides
  const [predictions, setPredictions] = useState<CategoryPrediction[]>([]);
  const [rowCategories, setRowCategories] = useState<Map<number, string>>(new Map());

  // Row selection (keys = index strings of non-duplicate rows by default)
  const [selected, setSelected]     = useState<Set<number>>(new Set());

  // Summary after save
  const [savedCount,    setSavedCount]    = useState(0);
  const [skippedCount,  setSkippedCount]  = useState(0);
  const [saving,        setSaving]        = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Offset account auto-detection ──────────────────────────────────────────
  // 1. Look at existing transactions for the target account and find the most
  //    frequently used counter-account (the "other side" of each split).
  // 2. Fall back to Imbalance-USD → any account with "imbalance" in the name →
  //    any EQUITY account.
  const autoOffsetAccId = useMemo(() => {
    if (!targetAccId) return null;

    // Build a frequency map of accounts that appear as the "other side"
    const freq = new Map<string, number>();
    for (const txn of transactions) {
      const hasSplit = txn.splits.some((s) => s.accountId === targetAccId);
      if (!hasSplit) continue;
      for (const s of txn.splits) {
        if (s.accountId !== targetAccId) {
          freq.set(s.accountId, (freq.get(s.accountId) ?? 0) + 1);
        }
      }
    }

    // Pick most frequent counter-account (excluding INCOME/EXPENSE — those are
    // real categories, not suitable as a catch-all offset for imports)
    const EXCLUDED = new Set(['INCOME', 'EXPENSE', 'ROOT']);
    const accMap = new Map(accounts.map((a) => [a.id, a]));
    const candidates = [...freq.entries()]
      .filter(([id]) => {
        const a = accMap.get(id);
        return a && !EXCLUDED.has(a.type) && !a.placeholder;
      })
      .sort((a, b) => b[1] - a[1]);

    if (candidates.length > 0) return candidates[0][0];

    // Fallback 1: Imbalance-USD by exact name
    const exact = accounts.find((a) => a.name === 'Imbalance-USD');
    if (exact) return exact.id;

    // Fallback 2: any account with "imbalance" in the name
    const fuzzy = accounts.find((a) => /imbalance/i.test(a.name));
    if (fuzzy) return fuzzy.id;

    // Fallback 3: first EQUITY account
    const equity = accounts.find((a) => a.type === 'EQUITY' && !a.placeholder);
    return equity?.id ?? null;
  }, [targetAccId, transactions, accounts]);

  // Auto-populate imbalanceAccId whenever the target changes (user can still override)
  const [imbalanceAutoSet, setImbalanceAutoSet] = useState(false);
  useEffect(() => {
    if (autoOffsetAccId && !imbalanceAutoSet) {
      setImbalanceAccId(autoOffsetAccId);
      setImbalanceAutoSet(true);
    }
  }, [autoOffsetAccId]);

  // Reset auto-set flag when target account changes so new auto-detection applies
  const prevTargetRef = useRef(targetAccId);
  useEffect(() => {
    if (prevTargetRef.current !== targetAccId) {
      prevTargetRef.current = targetAccId;
      setImbalanceAutoSet(false);
    }
  }, [targetAccId]);

  // ── ML categorizer ─────────────────────────────────────────────────────────
  // Build model from existing transactions whenever the target account changes
  const model = useMemo(
    () => targetAccId ? buildModel(transactions, targetAccId, accounts) : null,
    [targetAccId, transactions, accounts],
  );

  // All non-placeholder, non-ROOT accounts available as category targets,
  // grouped for display in the dropdown
  const categoryAccounts = useMemo(
    () => accounts.filter((a) => !a.placeholder && a.type !== 'ROOT'),
    [accounts],
  );
  const GROUP_ORDER: Account['type'][] = ['ASSET', 'BANK', 'CASH', 'CREDIT', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY', 'STOCK', 'MUTUAL', 'RECEIVABLE', 'PAYABLE'];
  const GROUP_LABELS: Partial<Record<Account['type'], string>> = {
    ASSET:      '── Assets ──',
    BANK:       '── Bank ──',
    CASH:       '── Cash ──',
    CREDIT:     '── Credit Cards ──',
    LIABILITY:  '── Liabilities ──',
    INCOME:     '── Income ──',
    EXPENSE:    '── Expenses ──',
    EQUITY:     '── Equity ──',
    STOCK:      '── Investments ──',
    MUTUAL:     '── Mutual Funds ──',
    RECEIVABLE: '── Receivable ──',
    PAYABLE:    '── Payable ──',
  };

  // Run predictions whenever new preview rows arrive
  useEffect(() => {
    const rows = preview?.rows ?? [];
    if (!rows.length || !model) { setPredictions([]); setRowCategories(new Map()); return; }

    const fallback = imbalanceAccId || autoOffsetAccId || '';
    const preds = predictBatch(rows.map((r) => r.description), model, fallback);
    setPredictions(preds);

    const cats = new Map<number, string>();
    preds.forEach((p, i) => cats.set(i, p.accountId));
    setRowCategories(cats);
  }, [preview, model]);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File, overrideHeaderRowIdx?: number) => {
    setFile(f);
    setError(null);
    setLoading(true);
    try {
      const hIdx = overrideHeaderRowIdx ?? headerRowIdx ?? undefined;
      const result = await previewImport(f, targetAccId || undefined, undefined, hIdx);
      if (result.headerRowIdx != null) setHeaderRowIdx(result.headerRowIdx);
      setPreview(result);
      if (result.needsMapping) {
        setStep('map');
      } else {
        // Pre-select all non-duplicate rows
        const sel = new Set<number>();
        result.rows.forEach((r, i) => { if (!r.isDuplicate) sel.add(i); });
        setSelected(sel);
        setStep('review');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  }, [targetAccId]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // ── Column mapping confirmed ────────────────────────────────────────────────

  const handleMappingConfirm = async (mapping: CsvColumnMapping) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await previewImport(file, targetAccId || undefined, mapping);
      setPreview(result);
      const sel = new Set<number>();
      result.rows.forEach((r, i) => { if (!r.isDuplicate) sel.add(i); });
      setSelected(sel);
      setStep('review');
    } catch (e: any) {
      setError(e.message || 'Failed to parse with mapping');
    } finally {
      setLoading(false);
    }
  };

  // ── Row selection ──────────────────────────────────────────────────────────

  const rows = preview?.rows ?? [];
  const toggleRow = (i: number) => {
    setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  };
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(rows.map((_, i) => i)));
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!targetAccId) { setError('Please select the target account.'); return; }
    const defaultOffsetId = imbalanceAccId || autoOffsetAccId;
    if (!defaultOffsetId) { setError('Please select an offset account.'); return; }

    setSaving(true);
    setError(null);
    let saved = 0;
    let skipped = 0;

    try {
      for (const [i, row] of rows.entries()) {
        if (!selected.has(i)) { skipped++; continue; }

        // Use the per-row ML/user-selected category; fall back to default offset
        const offsetId = rowCategories.get(i) || defaultOffsetId;

        await createTransaction({
          description: row.description,
          datePosted: row.date,
          notes: row.memo || '',
          currency: 'USD',
          splits: [
            {
              id: generateGuid(),
              accountId: targetAccId,
              value: row.amount,
              quantity: row.amount,
              reconciledState: 'n',
              reconcileDate: null,
              memo: row.memo || '',
              action: '',
              onlineId: row.fitId || null,
            },
            {
              id: generateGuid(),
              accountId: offsetId,
              value: -row.amount,
              quantity: -row.amount,
              reconciledState: 'n',
              reconcileDate: null,
              memo: '',
              action: '',
              onlineId: null,
            },
          ],
        });
        saved++;
      }

      queryClient.invalidateQueries({ queryKey: ['gnucash'] });
      setSavedCount(saved);
      setSkippedCount(skipped);
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Failed to save transactions');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────────

  const reset = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setSelected(new Set());
    setError(null);
    setSavedCount(0);
    setSkippedCount(0);
    setHeaderRowIdx(null);
    setImbalanceAutoSet(false);
    setPredictions([]);
    setRowCategories(new Map());
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const duplicateCount = rows.filter((r) => r.isDuplicate).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="max-w-4xl mx-auto w-full px-6 py-8">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-100">Import Transactions</h2>
          <p className="text-sm text-gray-500 mt-1">
            Import from QFX, OFX, CSV, or Excel files
          </p>
        </div>

        <StepIndicator step={step} />

        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            <AlertTriangle size={14} className="flex-shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={12} /></button>
          </div>
        )}

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Account pickers shown before upload so duplicate detection is accurate */}
            <div className="p-4 bg-gray-800/50 rounded-xl border border-white/5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <AccountSelect
                  accounts={accounts}
                  value={targetAccId}
                  onChange={setTargetAccId}
                  label="Target account (optional — helps with duplicate detection)"
                  placeholder="Select account…"
                  filter={(a) => !a.placeholder && ['BANK','ASSET','CASH','CREDIT','LIABILITY'].includes(a.type)}
                />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Offset / imbalance account</span>
                    {imbalanceAccId && imbalanceAccId === autoOffsetAccId && (
                      <span className="text-xs text-blue-400/70 font-mono">auto-detected</span>
                    )}
                  </div>
                  <AccountSelect
                    accounts={accounts}
                    value={imbalanceAccId}
                    onChange={(v) => { setImbalanceAccId(v); setImbalanceAutoSet(true); }}
                    label=""
                    placeholder="Select account…"
                    filter={(a) => !a.placeholder}
                  />
                </div>
              </div>
              {targetAccId && (
                <RecentTransactions accountId={targetAccId} transactions={transactions} />
              )}
            </div>

            {/* Drop zone */}
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 py-16 cursor-pointer transition-colors',
                dragOver
                  ? 'border-blue-500 bg-blue-500/5'
                  : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
              )}
            >
              {loading
                ? <Loader2 size={32} className="text-blue-400 animate-spin" />
                : <Upload size={32} className="text-gray-600" />
              }
              <div className="text-center">
                <p className="text-gray-300 font-medium">
                  {loading ? 'Parsing file…' : 'Drop a file here or click to browse'}
                </p>
                <p className="text-xs text-gray-600 mt-1">QFX, OFX, CSV, XLSX supported</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={onFileInput}
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Column mapper (CSV only) ── */}
        {step === 'map' && preview?.headers && (
          <div className="bg-gray-800/50 rounded-xl border border-white/5 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={16} className="text-gray-400" />
              <span className="font-medium text-gray-200 text-sm">{file?.name}</span>
              <button onClick={reset} className="ml-auto text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1">
                <RotateCcw size={11} /> Start over
              </button>
            </div>
            <ColumnMapper headers={preview.headers} onConfirm={handleMappingConfirm} />
          </div>
        )}

        {/* ── Step 3: Review ── */}
        {step === 'review' && preview && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-white/5 text-sm flex-wrap">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-gray-400" />
                <span className="text-gray-300 font-medium">{file?.name}</span>
                <span className="text-xs text-gray-600 uppercase tracking-wider bg-gray-700 px-2 py-0.5 rounded">
                  {preview.format}
                </span>
              </div>
              <div className="flex items-center gap-3 ml-auto flex-wrap">
                {/* "Skip top N rows" – lets users fix preamble rows that weren't auto-detected */}
                {(preview.format === 'csv' || preview.format === 'xlsx') && (
                  <label className="flex items-center gap-1.5 text-gray-500 text-xs">
                    Skip top
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={headerRowIdx ?? 0}
                      onChange={(e) => {
                        const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                        setHeaderRowIdx(v);
                        if (file) handleFile(file, v);
                      }}
                      className="w-12 bg-gray-700 border border-white/10 rounded px-1.5 py-0.5 text-white text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    rows
                  </label>
                )}
                <span className="text-gray-400">
                  <span className="text-white font-semibold">{rows.length}</span> transactions
                </span>
                {duplicateCount > 0 && (
                  <span className="text-amber-400">
                    <span className="font-semibold">{duplicateCount}</span> likely duplicates
                  </span>
                )}
                <span className="text-blue-400">
                  <span className="font-semibold">{selected.size}</span> selected to import
                </span>
              </div>
              <button onClick={reset} className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1">
                <RotateCcw size={11} /> Change file
              </button>
            </div>

            {/* Account pickers */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-800/50 rounded-xl border border-white/5">
              <AccountSelect
                accounts={accounts}
                value={targetAccId}
                onChange={setTargetAccId}
                label="Target account *"
                placeholder="Select account…"
                filter={(a) => !a.placeholder && ['BANK','ASSET','CASH','CREDIT','LIABILITY'].includes(a.type)}
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Offset / imbalance account</span>
                  {imbalanceAccId && imbalanceAccId === autoOffsetAccId && (
                    <span className="text-xs text-blue-400/70 font-mono">auto-detected</span>
                  )}
                </div>
                <AccountSelect
                  accounts={accounts}
                  value={imbalanceAccId}
                  onChange={(v) => { setImbalanceAccId(v); setImbalanceAutoSet(true); }}
                  label=""
                  placeholder="Select account…"
                  filter={(a) => !a.placeholder}
                />
              </div>
            </div>

            {/* Transaction table */}
            <div className="border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-gray-900">
                  <tr className="text-xs text-gray-600 border-b border-white/10">
                    <th className="px-4 py-2 w-10">
                      <button onClick={toggleAll} className="text-gray-600 hover:text-gray-300">
                        {allSelected ? <CheckSquare size={14} className="text-blue-400" /> : <Square size={14} />}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-left w-28">Date</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right w-28">Amount</th>
                    <th className="px-3 py-2 text-left w-52">
                      <span className="flex items-center gap-1">
                        <Sparkles size={11} className="text-purple-400" />
                        Category
                      </span>
                    </th>
                    <th className="px-3 py-2 text-left w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isSelected  = selected.has(i);
                    const pred        = predictions[i];
                    const catId       = rowCategories.get(i) ?? pred?.accountId ?? '';
                    const catAcc      = accounts.find((a) => a.id === catId);
                    const confidence  = pred?.confidence ?? 0;
                    const isFallback  = pred?.isFallback ?? true;
                    const isUserPick  = catId !== pred?.accountId;

                    // Confidence dot: green ≥ 0.6, yellow ≥ 0.35, red < 0.35
                    const dotColor = isUserPick
                      ? 'bg-blue-400'
                      : isFallback
                        ? 'bg-gray-600'
                        : confidence >= 0.6
                          ? 'bg-emerald-400'
                          : confidence >= 0.35
                            ? 'bg-yellow-400'
                            : 'bg-red-400';

                    return (
                      <tr
                        key={i}
                        className={cn(
                          'border-b border-white/5 transition-colors',
                          row.isDuplicate && !isSelected && 'opacity-50',
                          isSelected ? 'bg-blue-500/5 hover:bg-blue-500/10' : 'hover:bg-white/[0.02]'
                        )}
                      >
                        <td className="px-4 py-2" onClick={() => toggleRow(i)}>
                          {isSelected
                            ? <CheckSquare size={14} className="text-blue-400 cursor-pointer" />
                            : <Square size={14} className="text-gray-600 cursor-pointer" />
                          }
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 font-mono whitespace-nowrap" onClick={() => toggleRow(i)}>
                          {formatDate(row.date)}
                        </td>
                        <td className="px-3 py-2 text-gray-200 max-w-xs" onClick={() => toggleRow(i)}>
                          <span className="truncate block">{row.description || '—'}</span>
                          {row.memo && row.memo !== row.description && (
                            <span className="text-xs text-gray-600 block truncate">{row.memo}</span>
                          )}
                        </td>
                        <td className={cn(
                          'px-3 py-2 text-right font-mono text-sm',
                          row.amount >= 0 ? 'text-emerald-400' : 'text-red-400'
                        )} onClick={() => toggleRow(i)}>
                          {row.amount >= 0 ? '+' : ''}{formatCurrency(row.amount)}
                        </td>
                        {/* Per-row category select — stops click propagation so row toggle isn't triggered */}
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dotColor)} title={
                              isUserPick ? 'manually set'
                                : isFallback ? 'no match found'
                                  : `${Math.round(confidence * 100)}% confidence`
                            } />
                            <select
                              value={catId}
                              onChange={(e) => setRowCategories((m) => new Map(m).set(i, e.target.value))}
                              className="bg-gray-800 border border-white/10 rounded px-2 py-1 text-xs text-gray-200 outline-none focus:border-blue-500 w-full"
                            >
                              <option value="">— unassigned —</option>
                              {/* Fallback / imbalance at top for easy access */}
                              {(imbalanceAccId || autoOffsetAccId) && (() => {
                                const fallId = imbalanceAccId || autoOffsetAccId!;
                                const fallAcc = accounts.find((a) => a.id === fallId);
                                return fallAcc ? (
                                  <option value={fallId}>{fallAcc.name}</option>
                                ) : null;
                              })()}
                              {GROUP_ORDER.map((type) => {
                                const accsOfType = categoryAccounts
                                  .filter((a) => a.type === type)
                                  .sort((a, b) => a.name.localeCompare(b.name));
                                if (accsOfType.length === 0) return null;
                                return (
                                  <optgroup key={type} label={GROUP_LABELS[type] ?? type}>
                                    {accsOfType.map((a) => (
                                      <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                  </optgroup>
                                );
                              })}
                            </select>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {row.isDuplicate && (
                            <span className="text-xs px-2 py-0.5 bg-amber-500/15 text-amber-400 rounded-full">
                              duplicate
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Confidence legend */}
            {predictions.length > 0 && (
              <div className="flex items-center gap-4 text-xs text-gray-600 px-1">
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> high confidence</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> medium</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-400" /> low</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-gray-600" /> unmatched</span>
                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> manual</span>
              </div>
            )}

            {/* Save button */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || selected.size === 0 || !targetAccId}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {saving
                  ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                  : <><ArrowRight size={14} /> Import {selected.size} transaction{selected.size !== 1 ? 's' : ''}</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center gap-6 py-20">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-100 mb-1">Import complete</h3>
              <p className="text-gray-400 text-sm">
                <span className="text-emerald-400 font-semibold">{savedCount}</span> transaction{savedCount !== 1 ? 's' : ''} imported
                {skippedCount > 0 && (
                  <>, <span className="text-gray-500">{skippedCount} skipped</span></>
                )}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Offsetting splits are in your imbalance account — recategorize them when ready.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded-lg transition-colors"
              >
                <Upload size={14} /> Import another file
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
