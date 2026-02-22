import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, ChevronDown, X, Search, PiggyBank, Save } from 'lucide-react';
import type { Account, Transaction } from '../../types';
import { cn, formatCurrency, buildAccountTree } from '../../lib/utils';
import type { AccountNode } from '../../types';
import { fetchBudget, saveBudget } from '../../lib/api';

interface ReportsProps {
  accounts: Account[];
  transactions: Transaction[];
}

type ReportType = 'income' | 'balance';

const CURRENT_YEAR = new Date().getFullYear();
const TODAY = new Date().toISOString().slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ColDef {
  label: string;
  from: string;
  to: string;
  getValue: (id: string) => number;
}

interface DrilldownTarget {
  label: string;
  accountIds: Set<string>;
  from: string;
  to: string;
  kind: 'income' | 'expense';
}

interface CtxMenu {
  x: number;
  y: number;
  target: DrilldownTarget;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sumTree(node: AccountNode, getValue: (id: string) => number): number {
  let total = getValue(node.id);
  for (const child of node.children) total += sumTree(child, getValue);
  return total;
}

function collectAllIds(node: AccountNode): string[] {
  return [node.id, ...node.children.flatMap(collectAllIds)];
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

function sortedChildren(children: AccountNode[], cols: ColDef[], sortColIdx: number | null): AccountNode[] {
  if (sortColIdx === null) return children;
  return [...children].sort((a, b) => {
    const getVal = (n: AccountNode) => {
      if (sortColIdx === cols.length) {
        return cols.reduce((s, c) => s + sumTree(n, c.getValue), 0);
      }
      return sumTree(n, cols[sortColIdx].getValue);
    };
    return getVal(b) - getVal(a);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Drilldown panel
// ─────────────────────────────────────────────────────────────────────────────

function DrilldownPanel({
  target,
  transactions,
  accounts,
  onClose,
}: {
  target: DrilldownTarget;
  transactions: Transaction[];
  accounts: Account[];
  onClose: () => void;
}) {
  const [width, setWidth] = useState(360);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
    e.preventDefault();
  }, [width]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = dragStartX.current - e.clientX;
      setWidth(Math.max(260, Math.min(700, dragStartWidth.current + delta)));
    };
    const onMouseUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const rows = useMemo(() => {
    const result: {
      txnId: string;
      date: string;
      description: string;
      amount: number;
      counterpart: string;
    }[] = [];

    for (const txn of transactions) {
      if (txn.datePosted < target.from || txn.datePosted > target.to) continue;

      const relevantSplits = txn.splits.filter((s) => target.accountIds.has(s.accountId));
      if (relevantSplits.length === 0) continue;

      const rawSum = relevantSplits.reduce((s, sp) => s + sp.value, 0);
      const amount = target.kind === 'income' ? -rawSum : rawSum;

      const otherSplits = txn.splits.filter((s) => !target.accountIds.has(s.accountId));
      const counterpart =
        otherSplits.length === 0 ? '—'
        : otherSplits.length === 1 ? (accountMap.get(otherSplits[0].accountId)?.name ?? '?')
        : 'Split';

      result.push({
        txnId: txn.id,
        date: txn.datePosted,
        description: txn.description,
        amount,
        counterpart,
      });
    }

    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [target, transactions, accountMap]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="flex-shrink-0 flex" style={{ width }}>
      {/* Resize handle */}
      <div
        className="w-1 flex-shrink-0 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500/70 transition-colors relative"
        onMouseDown={handleDragStart}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>
      <div className="flex-1 border-l border-white/10 flex flex-col bg-gray-900/80 min-w-0">
      <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-2 flex-shrink-0">
        <div>
          <p className="font-semibold text-gray-100 text-sm leading-snug">{target.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{rows.length} transaction{rows.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 p-0.5 mt-0.5 flex-shrink-0">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-gray-600 text-xs">
            No transactions found
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-900 border-b border-white/10 z-10">
              <tr className="text-gray-600">
                <th className="px-3 py-2 text-left w-16">Date</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/3">
                  <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">
                    {row.date.slice(5).replace('-', '/')}
                  </td>
                  <td className="px-3 py-2">
                    <p className="text-gray-300 truncate max-w-[160px]">{row.description || <span className="italic text-gray-600">—</span>}</p>
                    <p className="text-gray-600 truncate max-w-[160px]">{row.counterpart}</p>
                  </td>
                  <td className={cn(
                    'px-3 py-2 text-right font-mono tabular-nums',
                    row.amount >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {formatCurrency(Math.abs(row.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-white/10 flex items-center justify-between flex-shrink-0">
        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total</span>
        <span className={cn('font-mono font-bold text-sm', total >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {formatCurrency(Math.abs(total))}
        </span>
      </div>
    </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Income statement rows
// ─────────────────────────────────────────────────────────────────────────────

function BudgetCell({
  nodeId,
  isPlaceholder,
  budgetTotal,
  isSet,
  budgetMode,
  onSetBudget,
}: {
  nodeId: string;
  isPlaceholder: boolean;
  budgetTotal: number;
  isSet: boolean;
  budgetMode: boolean;
  onSetBudget: (id: string, v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  if (!budgetMode) return null;

  const commit = () => {
    const v = parseFloat(raw);
    onSetBudget(nodeId, isNaN(v) || v < 0 ? null : v);
    setEditing(false);
  };

  if (editing) {
    return (
      <td className="py-1 px-3 text-right w-28">
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="1"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="bg-gray-800 border border-blue-500 rounded px-2 py-0.5 text-xs font-mono text-right w-24 outline-none text-gray-200"
          placeholder="0.00"
        />
      </td>
    );
  }

  return (
    <td
      className="py-1.5 px-3 text-right w-28 cursor-pointer group"
      onDoubleClick={isPlaceholder ? undefined : () => { setRaw(budgetTotal > 0 ? budgetTotal.toFixed(2) : ''); setEditing(true); }}
      title={isPlaceholder ? undefined : 'Double-click to set budget'}
    >
      {isSet ? (
        <span className={cn('font-mono text-xs tabular-nums text-amber-400', !isPlaceholder && 'group-hover:brightness-125')}>
          {formatCurrency(budgetTotal)}
        </span>
      ) : (
        <span className={cn('text-xs', isPlaceholder ? 'text-gray-800' : 'text-gray-700 group-hover:text-gray-500')}>
          {isPlaceholder ? '—' : '+ set'}
        </span>
      )}
    </td>
  );
}

function IncomeRow({
  node, depth, cols, showTotal, sortColIdx, kind, onDrilldown, onContextMenu,
  budgetMode, budgets, onSetBudget,
}: {
  node: AccountNode;
  depth: number;
  cols: ColDef[];
  showTotal: boolean;
  sortColIdx: number | null;
  kind: 'income' | 'expense';
  onDrilldown: (target: DrilldownTarget) => void;
  onContextMenu: (e: React.MouseEvent, target: DrilldownTarget) => void;
  budgetMode: boolean;
  budgets: Map<string, number>;
  onSetBudget: (id: string, v: number | null) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  const totalByCol = cols.map((c) => sumTree(node, c.getValue));
  const grandTotal = totalByCol.reduce((s, v) => s + v, 0);

  const allIds = new Set(collectAllIds(node));

  // Sum of monthly budgets across the subtree
  const budgetTotal = Array.from(allIds).reduce((s, id) => s + (budgets.get(id) ?? 0), 0);

  if (Math.abs(grandTotal) < 0.005 && !node.placeholder && budgetTotal === 0) return null;

  const orderedChildren = sortedChildren(node.children, cols, sortColIdx);

  function makeCellTarget(col: ColDef): DrilldownTarget {
    return { label: `${node.name} — ${col.label}`, accountIds: allIds, from: col.from, to: col.to, kind };
  }
  function makeTotalTarget(): DrilldownTarget {
    return { label: `${node.name} — Total`, accountIds: allIds, from: cols[0].from, to: cols[cols.length - 1].to, kind };
  }

  function cellBg(actual: number, budget: number, isBudgetSet: boolean): string {
    if (!budgetMode || !isBudgetSet) return '';
    // $0 budget: any actual spending is over budget
    if (budget === 0) {
      return actual > 0.005
        ? (kind === 'expense' ? 'bg-red-500/15' : 'bg-amber-500/10')
        : 'bg-emerald-500/10';
    }
    const ratio = actual / budget;
    if (kind === 'expense') {
      return ratio > 1 ? 'bg-red-500/15' : 'bg-emerald-500/10';
    } else {
      return ratio >= 1 ? 'bg-emerald-500/10' : 'bg-amber-500/10';
    }
  }

  return (
    <>
      <tr className={cn('border-b border-white/5 hover:bg-white/[0.04]', node.placeholder && 'bg-white/[0.02]')}>
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

        <BudgetCell
          nodeId={node.id}
          isPlaceholder={!!node.placeholder}
          budgetTotal={budgetTotal}
          isSet={Array.from(allIds).some((id) => budgets.has(id))}
          budgetMode={budgetMode}
          onSetBudget={onSetBudget}
        />

        {cols.map((col, i) => {
          const val = hasChildren ? totalByCol[i] : col.getValue(node.id);
          const show = Math.abs(val) > 0.005;
          const target = makeCellTarget(col);
          const bg = cellBg(val, budgetTotal, Array.from(allIds).some((id) => budgets.has(id)));
          return (
            <td
              key={i}
              className={cn(
                'py-1.5 px-3 text-right font-mono text-sm tabular-nums select-none',
                bg,
                show
                  ? cn(val < 0 ? 'text-red-400' : 'text-emerald-400', 'cursor-pointer hover:brightness-125')
                  : 'text-gray-800'
              )}
              onDoubleClick={show ? () => onDrilldown(target) : undefined}
              onContextMenu={show ? (e) => { e.preventDefault(); onContextMenu(e, target); } : undefined}
            >
              {show ? formatCurrency(Math.abs(val)) : '—'}
            </td>
          );
        })}

        {showTotal && (() => {
          const show = Math.abs(grandTotal) > 0.005;
          const target = makeTotalTarget();
          const periodBudget = budgetTotal * cols.length;
          const isBudgetSet = Array.from(allIds).some((id) => budgets.has(id));
          const bg = cellBg(grandTotal, periodBudget, isBudgetSet);
          return (
            <td
              className={cn(
                'py-1.5 px-3 text-right font-mono text-sm font-semibold tabular-nums border-l border-white/10 select-none',
                bg,
                show
                  ? cn(grandTotal < 0 ? 'text-red-400' : 'text-emerald-400', 'cursor-pointer hover:brightness-125')
                  : 'text-gray-800'
              )}
              onDoubleClick={show ? () => onDrilldown(target) : undefined}
              onContextMenu={show ? (e) => { e.preventDefault(); onContextMenu(e, target); } : undefined}
            >
              {show ? (
                <div>
                  {formatCurrency(Math.abs(grandTotal))}
                  {budgetMode && periodBudget > 0 && (
                    <div className={cn('text-xs font-normal', grandTotal > periodBudget ? 'text-red-400' : 'text-emerald-500')}>
                      {grandTotal > periodBudget ? '+' : '-'}{formatCurrency(Math.abs(grandTotal - periodBudget))}
                    </div>
                  )}
                </div>
              ) : '—'}
            </td>
          );
        })()}
      </tr>

      {open && hasChildren && orderedChildren.map((child) => (
        <IncomeRow
          key={child.id} node={child} depth={depth + 1}
          cols={cols} showTotal={showTotal} sortColIdx={sortColIdx}
          kind={kind} onDrilldown={onDrilldown} onContextMenu={onContextMenu}
          budgetMode={budgetMode} budgets={budgets} onSetBudget={onSetBudget}
        />
      ))}
    </>
  );
}

function SectionTotalRow({
  label, values, showTotal, colorClass = 'text-emerald-400', borderClass = 'border-white/20',
  budgetMode, monthlyBudgetTotal, kind, isBudgetSet,
}: {
  label: string; values: number[]; showTotal: boolean; colorClass?: string; borderClass?: string;
  budgetMode?: boolean; monthlyBudgetTotal?: number; kind?: 'income' | 'expense'; isBudgetSet?: boolean;
}) {
  const total = values.reduce((s, v) => s + v, 0);

  function cellBg(actual: number, budget: number): string {
    if (!budgetMode || !isBudgetSet) return '';
    if (budget === 0) {
      return actual > 0.005
        ? (kind === 'expense' ? 'bg-red-500/15' : 'bg-amber-500/10')
        : 'bg-emerald-500/10';
    }
    const ratio = actual / budget;
    if (kind === 'expense') return ratio > 1 ? 'bg-red-500/15' : 'bg-emerald-500/10';
    return ratio >= 1 ? 'bg-emerald-500/10' : 'bg-amber-500/10';
  }

  return (
    <tr className={cn('border-t-2', borderClass)}>
      <td className="py-2 px-3 font-bold text-gray-200 text-sm">{label}</td>
      {/* budget column placeholder */}
      {budgetMode && (
        <td className="py-2 px-3 text-right w-28">
          {isBudgetSet && (monthlyBudgetTotal ?? 0) >= 0 && (
            <span className="font-mono font-bold text-sm tabular-nums text-amber-400">
              {formatCurrency(monthlyBudgetTotal!)}
            </span>
          )}
        </td>
      )}
      {values.map((v, i) => (
        <td key={i} className={cn('py-2 px-3 text-right font-mono font-bold text-sm tabular-nums', colorClass, cellBg(v, monthlyBudgetTotal ?? 0))}>
          {formatCurrency(Math.abs(v))}
        </td>
      ))}
      {showTotal && (() => {
        const periodBudget = (monthlyBudgetTotal ?? 0) * values.length;
        const bg = cellBg(total, periodBudget);
        const variance = kind === 'expense' ? total - periodBudget : periodBudget - total;
        return (
          <td className={cn('py-2 px-3 text-right font-mono font-bold text-sm border-l border-white/10', colorClass, bg)}>
            <div>{formatCurrency(Math.abs(total))}</div>
            {budgetMode && isBudgetSet && (monthlyBudgetTotal ?? 0) >= 0 && (
              <div className={cn('text-xs font-normal', variance > 0 ? 'text-red-400' : 'text-emerald-500')}>
                {variance > 0 ? '+' : ''}{formatCurrency(variance)} vs budget
              </div>
            )}
          </td>
        );
      })()}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Balance Sheet rows (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function BalanceRow({ node, depth, getValue }: { node: AccountNode; depth: number; getValue: (id: string) => number }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const value = getValue(node.id);
  const total = sumTree(node, getValue);
  if (Math.abs(total) < 0.005 && !node.placeholder) return null;
  return (
    <>
      <tr className={cn('border-b border-white/5 hover:bg-white/3', node.placeholder && 'bg-white/[0.02]')}>
        <td className={cn('py-1.5 pr-4', node.placeholder ? 'font-semibold text-gray-300' : 'text-gray-400')} style={{ paddingLeft: `${16 + depth * 20}px` }}>
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
  const queryClient = useQueryClient();
  const [reportType, setReportType] = useState<ReportType>('income');
  const [sortColIdx, setSortColIdx] = useState<number | null>(null);
  const [monthPreset, setMonthPreset] = useState<MonthPreset>('3m');
  const [customFrom, setCustomFrom] = useState(() => `${CURRENT_YEAR}-01-01`);
  const [customTo, setCustomTo]     = useState(() => TODAY);
  const [bsDate, setBsDate] = useState(() => TODAY);
  const [drilldown, setDrilldown] = useState<DrilldownTarget | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  // Budget state
  const [budgetMode, setBudgetMode] = useState(false);
  const [localBudgets, setLocalBudgets] = useState<Map<string, number>>(new Map());
  const [budgetDirty, setBudgetDirty] = useState(false);

  const { data: budgetData } = useQuery({ queryKey: ['budget'], queryFn: fetchBudget });
  useEffect(() => {
    if (budgetData) setLocalBudgets(new Map(Object.entries(budgetData.monthly)));
  }, [budgetData]);

  const saveMutation = useMutation({
    mutationFn: saveBudget,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budget'] }); setBudgetDirty(false); },
  });

  const handleSetBudget = useCallback((id: string, v: number | null) => {
    setLocalBudgets((prev) => {
      const next = new Map(prev);
      if (v == null) next.delete(id); else next.set(id, v);
      return next;
    });
    setBudgetDirty(true);
  }, []);

  const accountTree = useMemo(() => buildAccountTree(accounts, []), [accounts]);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const handler = () => setCtxMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [ctxMenu]);

  const handleDrilldown = useCallback((target: DrilldownTarget) => {
    setDrilldown(target);
    setCtxMenu(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, target: DrilldownTarget) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, target });
  }, []);

  function handleColHeaderClick(idx: number) {
    setSortColIdx((prev) => (prev === idx ? null : idx));
  }

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

  const monthCols = useMemo(() => buildMonthColumns(incomeFrom, incomeTo), [incomeFrom, incomeTo]);

  useEffect(() => { setSortColIdx(null); }, [monthCols.length]);

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

  const incomeCols: ColDef[] = monthCols.map((mc, i) => ({
    label: mc.label,
    from: mc.from,
    to: mc.to,
    getValue: (id) => -(monthBalances[i].get(id) ?? 0),
  }));
  const expenseCols: ColDef[] = monthCols.map((mc, i) => ({
    label: mc.label,
    from: mc.from,
    to: mc.to,
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

  const incomeTotals  = monthBalances.map((mb) => incomeNodes.reduce((s, n) => s + sumTree(n, (id) => -(mb.get(id) ?? 0)), 0));
  const expenseTotals = monthBalances.map((mb) => expenseNodes.reduce((s, n) => s + sumTree(n, (id) => mb.get(id) ?? 0), 0));
  const netTotals     = incomeTotals.map((inc, i) => inc - expenseTotals[i]);

  // Monthly budget totals per section
  const incomeBudgetTotal  = incomeNodes.reduce((s, n) => s + Array.from(collectAllIds(n)).reduce((ss, id) => ss + (localBudgets.get(id) ?? 0), 0), 0);
  const expenseBudgetTotal = expenseNodes.reduce((s, n) => s + Array.from(collectAllIds(n)).reduce((ss, id) => ss + (localBudgets.get(id) ?? 0), 0), 0);

  const showTotal = monthCols.length > 1;

  const totalAssets  = assetNodes.reduce((s, n)  => s + sumTree(n, (id) => bsBalances.get(id) ?? 0), 0);
  const totalLiabs   = liabNodes.reduce((s, n)   => s + sumTree(n, (id) => bsBalances.get(id) ?? 0), 0);
  const totalEquity  = equityNodes.reduce((s, n) => s + sumTree(n, (id) => bsBalances.get(id) ?? 0), 0);

  const bsIncomeNodes  = accountTree.filter((n) => n.type === 'INCOME');
  const bsExpenseNodes = accountTree.filter((n) => n.type === 'EXPENSE');
  const incomeRaw  = bsIncomeNodes.reduce((s, n)  => s + sumTree(n, (id) => bsBalances.get(id) ?? 0), 0);
  const expenseRaw = bsExpenseNodes.reduce((s, n) => s + sumTree(n, (id) => bsBalances.get(id) ?? 0), 0);
  const retainedEarnings = -(incomeRaw + expenseRaw);

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
      <div className="px-5 py-3 border-b border-white/10 flex items-center gap-4 flex-wrap flex-shrink-0">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          <button onClick={() => setReportType('income')} className={cn('px-3 py-1.5 rounded-md text-sm transition-colors', reportType === 'income' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200')}>
            Income Statement
          </button>
          <button onClick={() => setReportType('balance')} className={cn('px-3 py-1.5 rounded-md text-sm transition-colors', reportType === 'balance' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200')}>
            Balance Sheet
          </button>
        </div>

        {reportType === 'income' ? (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {presets.map((p) => (
                <button key={p.id} onClick={() => setMonthPreset(p.id)} className={cn('px-2.5 py-1 text-xs rounded border transition-colors', monthPreset === p.id ? 'bg-gray-700 text-gray-100 border-gray-600' : 'text-gray-500 hover:text-gray-300 border-white/10')}>
                  {p.label}
                </button>
              ))}
            </div>
            {monthPreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="bg-gray-800 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500" />
                <span className="text-gray-600 text-xs">to</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="bg-gray-800 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500" />
              </div>
            )}
            <span className="text-xs text-gray-600 ml-1">{monthCols.length} column{monthCols.length !== 1 ? 's' : ''}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">As of</span>
            <input type="date" value={bsDate} onChange={(e) => setBsDate(e.target.value)} className="bg-gray-800 border border-white/10 rounded px-2 py-1.5 text-sm text-gray-300 outline-none focus:border-blue-500" />
            <div className="flex gap-1">
              {[
                { label: 'Today', date: TODAY },
                { label: `End of ${CURRENT_YEAR}`, date: `${CURRENT_YEAR}-12-31` },
                { label: `End of ${CURRENT_YEAR - 1}`, date: `${CURRENT_YEAR - 1}-12-31` },
              ].map((p) => (
                <button key={p.label} onClick={() => setBsDate(p.date)} className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-300 border border-white/10 rounded transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {reportType === 'income' && (
          <div className="ml-auto flex items-center gap-2">
            <p className="text-xs text-gray-600">Double-click or right-click any value to inspect</p>
            <button
              onClick={() => setBudgetMode((b) => !b)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors',
                budgetMode
                  ? 'bg-amber-600/20 border-amber-500/40 text-amber-300'
                  : 'border-white/10 text-gray-400 hover:text-gray-200'
              )}
            >
              <PiggyBank size={13} />
              Budget
            </button>
            {budgetMode && (
              <button
                onClick={() => saveMutation.mutate({ monthly: Object.fromEntries(localBudgets) })}
                disabled={!budgetDirty || saveMutation.isPending}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors',
                  budgetDirty ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                )}
              >
                <Save size={13} />
                {saveMutation.isPending ? 'Saving…' : budgetDirty ? 'Save' : 'Saved'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Report body + drilldown panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto p-5">
          {reportType === 'income' ? (
            <div className="min-w-max">
              <table className="text-sm border-collapse">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-white/10">
                    <th className="py-2 pr-3 text-left w-52">Account</th>
                    {budgetMode && (
                      <th className="py-2 px-3 text-right w-28 text-amber-500/70">Budget/mo</th>
                    )}
                    {monthCols.map((col, i) => (
                      <th key={i} className="py-2 px-3 text-right min-w-[110px]">
                        <button onClick={() => handleColHeaderClick(i)} className={cn('flex items-center gap-1 ml-auto transition-colors', sortColIdx === i ? 'text-blue-400' : 'hover:text-gray-300')}>
                          {col.label}
                          {sortColIdx === i ? <ChevronDown size={11} /> : null}
                        </button>
                      </th>
                    ))}
                    {showTotal && (
                      <th className="py-2 px-3 text-right min-w-[110px] border-l border-white/10">
                        <button onClick={() => handleColHeaderClick(monthCols.length)} className={cn('flex items-center gap-1 ml-auto transition-colors', sortColIdx === monthCols.length ? 'text-blue-400' : 'text-gray-400 hover:text-gray-300')}>
                          Total
                          {sortColIdx === monthCols.length ? <ChevronDown size={11} /> : null}
                        </button>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={monthCols.length + (showTotal ? 2 : 1) + (budgetMode ? 1 : 0)} className="py-2 px-3 text-xs font-bold uppercase tracking-widest text-blue-400 pt-4">Income</td>
                  </tr>
                  {incomeNodes.map((n) => (
                    <IncomeRow key={n.id} node={n} depth={0} cols={incomeCols} showTotal={showTotal} sortColIdx={sortColIdx} kind="income" onDrilldown={handleDrilldown} onContextMenu={handleContextMenu} budgetMode={budgetMode} budgets={localBudgets} onSetBudget={handleSetBudget} />
                  ))}
                  <SectionTotalRow label="Total Income" values={incomeTotals} showTotal={showTotal} colorClass="text-blue-400" borderClass="border-blue-500/30" budgetMode={budgetMode} monthlyBudgetTotal={incomeBudgetTotal} kind="income" isBudgetSet={incomeBudgetTotal > 0 || incomeNodes.some((n) => Array.from(collectAllIds(n)).some((id) => localBudgets.has(id)))} />

                  <tr>
                    <td colSpan={monthCols.length + (showTotal ? 2 : 1) + (budgetMode ? 1 : 0)} className="py-2 px-3 text-xs font-bold uppercase tracking-widest text-orange-400 pt-6">Expenses</td>
                  </tr>
                  {expenseNodes.map((n) => (
                    <IncomeRow key={n.id} node={n} depth={0} cols={expenseCols} showTotal={showTotal} sortColIdx={sortColIdx} kind="expense" onDrilldown={handleDrilldown} onContextMenu={handleContextMenu} budgetMode={budgetMode} budgets={localBudgets} onSetBudget={handleSetBudget} />
                  ))}
                  <SectionTotalRow label="Total Expenses" values={expenseTotals} showTotal={showTotal} colorClass="text-orange-400" borderClass="border-orange-400/30" budgetMode={budgetMode} monthlyBudgetTotal={expenseBudgetTotal} kind="expense" isBudgetSet={expenseBudgetTotal > 0 || expenseNodes.some((n) => Array.from(collectAllIds(n)).some((id) => localBudgets.has(id)))} />

                  <tr className="border-t-2 border-blue-500/50">
                    <td className="py-3 px-3 font-bold text-white" colSpan={budgetMode ? 2 : 1}>Net Income</td>
                    {netTotals.map((v, i) => (
                      <td key={i} className={cn('py-3 px-3 text-right font-mono font-bold tabular-nums', v >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {formatCurrency(v)}
                      </td>
                    ))}
                    {showTotal && (
                      <td className={cn('py-3 px-3 text-right font-mono font-bold border-l border-white/10', netTotals.reduce((s, v) => s + v, 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
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
                  <tr className="border-b border-white/5 hover:bg-white/3">
                    <td className="py-1.5 px-4 text-gray-400" style={{ paddingLeft: '16px' }}>Retained Earnings</td>
                    <td className={cn('py-1.5 px-4 text-right font-mono text-sm', retainedEarnings < 0 ? 'text-red-400' : 'text-emerald-400')}>{formatCurrency(retainedEarnings)}</td>
                    <td className={cn('py-1.5 px-4 text-right font-mono text-sm font-medium', retainedEarnings < 0 ? 'text-red-400' : 'text-emerald-400')}>{formatCurrency(retainedEarnings)}</td>
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

        {/* Drilldown panel */}
        {drilldown && (
          <DrilldownPanel
            target={drilldown}
            transactions={transactions}
            accounts={accounts}
            onClose={() => setDrilldown(null)}
          />
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="fixed z-50 bg-gray-800 border border-white/20 rounded-lg shadow-xl py-1 min-w-[200px]"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-white/10 flex items-center gap-2"
            onClick={() => handleDrilldown(ctxMenu.target)}
          >
            <Search size={13} className="text-blue-400" />
            Inspect transactions
          </button>
        </div>
      )}
    </div>
  );
}
