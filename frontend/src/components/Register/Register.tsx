import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Check, ArrowUpDown, ChevronUp, ChevronDown,
  CheckCircle, Circle, Clock
} from 'lucide-react';
import type { Account, Transaction, Split } from '../../types';
import {
  cn, formatCurrency, formatDate, generateGuid, getAccountDisplayBalance, getAccountPath
} from '../../lib/utils';
import { createTransaction, updateTransaction, deleteTransaction } from '../../lib/api';

interface RegisterProps {
  account: Account;
  accounts: Account[];
  transactions: Transaction[];
}

interface RegisterRow {
  txn: Transaction;
  split: Split;
  otherSplits: Split[];
  runningBalance: number;
}

type SortField = 'date' | 'description' | 'amount' | 'balance';
type SortDir = 'asc' | 'desc';

function ReconcileIcon({ state }: { state: string }) {
  if (state === 'y') return <CheckCircle size={13} className="text-emerald-400" title="Reconciled" />;
  if (state === 'c') return <Check size={13} className="text-blue-400" title="Cleared" />;
  return <Circle size={13} className="text-gray-600" title="Not reconciled" />;
}

function getColumnLabels(accountType: string): {
  left: string; right: string;
  leftColor: string; rightColor: string;
} {
  switch (accountType) {
    case 'INCOME':
      return { left: 'Income', right: 'Charge', leftColor: 'text-emerald-400', rightColor: 'text-red-400' };
    case 'EXPENSE':
      return { left: 'Rebate', right: 'Expense', leftColor: 'text-emerald-400', rightColor: 'text-orange-400' };
    case 'LIABILITY':
    case 'CREDIT':
    case 'PAYABLE':
      return { left: 'Payment', right: 'Charge', leftColor: 'text-emerald-400', rightColor: 'text-red-400' };
    case 'EQUITY':
      return { left: 'Increase', right: 'Decrease', leftColor: 'text-emerald-400', rightColor: 'text-red-400' };
    default:
      return { left: 'Withdrawal', right: 'Deposit', leftColor: 'text-red-400', rightColor: 'text-emerald-400' };
  }
}

function getTransferLabel(otherSplits: Split[], accounts: Account[]): string {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  if (otherSplits.length === 0) return '--';
  if (otherSplits.length === 1) {
    return accountMap.get(otherSplits[0].accountId)?.name ?? '?';
  }
  return 'Split Transaction';
}

function EditableCell({
  value,
  displayValue,
  onSave,
  type = 'text',
  className,
  options,
}: {
  value: string;
  displayValue?: string;
  onSave: (v: string) => void;
  type?: 'text' | 'date' | 'number' | 'select';
  className?: string;
  options?: { value: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (val !== value) onSave(val);
  };

  if (!editing) {
    return (
      <span
        className={cn('cursor-pointer hover:bg-white/5 rounded px-1 py-0.5 block', className)}
        onDoubleClick={() => setEditing(true)}
      >
        {(displayValue ?? value) || <span className="text-gray-600 italic">—</span>}
      </span>
    );
  }

  if (type === 'select' && options) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={val}
        className={cn(
          'bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-sm w-full outline-none',
          className
        )}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={type}
      value={val}
      className={cn(
        'bg-gray-800 border border-blue-500 rounded px-1 py-0.5 text-sm w-full outline-none',
        className
      )}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value); setEditing(false); } }}
    />
  );
}

