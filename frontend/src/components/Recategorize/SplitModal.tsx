import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Check, Plus, Trash2, X } from 'lucide-react';
import type { Account, Transaction, Split } from '../../types';
import { cn, formatCurrency, generateGuid, getAccountPath } from '../../lib/utils';

const TOLERANCE = 0.01;

interface SplitEdit {
  splitId: string | null;
  accountId: string;
  value: number;
  memo: string;
}

interface SplitModalProps {
  transaction: Transaction;
  accounts: Account[];
  categorizableAccounts: Account[];
  onSave: (newSplits: Split[]) => void;
  onCancel: () => void;
}

function SplitModalAccountPicker({
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

  const pickerAccounts = useMemo(() =>
    accounts.map((a) => ({ ...a, path: getAccountPath(a.id, accounts) })).sort((a, b) => a.path.localeCompare(b.path)),
    [accounts]
  );

  const filtered = q
    ? pickerAccounts.filter((a) => a.path.toLowerCase().includes(q.toLowerCase()))
    : pickerAccounts;

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
                a.id === currentId ? 'text-blue-400 bg-blue-500/10' : 'text-gray-300 hover:bg-white/5'
              )}
            >
              {a.path}
              {a.id === currentId && <Check size={11} />}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function editsToSplits(edits: SplitEdit[], transaction: Transaction): Split[] {
  const splitMap = new Map(transaction.splits.map((s) => [s.id, s]));
  return edits.map((edit) => {
    const existing = edit.splitId ? splitMap.get(edit.splitId) : null;
    if (existing) {
      return {
        ...existing,
        accountId: edit.accountId,
        value: edit.value,
        quantity: edit.value,
        memo: edit.memo,
      };
    }
    return {
      id: generateGuid(),
      accountId: edit.accountId,
      value: edit.value,
      quantity: edit.value,
      reconciledState: 'n' as const,
      reconcileDate: null,
      memo: edit.memo,
      action: '',
      onlineId: null,
    };
  });
}

