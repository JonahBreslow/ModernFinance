import { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import type { Account, Transaction } from '../../types';
import { cn, formatCurrency, buildAccountTree } from '../../lib/utils';
import type { AccountNode } from '../../types';

interface ReportsProps {
  accounts: Account[];
  transactions: Transaction[];
}

type ReportType = 'income' | 'balance';

const CURRENT_YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sumTree(node: AccountNode, getValue: (id: string) => number): number {
  let total = getValue(node.id);
  for (const child of node.children) total += sumTree(child, getValue);
  return total;
}

/** Build an array of calendar months between two ISO date strings (inclusive). */
function buildMonthColumns(from: string, to: string): { label: string; from: string; to: string }[] {
  const cols: { label: string; from: string; to: string }[] = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    cols.push({
      label: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      from: start,
      to: end,
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return cols;
}

/** Returns the first day of the month N months ago from today. */
function monthsAgoStart(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (n - 1));
  return d.toISOString().slice(0, 10);
}

/** Returns the last day of the current month. */
function currentMonthEnd(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-column Income Statement row
// ─────────────────────────────────────────────────────────────────────────────

interface ColDef {
  label: string;
  getValue: (id: string) => number;
}

// sortColIdx: index into cols array, or cols.length for the Total column, or null for no sort
function sortedChildren(children: AccountNode[], cols: ColDef[], sortColIdx: number | null): AccountNode[] {
  if (sortColIdx === null) return children;
  return [...children].sort((a, b) => {
    const getVal = (n: AccountNode) => {
      if (sortColIdx === cols.length) {
        return cols.reduce((s, c) => s + sumTree(n, c.getValue), 0);
      }
      return sumTree(n, cols[sortColIdx].getValue);
    };
    return getVal(b) - getVal(a); // descending
  });
}

function IncomeRow({
  node,
  depth,
  cols,
  showTotal,
  sortColIdx,
}: {
  node: AccountNode;
  depth: number;
  cols: ColDef[];
  showTotal: boolean;
  sortColIdx: number | null;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  const totalByCol = cols.map((c) => sumTree(node, c.getValue));
  const grandTotal = totalByCol.reduce((s, v) => s + v, 0);

  if (Math.abs(grandTotal) < 0.005 && !node.placeholder) return null;

  const orderedChildren = sortedChildren(node.children, cols, sortColIdx);

  return (
    <>
      <tr className={cn('border-b border-white/5 hover:bg-white/3', node.placeholder && 'bg-white/[0.02]')}>
        <td
          className={cn('py-1.5 pr-3 whitespace-nowrap', node.placeholder ? 'font-semibold text-gray-300' : 'text-gray-400')}
          style={{ paddingLeft: `${12 + depth * 18}px` }}
        >
          <div className="flex items-center gap-1">
            {hasChildren && (
              <button className="text-gray-600 hover:text-gray-400 flex-shrink-0" onClick={() => setOpen((o) => !o)}>
                {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>
            )}
            <span className="truncate max-w-[200px]" title={node.name}>{node.name}</span>
          </div>
        </td>

        {cols.map((col, i) => {
          const val = hasChildren ? totalByCol[i] : col.getValue(node.id);
          const show = Math.abs(val) > 0.005;
          return (
            <td key={i} className={cn(
              'py-1.5 px-3 text-right font-mono text-sm tabular-nums',
              show ? (val < 0 ? 'text-red-400' : 'text-emerald-400') : 'text-gray-800'
            )}>
              {show ? formatCurrency(Math.abs(val)) : '—'}
            </td>
          );
        })}

        {showTotal && (
          <td className={cn(
            'py-1.5 px-3 text-right font-mono text-sm font-semibold tabular-nums border-l border-white/10',
            Math.abs(grandTotal) > 0.005
              ? grandTotal < 0 ? 'text-red-400' : 'text-emerald-400'
              : 'text-gray-800'
          )}>
            {Math.abs(grandTotal) > 0.005 ? formatCurrency(Math.abs(grandTotal)) : '—'}
          </td>
        )}
      </tr>

      {open && hasChildren && orderedChildren.map((child) => (
        <IncomeRow key={child.id} node={child} depth={depth + 1} cols={cols} showTotal={showTotal} sortColIdx={sortColIdx} />
      ))}
    </>
  );
}

function SectionTotalRow({
  label,
  values,
  showTotal,
  colorClass = 'text-emerald-400',
  borderClass = 'border-white/20',
}: {
  label: string;
  values: number[];
  showTotal: boolean;
  colorClass?: string;
  borderClass?: string;
}) {
  const total = values.reduce((s, v) => s + v, 0);
  return (
    <tr className={cn('border-t-2', borderClass)}>
      <td className="py-2 px-3 font-bold text-gray-200 text-sm">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={cn('py-2 px-3 text-right font-mono font-bold text-sm tabular-nums', colorClass)}>
          {formatCurrency(Math.abs(v))}
        </td>
      ))}
      {showTotal && (
        <td className={cn('py-2 px-3 text-right font-mono font-bold text-sm border-l border-white/10', colorClass)}>
          {formatCurrency(Math.abs(total))}
        </td>
      )}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-column Balance Sheet row (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function BalanceRow({
  node, depth, getValue,
}: {
  node: AccountNode; depth: number; getValue: (id: string) => number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const value = getValue(node.id);
  const total = sumTree(node, getValue);
  if (Math.abs(total) < 0.005 && !node.placeholder) return null;
  return (
    <>
      <tr className={cn('border-b border-white/5 hover:bg-white/3', node.placeholder && 'bg-white/[0.02]')}>
        <td
          className={cn('py-1.5 pr-4', node.placeholder ? 'font-semibold text-gray-300' : 'text-gray-400')}
          style={{ paddingLeft: `${16 + depth * 20}px` }}
        >
          <div className="flex items-center gap-1">
            {hasChildren && (
              <button className="text-gray-600 hover:text-gray-400" onClick={() => setOpen((o) => !o)}>
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            )}
            <span>{node.name}</span>
          </div>
        </td>
        <td className={cn('py-1.5 px-4 text-right font-mono text-sm', !hasChildren && Math.abs(value) > 0.005 ? value < 0 ? 'text-red-400' : 'text-emerald-400' : 'text-gray-600')}>
          {!hasChildren && Math.abs(value) > 0.005 ? formatCurrency(Math.abs(value)) : ''}
        </td>
        <td className={cn('py-1.5 px-4 text-right font-mono text-sm font-medium', total < 0 ? 'text-red-400' : 'text-emerald-400')}>
          {Math.abs(total) > 0.005 ? formatCurrency(Math.abs(total)) : ''}
        </td>
      </tr>
      {open && hasChildren && node.children.map((child) => (
        <BalanceRow key={child.id} node={child} depth={depth + 1} getValue={getValue} />
      ))}
    </>
  );
}

function BSSectionTotal({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <tr className={cn('border-t-2 border-white/20', className)}>
      <td className="py-2 px-4 font-bold text-gray-200">{label}</td>
      <td />
      <td className={cn('py-2 px-4 text-right font-mono font-bold text-base', value < 0 ? 'text-red-400' : 'text-emerald-400')}>
        {formatCurrency(Math.abs(value))}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Reports component
// ─────────────────────────────────────────────────────────────────────────────

type MonthPreset = '3m' | '6m' | '12m' | 'ytd' | 'lastyear' | 'custom';

export function Reports({ accounts, transactions }: ReportsProps) {
  const [reportType, setReportType] = useState<ReportType>('income');

  // Income statement sort: null = natural order, 0..n-1 = month col, n = Total col
  const [sortColIdx, setSortColIdx] = useState<number | null>(null);

  function handleColHeaderClick(idx: number) {
    setSortColIdx((prev) => (prev === idx ? null : idx));
  }

  // Income statement: month-range mode
  const [monthPreset, setMonthPreset] = useState<MonthPreset>('3m');
  const [customFrom, setCustomFrom] = useState(() => `${CURRENT_YEAR}-01-01`);
  const [customTo, setCustomTo]     = useState(() => TODAY);

  // Balance sheet: single date
  const [bsDate, setBsDate] = useState(() => TODAY);

  const accountTree = useMemo(() => buildAccountTree(accounts, []), [accounts]);

  // Resolve the income statement date range from preset
  const { incomeFrom, incomeTo } = useMemo(() => {
    switch (monthPreset) {
      case '3m':       return { incomeFrom: monthsAgoStart(3),  incomeTo: currentMonthEnd() };
      case '6m':       return { incomeFrom: monthsAgoStart(6),  incomeTo: currentMonthEnd() };
      case '12m':      return { incomeFrom: monthsAgoStart(12), incomeTo: currentMonthEnd() };
      case 'ytd':      return { incomeFrom: `${CURRENT_YEAR}-01-01`, incomeTo: TODAY };
      case 'lastyear': return { incomeFrom: `${CURRENT_YEAR - 1}-01-01`, incomeTo: `${CURRENT_YEAR - 1}-12-31` };
      case 'custom':   return { incomeFrom: customFrom, incomeTo: customTo };
    }
  }, [monthPreset, customFrom, customTo]);

  // Month columns for income statement
  const monthCols = useMemo(
    () => buildMonthColumns(incomeFrom, incomeTo),
    [incomeFrom, incomeTo]
  );

  // Reset sort when the number of columns changes (e.g. switching presets)
  useEffect(() => { setSortColIdx(null); }, [monthCols.length]);

  // Per-month balances: Map<monthFrom, Map<accountId, number>>
  const monthBalances = useMemo(() => {
    return monthCols.map(({ from, to }) => {
      const map = new Map<string, number>();
      for (const txn of transactions) {
        if (txn.datePosted < from || txn.datePosted > to) continue;
        for (const split of txn.splits) {
          map.set(split.accountId, (map.get(split.accountId) ?? 0) + split.value);
        }
      }
      return map;
    });
  }, [transactions, monthCols]);

  // Balance sheet balances (cumulative up to bsDate)
  const bsBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const txn of transactions) {
      if (txn.datePosted > bsDate) continue;
      for (const split of txn.splits) {
        map.set(split.accountId, (map.get(split.accountId) ?? 0) + split.value);
      }
    }
    return map;
  }, [transactions, bsDate]);

  const assetNodes  = accountTree.filter((n) => ['ASSET', 'BANK', 'CASH', 'STOCK', 'MUTUAL', 'RECEIVABLE'].includes(n.type));
  const liabNodes   = accountTree.filter((n) => ['LIABILITY', 'CREDIT', 'PAYABLE'].includes(n.type));
  const equityNodes = accountTree.filter((n) => n.type === 'EQUITY');

  // Build ColDef array — one per calendar month, income-positive
  const incomeCols: ColDef[] = monthCols.map((_, i) => ({
    label: monthCols[i].label,
    getValue: (id) => -(monthBalances[i].get(id) ?? 0),
  }));
  const expenseCols: ColDef[] = monthCols.map((_, i) => ({
    label: monthCols[i].label,
    getValue: (id) => monthBalances[i].get(id) ?? 0,
  }));

  const incomeNodes = useMemo(() => {
    const nodes = accountTree.filter((n) => n.type === 'INCOME');
    return sortedChildren(nodes, incomeCols, sortColIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountTree, monthBalances, sortColIdx]);

  const expenseNodes = useMemo(() => {
    const nodes = accountTree.filter((n) => n.type === 'EXPENSE');
    return sortedChildren(nodes, expenseCols, sortColIdx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountTree, monthBalances, sortColIdx]);

  // Section totals per month
  const incomeTotals  = monthBalances.map((mb) => incomeNodes.reduce((s, n) => s + sumTree(n, (id) => -(mb.get(id) ?? 0)), 0));
  const expenseTotals = monthBalances.map((mb) => expenseNodes.reduce((s, n) => s + sumTree(n, (id) => mb.get(id) ?? 0), 0));
  const netTotals     = incomeTotals.map((inc, i) => inc - expenseTotals[i]);

  const showTotal = monthCols.length > 1;

  const totalAssets  = assetNodes.reduce((s, n)  => s + sumTree(n, (id) => bsBalances.get(id) ?? 0), 0);
  const totalLiabs   = liabNodes.reduce((s, n)   => s + sumTree(n, (id) => bsBalances.get(id) ?? 0), 0);
  const totalEquity  = equityNodes.reduce((s, n) => s + sumTree(n, (id) => bsBalances.get(id) ?? 0), 0);

  // Retained earnings = Net Income to date (income accounts are credit-normal / negative raw,
  // expense accounts are debit-normal / positive raw).
  // Display value: -(incomeRaw + expenseRaw)  →  income − expenses
  const bsIncomeNodes  = accountTree.filter((n) => n.type === 'INCOME');
  const bsExpenseNodes = accountTree.filter((n) => n.type === 'EXPENSE');
  const incomeRaw   = bsIncomeNodes.reduce((s, n)  => s + sumTree(n, (id) => bsBalances.get(id) ?? 0), 0);
  const expenseRaw  = bsExpenseNodes.reduce((s, n) => s + sumTree(n, (id) => bsBalances.get(id) ?? 0), 0);
  const retainedEarnings = -(incomeRaw + expenseRaw); // positive = net profit

  const presets: { id: MonthPreset; label: string }[] = [
    { id: '3m',       label: '3 Months'  },
    { id: '6m',       label: '6 Months'  },
    { id: '12m',      label: '12 Months' },
    { id: 'ytd',      label: 'YTD'       },
    { id: 'lastyear', label: `${CURRENT_YEAR - 1}` },
    { id: 'custom',   label: 'Custom'    },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-white/10 flex items-center gap-4 flex-wrap">
        {/* Report type */}
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setReportType('income')}
            className={cn('px-3 py-1.5 rounded-md text-sm transition-colors', reportType === 'income' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200')}
          >
            Income Statement
          </button>
          <button
            onClick={() => setReportType('balance')}
            className={cn('px-3 py-1.5 rounded-md text-sm transition-colors', reportType === 'balance' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200')}
          >
            Balance Sheet
          </button>
        </div>

        {reportType === 'income' ? (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Presets */}
            <div className="flex gap-1">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setMonthPreset(p.id)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded border transition-colors',
                    monthPreset === p.id
                      ? 'bg-gray-700 text-gray-100 border-gray-600'
                      : 'text-gray-500 hover:text-gray-300 border-white/10'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Custom range */}
            {monthPreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                  className="bg-gray-800 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500" />
                <span className="text-gray-600 text-xs">to</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                  className="bg-gray-800 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500" />
              </div>
            )}
            <span className="text-xs text-gray-600 ml-1">{monthCols.length} column{monthCols.length !== 1 ? 's' : ''}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">As of</span>
            <input type="date" value={bsDate} onChange={(e) => setBsDate(e.target.value)}
              className="bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-blue-500" />
            <div className="flex gap-1">
              {[
                { label: 'Today', date: TODAY },
                { label: `End of ${CURRENT_YEAR}`, date: `${CURRENT_YEAR}-12-31` },
                { label: `End of ${CURRENT_YEAR - 1}`, date: `${CURRENT_YEAR - 1}-12-31` },
              ].map((p) => (
                <button key={p.label} onClick={() => setBsDate(p.date)}
                  className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-300 border border-white/10 rounded transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Report body */}
      <div className="flex-1 overflow-auto p-5">
        {reportType === 'income' ? (
          <div className="min-w-max">
            <table className="text-sm border-collapse">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-white/10">
                  <th className="py-2 pr-3 text-left w-52">Account</th>
                  {monthCols.map((col, i) => (
                    <th key={i} className="py-2 px-3 text-right min-w-[110px]">
                      <button
                        onClick={() => handleColHeaderClick(i)}
                        className={cn(
                          'flex items-center gap-1 ml-auto transition-colors',
                          sortColIdx === i ? 'text-blue-400' : 'hover:text-gray-300'
                        )}
                      >
                        {col.label}
                        {sortColIdx === i ? <ChevronDown size={11} /> : null}
                      </button>
                    </th>
                  ))}
                  {showTotal && (
                    <th className="py-2 px-3 text-right min-w-[110px] border-l border-white/10">
                      <button
                        onClick={() => handleColHeaderClick(monthCols.length)}
                        className={cn(
                          'flex items-center gap-1 ml-auto transition-colors',
                          sortColIdx === monthCols.length ? 'text-blue-400' : 'text-gray-400 hover:text-gray-300'
                        )}
                      >
                        Total
                        {sortColIdx === monthCols.length ? <ChevronDown size={11} /> : null}
                      </button>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* Income section */}
                <tr>
                  <td colSpan={monthCols.length + (showTotal ? 2 : 1)}
                    className="py-2 px-3 text-xs font-bold uppercase tracking-widest text-blue-400 pt-4">
                    Income
                  </td>
                </tr>
                {incomeNodes.map((n) => (
                  <IncomeRow key={n.id} node={n} depth={0} cols={incomeCols} showTotal={showTotal} sortColIdx={sortColIdx} />
                ))}
                <SectionTotalRow
                  label="Total Income"
                  values={incomeTotals}
                  showTotal={showTotal}
                  colorClass="text-blue-400"
                  borderClass="border-blue-500/30"
                />

                {/* Expenses section */}
                <tr>
                  <td colSpan={monthCols.length + (showTotal ? 2 : 1)}
                    className="py-2 px-3 text-xs font-bold uppercase tracking-widest text-orange-400 pt-6">
                    Expenses
                  </td>
                </tr>
                {expenseNodes.map((n) => (
                  <IncomeRow key={n.id} node={n} depth={0} cols={expenseCols} showTotal={showTotal} sortColIdx={sortColIdx} />
                ))}
                <SectionTotalRow
                  label="Total Expenses"
                  values={expenseTotals}
                  showTotal={showTotal}
                  colorClass="text-orange-400"
                  borderClass="border-orange-400/30"
                />

                {/* Net income */}
                <tr className="border-t-2 border-blue-500/50">
                  <td className="py-3 px-3 font-bold text-white">Net Income</td>
                  {netTotals.map((v, i) => (
                    <td key={i} className={cn('py-3 px-3 text-right font-mono font-bold tabular-nums', v >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {formatCurrency(v)}
                    </td>
                  ))}
                  {showTotal && (
                    <td className={cn(
                      'py-3 px-3 text-right font-mono font-bold border-l border-white/10',
                      netTotals.reduce((s, v) => s + v, 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {formatCurrency(netTotals.reduce((s, v) => s + v, 0))}
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div className="max-w-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-white/10">
                  <th className="py-2 pr-4 text-left">Account</th>
                  <th className="py-2 px-4 text-right">Amount</th>
                  <th className="py-2 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={3} className="py-2 px-4 text-xs font-bold uppercase tracking-widest text-emerald-400">Assets</td></tr>
                {assetNodes.map((n) => <BalanceRow key={n.id} node={n} depth={0} getValue={(id) => bsBalances.get(id) ?? 0} />)}
                <BSSectionTotal label="Total Assets" value={totalAssets} className="border-emerald-400/40" />

                <tr><td colSpan={3} className="pt-6 pb-2 px-4 text-xs font-bold uppercase tracking-widest text-red-400">Liabilities</td></tr>
                {liabNodes.map((n) => <BalanceRow key={n.id} node={n} depth={0} getValue={(id) => -(bsBalances.get(id) ?? 0)} />)}
                <BSSectionTotal label="Total Liabilities" value={-totalLiabs} className="border-red-400/40" />

                <tr><td colSpan={3} className="pt-6 pb-2 px-4 text-xs font-bold uppercase tracking-widest text-purple-400">Equity</td></tr>
                {equityNodes.map((n) => <BalanceRow key={n.id} node={n} depth={0} getValue={(id) => -(bsBalances.get(id) ?? 0)} />)}
                {/* Retained Earnings = net income to date, flows into equity */}
                <tr className="border-b border-white/5 hover:bg-white/3">
                  <td className="py-1.5 px-4 text-gray-400" style={{ paddingLeft: '16px' }}>Retained Earnings</td>
                  <td className={cn('py-1.5 px-4 text-right font-mono text-sm', retainedEarnings < 0 ? 'text-red-400' : 'text-emerald-400')}>
                    {formatCurrency(retainedEarnings)}
                  </td>
                  <td className={cn('py-1.5 px-4 text-right font-mono text-sm font-medium', retainedEarnings < 0 ? 'text-red-400' : 'text-emerald-400')}>
                    {formatCurrency(retainedEarnings)}
                  </td>
                </tr>
                <BSSectionTotal label="Total Equity" value={-totalEquity + retainedEarnings} className="border-purple-400/40" />

                <tr className="border-t-2 border-blue-500/50">
                  <td className="py-3 px-4 font-bold text-white text-base">Total Liabilities + Equity</td>
                  <td />
                  <td className="py-3 px-4 text-right font-mono font-bold text-base text-blue-400">
                    {formatCurrency(-totalLiabs - totalEquity + retainedEarnings)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