export function Register({ account, accounts, transactions }: RegisterProps) {
  const queryClient = useQueryClient();
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filter, setFilter] = useState('');

  const accountTxns = useMemo(() => {
    return transactions.filter((t) =>
      t.splits.some((s) => s.accountId === account.id)
    );
  }, [transactions, account.id]);

  const sortedRows = useMemo(() => {
    let rows = [...accountTxns];

    if (filter) {
      const q = filter.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.notes.toLowerCase().includes(q) ||
          t.splits.some((s) => s.memo.toLowerCase().includes(q))
      );
    }

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        cmp = a.datePosted.localeCompare(b.datePosted);
      } else if (sortField === 'description') {
        cmp = a.description.localeCompare(b.description);
      } else if (sortField === 'amount') {
        const aAmt = a.splits.find((s) => s.accountId === account.id)?.value ?? 0;
        const bAmt = b.splits.find((s) => s.accountId === account.id)?.value ?? 0;
        cmp = aAmt - bAmt;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    // Build running balance — sum ALL splits for this account (not just the first),
    // so the register total matches computeAccountBalances in the sidebar.
    let running = 0;
    const builtRows: RegisterRow[] = rows.map((txn) => {
      const accountSplits = txn.splits.filter((s) => s.accountId === account.id);
      const otherSplits   = txn.splits.filter((s) => s.accountId !== account.id);
      const netValue = accountSplits.reduce((sum, s) => sum + s.value, 0);
      // Primary split used for display (memo, reconcile state, etc.)
      const split = { ...accountSplits[0], value: netValue, quantity: netValue };
      running += netValue;
      return { txn, split, otherSplits, runningBalance: running };
    });

    return builtRows;
  }, [accountTxns, sortField, sortDir, filter, account.id]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Transaction> }) =>
      updateTransaction(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gnucash'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gnucash'] }),
  });

  const createMutation = useMutation({
    mutationFn: (txn: Omit<Transaction, 'id' | 'dateEntered'>) =>
      createTransaction(txn),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gnucash'] }),
  });

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function handleUpdateDescription(txn: Transaction, value: string) {
    updateMutation.mutate({ id: txn.id, data: { ...txn, description: value } });
  }

  function handleUpdateDate(txn: Transaction, value: string) {
    updateMutation.mutate({ id: txn.id, data: { ...txn, datePosted: value } });
  }

  function handleUpdateTransfer(txn: Transaction, newAccountId: string) {
    if (txn.splits.length !== 2) return;
    const newSplits = txn.splits.map((s) =>
      s.accountId !== account.id ? { ...s, accountId: newAccountId } : s
    );
    updateMutation.mutate({ id: txn.id, data: { ...txn, splits: newSplits } });
  }

  function handleUpdateAmount(txn: Transaction, split: Split, rawValue: string) {
    const newAmount = parseFloat(rawValue.replace(/[$,]/g, ''));
    if (isNaN(newAmount)) return;
    const newSplits = txn.splits.map((s) => {
      if (s.id === split.id) return { ...s, value: newAmount, quantity: newAmount };
      // Adjust counterpart split
      if (txn.splits.length === 2) {
        return { ...s, value: -newAmount, quantity: -newAmount };
      }
      return s;
    });
    updateMutation.mutate({ id: txn.id, data: { ...txn, splits: newSplits } });
  }

  function handleAddTransaction() {
    const today = new Date().toISOString().slice(0, 10);
    const imbalanceAcc = accounts.find((a) => a.name === 'Imbalance-USD') ??
      accounts.find((a) => a.type === 'BANK' && a.id !== account.id) ??
      accounts[0];

    createMutation.mutate({
      description: 'New Transaction',
      datePosted: today,
      notes: '',
      currency: 'USD',
      splits: [
        { id: generateGuid(), accountId: account.id, value: 0, quantity: 0, reconciledState: 'n', reconcileDate: null, memo: '', action: '', onlineId: null },
        { id: generateGuid(), accountId: imbalanceAcc.id, value: 0, quantity: 0, reconciledState: 'n', reconcileDate: null, memo: '', action: '', onlineId: null },
      ],
    });
  }

  function SortHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    const active = sortField === field;
    return (
      <button
        className={cn(
          'flex items-center gap-1 hover:text-gray-200 transition-colors',
          active ? 'text-blue-400' : 'text-gray-500'
        )}
        onClick={() => handleSort(field)}
      >
        {children}
        {active ? (
          sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
        ) : (
          <ArrowUpDown size={11} className="opacity-40" />
        )}
      </button>
    );
  }

  const displayBalance = getAccountDisplayBalance(
    sortedRows[sortedRows.length - 1]?.runningBalance ?? 0,
    account.type
  );

  const accountOptions = accounts
    .filter((a) => a.type !== 'ROOT' && !a.placeholder)
    .map((a) => ({ value: a.id, label: getAccountPath(a.id, accounts) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const colLabels = getColumnLabels(account.type);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h2 className="font-semibold text-gray-100">{account.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{sortedRows.length} transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Balance</p>
            <p className={cn('font-mono font-semibold', displayBalance < 0 ? 'text-red-400' : 'text-emerald-400')}>
              {formatCurrency(displayBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
        <input
          type="text"
          placeholder="Filter transactions…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-gray-800 border border-white/10 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500 w-64"
        />
        <button
          onClick={handleAddTransaction}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors"
        >
          <Plus size={14} />
          Add Transaction
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="text-xs border-b border-white/10">
              <th className="px-3 py-2 text-left w-8"></th>
              <th className="px-3 py-2 text-left w-32">
                <SortHeader field="date">Date</SortHeader>
              </th>
              <th className="px-3 py-2 text-left">
                <SortHeader field="description">Description</SortHeader>
              </th>
              <th className="px-3 py-2 text-left w-40">Transfer</th>
              <th className="px-3 py-2 text-right w-28">
                <SortHeader field="amount">{colLabels.left}</SortHeader>
              </th>
              <th className="px-3 py-2 text-right w-28">{colLabels.right}</th>
              <th className="px-3 py-2 text-right w-32">Balance</th>
              <th className="px-3 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map(({ txn, split, otherSplits, runningBalance }, i) => {
              const amount = split.value;
              const displayRunning = getAccountDisplayBalance(runningBalance, account.type);

              return (
                <tr
                  key={txn.id}
                  className={cn(
                    'border-b border-white/5 hover:bg-white/3 group',
                    i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'
                  )}
                >
                  <td className="px-3 py-2 text-center">
                    <ReconcileIcon state={split.reconciledState} />
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-400 text-xs">
                    <EditableCell
                      value={txn.datePosted}
                      type="date"
                      onSave={(v) => handleUpdateDate(txn, v)}
                    />
                  </td>
                  <td className="px-3 py-2 max-w-xs">
                    <EditableCell
                      value={txn.description}
                      onSave={(v) => handleUpdateDescription(txn, v)}
                      className="text-gray-200"
                    />
                    {split.memo && (
                      <p className="text-xs text-gray-600 px-1">{split.memo}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {otherSplits.length === 1 ? (
                      <EditableCell
                        value={otherSplits[0].accountId}
                        displayValue={accounts.find((a) => a.id === otherSplits[0].accountId)?.name}
                        type="select"
                        options={accountOptions}
                        onSave={(v) => handleUpdateTransfer(txn, v)}
                      />
                    ) : (
                      getTransferLabel(otherSplits, accounts)
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <EditableCell
                      value={amount <= 0 ? Math.abs(amount).toFixed(2) : ''}
                      type="number"
                      onSave={(v) => handleUpdateAmount(txn, split, v ? '-' + v : '0')}
                      className={cn(colLabels.leftColor, 'font-mono text-right')}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <EditableCell
                      value={amount > 0 ? amount.toFixed(2) : ''}
                      type="number"
                      onSave={(v) => handleUpdateAmount(txn, split, v || '0')}
                      className={cn(colLabels.rightColor, 'font-mono text-right')}
                    />
                  </td>
                  <td className={cn(
                    'px-3 py-2 text-right font-mono text-xs',
                    displayRunning < 0 ? 'text-red-400' : 'text-gray-400'
                  )}>
                    {formatCurrency(displayRunning)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => deleteMutation.mutate(txn.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedRows.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            No transactions found
          </div>
        )}
      </div>
    </div>
  );
}
