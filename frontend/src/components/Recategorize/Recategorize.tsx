import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, ArrowRight, Check, RotateCcw, Save, History,
  ChevronDown, X, AlertCircle, CheckSquare, Square,
} from 'lucide-react';
import type { Account, Transaction, Split } from '../../types';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { updateTransaction, fetchChangeLog } from '../../lib/api';
import type { ChangeLogEntry } from '../../lib/api';

interface RecategorizeProps {
  accounts: Account[];
  transactions: Transaction[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StagedChange {
  txn: Transaction;
  /** The split being recategorized */
  splitId: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Account picker dropdown
// ─────────────────────────────────────────────────────────────────────────────

function AccountPicker({
  accounts,
  currentId,
  onSelect,
  onClose,
  anchorRef,
}: {
  accounts: Account[];
  currentId: string;
  onSelect: (acc: Account) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
}) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  const expenseAccounts = useMemo(() =>
    accounts
      .filter((a) => a.type === 'EXPENSE' && !a.placeholder)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [accounts]
  );

  const filtered = q
    ? expenseAccounts.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()))
    : expenseAccounts;

  return (
    <div
      ref={containerRef}
      className="absolute z-50 mt-1 w-64 bg-gray-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden"
    >
      <div className="p-2 border-b border-white/10">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search accounts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full bg-gray-800 border border-white/10 rounded pl-7 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          />
        </div>
      </div>
      <div className="overflow-auto max-h-56 py-1">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-gray-600">No accounts found</p>
        ) : (
          filtered.map((a) => (
            <button
              key={a.id}
              onClick={() => { onSelect(a); onClose(); }}
              className={cn(
                'w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between',
                a.id === currentId
                  ? 'text-blue-400 bg-blue-500/10'
                  : 'text-gray-300 hover:bg-white/5'
              )}
            >
              {a.name}
              {a.id === currentId && <Check size={11} />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category cell — shows current category with inline picker
// ─────────────────────────────────────────────────────────────────────────────

function CategoryCell({
  currentAccount,
  pendingAccount,
  accounts,
  onSelect,
}: {
  currentAccount: Account | undefined;
  pendingAccount: Account | undefined;
  accounts: Account[];
  onSelect: (acc: Account) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const hasPending = pendingAccount && pendingAccount.id !== currentAccount?.id;

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors group',
          hasPending
            ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
            : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'
        )}
      >
        <span className="max-w-[140px] truncate">
          {hasPending ? pendingAccount.name : (currentAccount?.name ?? '?')}
        </span>
        <ChevronDown size={10} className="flex-shrink-0" />
      </button>
      {open && (
        <AccountPicker
          accounts={accounts}
          currentId={pendingAccount?.id ?? currentAccount?.id ?? ''}
          onSelect={onSelect}
          onClose={() => setOpen(false)}
          anchorRef={anchorRef as React.RefObject<HTMLElement>}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk recategorize bar
// ─────────────────────────────────────────────────────────────────────────────

function BulkBar({
  count,
  accounts,
  onApply,
  onClear,
}: {
  count: number;
  accounts: Account[];
  onApply: (acc: Account) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-blue-600/15 border-b border-blue-500/30">
      <CheckSquare size={14} className="text-blue-400" />
      <span className="text-sm text-blue-300 font-medium">
        {count} transaction{count !== 1 ? 's' : ''} selected
      </span>
      <div className="relative">
        <button
          ref={anchorRef}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors"
        >
          <ArrowRight size={12} />
          Recategorize all to…
        </button>
        {open && (
          <AccountPicker
            accounts={accounts}
            currentId=""
            onSelect={(acc) => { onApply(acc); setOpen(false); }}
            onClose={() => setOpen(false)}
            anchorRef={anchorRef as React.RefObject<HTMLElement>}
          />
        )}
      </div>
      <button
        onClick={onClear}
        className="ml-auto text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
      >
        <X size={12} /> Clear selection
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending changes floating bar
// ─────────────────────────────────────────────────────────────────────────────

function PendingBar({
  changes,
  onSave,
  onUndo,
  saving,
}: {
  changes: StagedChange[];
  onSave: () => void;
  onUndo: (txnId: string, splitId: string) => void;
  saving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (changes.length === 0) return null;

  return (
    <div className="border-t border-amber-500/30 bg-amber-500/10 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2">
        <AlertCircle size={14} className="text-amber-400 flex-shrink-0" />
        <button
          className="flex-1 text-left text-sm text-amber-300 font-medium flex items-center gap-1"
          onClick={() => setExpanded((e) => !e)}
        >
          {changes.length} unsaved change{changes.length !== 1 ? 's' : ''}
          <ChevronDown size={12} className={cn('transition-transform', expanded && 'rotate-180')} />
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-gray-950 text-xs font-semibold rounded-lg transition-colors"
        >
          <Save size={12} />
          {saving ? 'Saving…' : `Save ${changes.length} change${changes.length !== 1 ? 's' : ''}`}
        </button>
        <button
          onClick={() => changes.forEach((c) => onUndo(c.txn.id, c.splitId))}
          className="text-xs text-amber-500 hover:text-amber-300 flex items-center gap-1"
          title="Undo all"
        >
          <RotateCcw size={12} /> Undo all
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-amber-500/20 max-h-40 overflow-auto">
          {changes.map((c) => (
            <div key={`${c.txn.id}-${c.splitId}`}
              className="flex items-center gap-3 px-4 py-1.5 text-xs border-b border-amber-500/10 last:border-0">
              <span className="text-gray-400 font-mono w-20 flex-shrink-0">{formatDate(c.txn.datePosted)}</span>
              <span className="flex-1 truncate text-gray-300">{c.txn.description || '—'}</span>
              <span className="text-amber-400 flex-shrink-0">{c.fromAccountName}</span>
              <ArrowRight size={10} className="text-gray-600 flex-shrink-0" />
              <span className="text-emerald-400 flex-shrink-0">{c.toAccountName}</span>
              <button
                onClick={() => onUndo(c.txn.id, c.splitId)}
                className="text-gray-600 hover:text-red-400 ml-1 flex-shrink-0"
                title="Undo this change"
              >
                <RotateCcw size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Log panel
// ─────────────────────────────────────────────────────────────────────────────

function LogPanel({ entries }: { entries: ChangeLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-sm gap-1">
        <History size={24} className="opacity-30" />
        <p>No recategorizations yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-900 z-10">
          <tr className="text-xs text-gray-600 border-b border-white/10">
            <th className="px-4 py-2 text-left">Changed</th>
            <th className="px-4 py-2 text-left">Date</th>
            <th className="px-4 py-2 text-left">Description</th>
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2 text-left">From</th>
            <th className="px-4 py-2 text-left">To</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={`${e.transGuid}-${e.splitGuid}-${i}`} className="border-b border-white/5 hover:bg-white/3">
              <td className="px-4 py-2 text-xs text-gray-600 font-mono whitespace-nowrap">
                {e.changedAt
                  ? new Date(e.changedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                  : '—'}
              </td>
              <td className="px-4 py-2 text-xs text-gray-500 font-mono">{formatDate(e.datePosted)}</td>
              <td className="px-4 py-2 text-gray-300 max-w-xs truncate">{e.description || '—'}</td>
              <td className="px-4 py-2 text-right font-mono text-sm text-orange-400">{formatCurrency(e.amount)}</td>
              <td className="px-4 py-2 text-xs text-amber-400">{e.fromAccountName}</td>
              <td className="px-4 py-2 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <ArrowRight size={10} className="text-gray-600" />
                  {e.toAccountName}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const EXPENSE_TYPES = new Set(['EXPENSE']);
const ASSET_TYPES   = new Set(['ASSET', 'BANK', 'CASH', 'CREDIT', 'LIABILITY', 'PAYABLE', 'RECEIVABLE']);

export function Recategorize({ accounts, transactions }: RecategorizeProps) {
  const queryClient = useQueryClient();

  // Filters
  const [searchQ,    setSearchQ]    = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo,   setFilterTo]   = useState('');
  const [filterAccId, setFilterAccId] = useState('');
  const [showLog,    setShowLog]    = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set()); // txnId|splitId

  // Staged changes: txnId|splitId → StagedChange
  const [staged, setStaged] = useState<Map<string, StagedChange>>(new Map());
  const [saving, setSaving] = useState(false);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const { data: logEntries = [] } = useQuery({
    queryKey: ['change-log'],
    queryFn: fetchChangeLog,
  });

  // Build list: one row per (transaction, expense-split)
  const rows = useMemo(() => {
    const cutoff = (() => {
      if (filterFrom) return filterFrom;
      return ''; // no cutoff if no filter
    })();

    return transactions
      .filter((t) => {
        if (filterFrom && t.datePosted < filterFrom) return false;
        if (filterTo   && t.datePosted > filterTo)   return false;
        if (searchQ) {
          const q = searchQ.toLowerCase();
          if (!t.description.toLowerCase().includes(q) &&
              !t.splits.some((s) => s.memo.toLowerCase().includes(q))) return false;
        }
        return true;
      })
      .flatMap((txn) => {
        const expenseSplits = txn.splits.filter((s) => {
          const acc = accountMap.get(s.accountId);
          return acc && EXPENSE_TYPES.has(acc.type);
        });
        return expenseSplits
          .filter((s) => {
            if (filterAccId && s.accountId !== filterAccId) return false;
            return true;
          })
          .map((s) => ({ txn, split: s }));
      })
      .sort((a, b) => b.txn.datePosted.localeCompare(a.txn.datePosted));
  }, [transactions, accountMap, filterFrom, filterTo, searchQ, filterAccId]);

  // Expense accounts for filter dropdown
  const expenseAccounts = useMemo(() =>
    accounts.filter((a) => EXPENSE_TYPES.has(a.type) && !a.placeholder)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [accounts]
  );

  function rowKey(txnId: string, splitId: string) { return `${txnId}|${splitId}`; }

  function stageChange(txn: Transaction, split: Split, toAccount: Account) {
    const fromAccount = accountMap.get(split.accountId);
    if (!fromAccount || fromAccount.id === toAccount.id) return;
    const key = rowKey(txn.id, split.id);
    setStaged((prev) => new Map(prev).set(key, {
      txn,
      splitId: split.id,
      fromAccountId: fromAccount.id,
      fromAccountName: fromAccount.name,
      toAccountId: toAccount.id,
      toAccountName: toAccount.name,
    }));
  }

  function undoChange(txnId: string, splitId: string) {
    const key = rowKey(txnId, splitId);
    setStaged((prev) => { const m = new Map(prev); m.delete(key); return m; });
  }

  function applyBulk(toAccount: Account) {
    setStaged((prev) => {
      const m = new Map(prev);
      for (const { txn, split } of rows) {
        const k = rowKey(txn.id, split.id);
        if (selected.has(k)) {
          const fromAccount = accountMap.get(split.accountId);
          if (fromAccount && fromAccount.id !== toAccount.id) {
            m.set(k, {
              txn, splitId: split.id,
              fromAccountId: fromAccount.id, fromAccountName: fromAccount.name,
              toAccountId: toAccount.id, toAccountName: toAccount.name,
            });
          }
        }
      }
      return m;
    });
    setSelected(new Set());
  }

  const stagedList = Array.from(staged.values());

  async function saveChanges() {
    setSaving(true);
    try {
      for (const change of stagedList) {
        const newSplits = change.txn.splits.map((s) =>
          s.id === change.splitId ? { ...s, accountId: change.toAccountId } : s
        );
        await updateTransaction(change.txn.id, { ...change.txn, splits: newSplits });
      }
      // Invalidate both the main data and the change log (re-read from .log files)
      queryClient.invalidateQueries({ queryKey: ['gnucash'] });
      queryClient.invalidateQueries({ queryKey: ['change-log'] });
      setStaged(new Map());
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  }

  function toggleSelectAll() {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map(({ txn, split }) => rowKey(txn.id, split.id))));
    }
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3 flex-wrap flex-shrink-0">
        <h2 className="font-semibold text-gray-100 text-sm whitespace-nowrap">Recategorize Expenses</h2>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search descriptions…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="bg-gray-800 border border-white/10 rounded pl-8 pr-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500 w-52"
          />
        </div>

        {/* Category filter */}
        <select
          value={filterAccId}
          onChange={(e) => setFilterAccId(e.target.value)}
          className="bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-blue-500 max-w-[180px]"
        >
          <option value="">All categories</option>
          {expenseAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Date range */}
        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
          className="bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-blue-500" />
        <span className="text-gray-600 text-xs">to</span>
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
          className="bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-blue-500" />

        {(searchQ || filterAccId || filterFrom || filterTo) && (
          <button
            onClick={() => { setSearchQ(''); setFilterAccId(''); setFilterFrom(''); setFilterTo(''); }}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
          >
            <X size={12} /> Clear
          </button>
        )}

        <div className="flex-1" />
        <span className="text-xs text-gray-600">{rows.length} transactions</span>

        <button
          onClick={() => setShowLog((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors',
            showLog
              ? 'bg-gray-700 text-gray-200 border-gray-600'
              : 'text-gray-500 hover:text-gray-300 border-white/10'
          )}
        >
          <History size={13} />
          History {logEntries.length > 0 && `(${logEntries.length})`}
        </button>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          accounts={accounts}
          onApply={applyBulk}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Transaction table */}
        <div className={cn('flex flex-col overflow-hidden', showLog ? 'flex-1' : 'w-full')}>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-gray-950 z-10">
                <tr className="text-xs text-gray-600 border-b border-white/10">
                  <th className="px-4 py-2 w-10">
                    <button onClick={toggleSelectAll} className="text-gray-600 hover:text-gray-300">
                      {allSelected ? <CheckSquare size={14} className="text-blue-400" /> : <Square size={14} />}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left w-28">Date</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right w-28">Amount</th>
                  <th className="px-3 py-2 text-left w-52">Category</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ txn, split }) => {
                  const key = rowKey(txn.id, split.id);
                  const change = staged.get(key);
                  const currentAcc = accountMap.get(split.accountId);
                  const pendingAcc = change ? accountMap.get(change.toAccountId) : undefined;
                  const isSelected = selected.has(key);
                  const isChanged = !!change;

                  return (
                    <tr
                      key={key}
                      className={cn(
                        'border-b border-white/5 group transition-colors',
                        isSelected && 'bg-blue-500/5',
                        isChanged && !isSelected && 'bg-amber-500/5',
                        !isSelected && !isChanged && 'hover:bg-white/[0.02]'
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <button onClick={() => toggleSelect(key)} className="text-gray-600 hover:text-gray-300">
                          {isSelected
                            ? <CheckSquare size={14} className="text-blue-400" />
                            : <Square size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">
                        {formatDate(txn.datePosted)}
                      </td>
                      <td className="px-3 py-2.5 max-w-xs">
                        <span className="text-gray-200 truncate block">
                          {txn.description || <span className="italic text-gray-600">No description</span>}
                        </span>
                        {split.memo && <span className="text-xs text-gray-600">{split.memo}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-orange-400 text-sm">
                        {formatCurrency(Math.abs(split.value))}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {isChanged && (
                            <span className="text-xs text-gray-600 line-through whitespace-nowrap max-w-[80px] truncate">
                              {currentAcc?.name}
                            </span>
                          )}
                          <CategoryCell
                            currentAccount={currentAcc}
                            pendingAccount={isChanged ? pendingAcc : undefined}
                            accounts={accounts}
                            onSelect={(acc) => stageChange(txn, split, acc)}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {isChanged && (
                          <button
                            onClick={() => undoChange(txn.id, split.id)}
                            className="text-gray-600 hover:text-amber-400 transition-colors"
                            title="Undo"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {rows.length === 0 && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-sm">
                <p>No transactions match the current filters</p>
              </div>
            )}
          </div>

          {/* Pending changes bar */}
          <PendingBar
            changes={stagedList}
            onSave={saveChanges}
            onUndo={undoChange}
            saving={saving}
          />
        </div>

        {/* History panel */}
        {showLog && (
          <div className="w-[480px] flex-shrink-0 border-l border-white/10 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <History size={14} className="text-gray-400" />
              <span className="font-medium text-sm text-gray-300">Change History</span>
              <span className="ml-auto text-xs text-gray-600">{logEntries.length} entries</span>
            </div>
            <div className="flex-1 overflow-auto">
              <LogPanel entries={logEntries} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