export function SplitModal({
  transaction,
  accounts,
  categorizableAccounts,
  onSave,
  onCancel,
}: SplitModalProps) {
  const expectedTotal = useMemo(() => {
    const sourceTypes = new Set(['BANK', 'CASH', 'CREDIT', 'EQUITY', 'ROOT']);
    return transaction.splits
      .filter((s) => {
        const acc = accounts.find((a) => a.id === s.accountId);
        return acc && !sourceTypes.has(acc.type) && !acc.placeholder;
      })
      .reduce((sum, s) => sum + s.value, 0);
  }, [transaction, accounts]);

  const initialEdits: SplitEdit[] = useMemo(() => {
    const sourceTypes = new Set(['BANK', 'CASH', 'CREDIT', 'EQUITY', 'ROOT']);
    return transaction.splits
      .filter((s) => {
        const acc = accounts.find((a) => a.id === s.accountId);
        return acc && !sourceTypes.has(acc.type) && !acc.placeholder;
      })
      .map((s) => ({
        splitId: s.id,
        accountId: s.accountId,
        value: s.value,
        memo: s.memo || '',
      }));
  }, [transaction, accounts]);

  const [edits, setEdits] = useState<SplitEdit[]>(initialEdits);
  const [openPickerIdx, setOpenPickerIdx] = useState<number | null>(null);
  const pickerRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (openPickerIdx !== null) setOpenPickerIdx(null);
        else onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, openPickerIdx]);

  const currentTotal = edits.reduce((sum, e) => sum + e.value, 0);
  const isValid =
    edits.length >= 1 &&
    edits.every((e) => e.value !== 0 && e.accountId) &&
    Math.abs(currentTotal - expectedTotal) < TOLERANCE;

  const handleAddLine = () => {
    const defaultAccId = categorizableAccounts[0]?.id ?? '';
    setEdits((prev) => [
      ...prev,
      { splitId: null, accountId: defaultAccId, value: 0, memo: '' },
    ]);
  };

  const handleRemove = (idx: number) => {
    if (edits.length <= 1) return;
    setEdits((prev) => prev.filter((_, i) => i !== idx));
    if (openPickerIdx === idx) setOpenPickerIdx(null);
    else if (openPickerIdx !== null && openPickerIdx > idx) setOpenPickerIdx(openPickerIdx - 1);
  };

  const handleAccountChange = (idx: number, acc: Account) => {
    setEdits((prev) => prev.map((e, i) => (i === idx ? { ...e, accountId: acc.id } : e)));
    setOpenPickerIdx(null);
  };

  // Debit column: user types a positive number → stored as negative value (money out)
  const handleDebitChange = (idx: number, raw: string) => {
    const abs = parseFloat(raw);
    if (isNaN(abs) || raw === '') {
      setEdits((prev) => prev.map((e, i) => (i === idx ? { ...e, value: 0 } : e)));
    } else {
      setEdits((prev) => prev.map((e, i) => (i === idx ? { ...e, value: -Math.abs(abs) } : e)));
    }
  };

  // Credit column: user types a positive number → stored as positive value (money in)
  const handleCreditChange = (idx: number, raw: string) => {
    const abs = parseFloat(raw);
    if (isNaN(abs) || raw === '') {
      setEdits((prev) => prev.map((e, i) => (i === idx ? { ...e, value: 0 } : e)));
    } else {
      setEdits((prev) => prev.map((e, i) => (i === idx ? { ...e, value: Math.abs(abs) } : e)));
    }
  };

  const handleSave = () => {
    if (!isValid) return;
    const splits = editsToSplits(edits, transaction);
    onSave(splits);
  };

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="w-full max-w-xl bg-gray-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-semibold text-gray-100 text-sm">Split Transaction</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-3 max-h-[60vh] overflow-auto">
          <p className="text-xs text-gray-500 truncate">{transaction.description || 'No description'}</p>

          <table className="w-full text-xs table-fixed">
            <colgroup>
              <col className="w-auto" />
              <col className="w-24" />
              <col className="w-24" />
              <col className="w-8" />
            </colgroup>
            <thead>
              <tr className="border-b border-white/10">
                <th className="pb-1.5 text-left font-medium text-gray-500">Category</th>
                <th className="pb-1.5 text-right font-medium text-red-400">Debit</th>
                <th className="pb-1.5 text-right font-medium text-emerald-400">Credit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {edits.map((edit, idx) => {
                const isDebit = edit.value < 0;
                const isCredit = edit.value > 0;
                return (
                  <tr key={idx} className="border-b border-white/5 last:border-0">
                    <td className="py-1.5 pr-2">
                      <div className="relative">
                        <button
                          ref={(el) => { pickerRefs.current[idx] = el; }}
                          type="button"
                          onClick={() => setOpenPickerIdx(openPickerIdx === idx ? null : idx)}
                          className={cn(
                            'w-full text-left px-3 py-1.5 rounded text-xs border transition-colors',
                            'bg-gray-800 border-white/10 text-gray-300 hover:border-blue-500/50'
                          )}
                        >
                          {accountMap.get(edit.accountId)?.name ?? 'Select category…'}
                        </button>
                        {openPickerIdx === idx && (
                          <SplitModalAccountPicker
                            accounts={categorizableAccounts}
                            currentId={edit.accountId}
                            onSelect={(acc) => handleAccountChange(idx, acc)}
                            onClose={() => setOpenPickerIdx(null)}
                            anchorRef={pickerRefs.current[idx] as React.RefObject<HTMLElement>}
                          />
                        )}
                      </div>
                    </td>

                    {/* Debit column — negative value, shown in red */}
                    <td className="py-1.5 pr-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={isDebit ? Math.abs(edit.value) : ''}
                        onChange={(e) => handleDebitChange(idx, e.target.value)}
                        onFocus={() => {
                          if (!isDebit) setEdits((prev) => prev.map((e, i) => i === idx ? { ...e, value: -0.01 } : e));
                        }}
                        placeholder="—"
                        className="w-full px-2 py-1.5 bg-gray-800 border border-white/10 rounded text-xs text-right font-mono text-red-400 outline-none focus:border-red-500/60 placeholder-gray-700"
                      />
                    </td>

                    {/* Credit column — positive value, shown in green */}
                    <td className="py-1.5 pr-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={isCredit ? edit.value : ''}
                        onChange={(e) => handleCreditChange(idx, e.target.value)}
                        onFocus={() => {
                          if (!isCredit) setEdits((prev) => prev.map((e, i) => i === idx ? { ...e, value: 0.01 } : e));
                        }}
                        placeholder="—"
                        className="w-full px-2 py-1.5 bg-gray-800 border border-white/10 rounded text-xs text-right font-mono text-emerald-400 outline-none focus:border-emerald-500/60 placeholder-gray-700"
                      />
                    </td>

                    <td className="py-1.5 text-center">
                      <button
                        onClick={() => handleRemove(idx)}
                        disabled={edits.length <= 1}
                        className={cn(
                          'p-1 rounded text-gray-600 hover:text-red-400 transition-colors',
                          edits.length <= 1 && 'opacity-40 cursor-not-allowed'
                        )}
                        title="Remove"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button
            onClick={handleAddLine}
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
          >
            <Plus size={14} />
            Add line
          </button>

          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
            <span className="text-gray-500">Total:</span>
            <span className={cn(
              'font-mono',
              Math.abs(currentTotal - expectedTotal) < TOLERANCE ? 'text-emerald-400' : 'text-red-400'
            )}>
              {formatCurrency(Math.abs(currentTotal))}
            </span>
            <span className="text-gray-500">Expected: {formatCurrency(Math.abs(expectedTotal))}</span>
          </div>

          {edits.length < 1 && (
            <p className="text-xs text-red-400">Add at least one category.</p>
          )}
          {edits.length >= 1 && Math.abs(currentTotal - expectedTotal) >= TOLERANCE && (
            <p className="text-xs text-red-400">
              Amounts must sum to {formatCurrency(Math.abs(expectedTotal))}.
            </p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/10 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 rounded-lg border border-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
