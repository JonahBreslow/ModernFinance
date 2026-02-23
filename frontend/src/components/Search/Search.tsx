import { useState, useMemo } from 'react';
import { Search as SearchIcon, ExternalLink } from 'lucide-react';
import type { Account, Transaction } from '../../types';
import { cn, formatCurrency, formatDate, getAccountPath } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';

interface SearchProps {
  accounts: Account[];
  transactions: Transaction[];
}

export function Search({ accounts, transactions }: SearchProps) {
  const { setSelectedAccount } = useAppStore();
  const [query, setQuery] = useState('');
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAmountMin, setFilterAmountMin] = useState('');
  const [filterAmountMax, setFilterAmountMax] = useState('');

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const amtMin = filterAmountMin ? parseFloat(filterAmountMin) : null;
    const amtMax = filterAmountMax ? parseFloat(filterAmountMax) : null;

    return transactions.filter((txn) => {
      if (q) {
        const descMatch = txn.description.toLowerCase().includes(q);
        const notesMatch = txn.notes.toLowerCase().includes(q);
        const memoMatch = txn.splits.some((s) => s.memo.toLowerCase().includes(q));
        const amtMatch = txn.splits.some((s) =>
          Math.abs(s.value).toFixed(2).includes(q)
        );
        if (!descMatch && !notesMatch && !memoMatch && !amtMatch) return false;
      }

      if (filterAccountId) {
        if (!txn.splits.some((s) => s.accountId === filterAccountId)) return false;
      }

      if (filterDateFrom && txn.datePosted < filterDateFrom) return false;
      if (filterDateTo && txn.datePosted > filterDateTo) return false;

      if (amtMin !== null || amtMax !== null) {
        const maxAbs = Math.max(...txn.splits.map((s) => Math.abs(s.value)));
        if (amtMin !== null && maxAbs < amtMin) return false;
        if (amtMax !== null && maxAbs > amtMax) return false;
      }

      return true;
    });
  }, [transactions, query, filterAccountId, filterDateFrom, filterDateTo, filterAmountMin, filterAmountMax]);

  const sortedResults = useMemo(
    () => [...results].sort((a, b) => b.datePosted.localeCompare(a.datePosted)),
    [results]
  );

  const leafAccounts = useMemo(
    () =>
      accounts
        .filter((a) => a.type !== 'ROOT')
        .map((a) => ({ ...a, path: getAccountPath(a.id, accounts) }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    [accounts]
  );

  function handleGoToAccount(txn: Transaction) {
    const firstSplit = txn.splits[0];
    if (firstSplit) setSelectedAccount(firstSplit.accountId);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Search Transactions</h2>

        {/* Main search bar */}
        <div className="relative mb-4">
          <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search descriptions, memos, amounts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-gray-800 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-gray-200 placeholder-gray-600 outline-none focus:border-blue-500 text-sm"
          />
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Account</label>
            <select
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
              className="bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-blue-500 w-48"
            >
              <option value="">All accounts</option>
              {leafAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.path}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Date from</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Date to</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Min amount</label>
            <input
              type="number"
              placeholder="0"
              value={filterAmountMin}
              onChange={(e) => setFilterAmountMin(e.target.value)}
              className="bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-blue-500 w-28"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Max amount</label>
            <input
              type="number"
              placeholder="∞"
              value={filterAmountMax}
              onChange={(e) => setFilterAmountMax(e.target.value)}
              className="bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-blue-500 w-28"
            />
          </div>

          <button
            onClick={() => {
              setQuery('');
              setFilterAccountId('');
              setFilterDateFrom('');
              setFilterDateTo('');
              setFilterAmountMin('');
              setFilterAmountMax('');
            }}
            className="self-end px-3 py-1.5 text-sm text-gray-500 hover:text-gray-300 border border-white/10 rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="px-6 py-2 text-xs text-gray-500 border-b border-white/5">
        {sortedResults.length} result{sortedResults.length !== 1 ? 's' : ''}
      </div>

      {/* Results table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="text-xs text-gray-500 border-b border-white/10">
              <th className="px-4 py-2 text-left w-28">Date</th>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-left w-48">Account</th>
              <th className="px-4 py-2 text-right w-32">Amount</th>
              <th className="px-4 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((txn) => {
              const primarySplit = filterAccountId
                ? txn.splits.find((s) => s.accountId === filterAccountId)
                : txn.splits[0];
              if (!primarySplit) return null;
              const acc = accountMap.get(primarySplit.accountId);

              return (
                <tr
                  key={txn.id}
                  className="border-b border-white/5 hover:bg-white/3 group cursor-pointer"
                  onClick={() => handleGoToAccount(txn)}
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                    {formatDate(txn.datePosted)}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-gray-200">{txn.description || <span className="italic text-gray-600">No description</span>}</p>
                    {primarySplit.memo && (
                      <p className="text-xs text-gray-600">{primarySplit.memo}</p>
                    )}
                    {txn.notes && (
                      <p className="text-xs text-gray-600 truncate max-w-sm">{txn.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {acc?.name ?? '?'}
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-right font-mono text-sm',
                    primarySplit.value < 0 ? 'text-red-400' : 'text-emerald-400'
                  )}>
                    {formatCurrency(primarySplit.value)}
                  </td>
                  <td className="px-4 py-2.5">
                    <ExternalLink
                      size={12}
                      className="text-gray-700 group-hover:text-blue-400 transition-colors"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedResults.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600">
            <SearchIcon size={32} className="mb-2 opacity-30" />
            <p>No results found</p>
          </div>
        )}
      </div>
    </div>
  );
}
