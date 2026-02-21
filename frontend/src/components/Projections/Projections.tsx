import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import {
  RefreshCw, Save, ToggleLeft, ToggleRight,
  TrendingDown, TrendingUp, ChevronDown, ChevronRight,
  ChevronUp, Sparkles,
} from 'lucide-react';
import type {
  Account, Transaction, RecurringItem, RecurringFrequency, AccountNode,
} from '../../types';
import { cn, formatCurrency, formatDate, buildAccountTree } from '../../lib/utils';
import { fetchProjections, saveProjections } from '../../lib/api';
import {
  buildTransactionItems, mergeWithSaved, buildProjection,
} from '../../lib/detectRecurring';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

type TabKind = 'income' | 'expense' | 'projection';

const FREQ_LABELS: Record<RecurringFrequency, string> = {
  weekly:    'Weekly',
  biweekly:  'Bi-weekly',
  monthly:   'Monthly',
  bimonthly: 'Every 2 months',
  quarterly: 'Quarterly',
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectionsProps {
  accounts: Account[];
  transactions: Transaction[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini account tree (left panel)
// ─────────────────────────────────────────────────────────────────────────────

function countEnabledInTree(node: AccountNode, items: RecurringItem[]): number {
  const here = items.filter((i) => i.accountId === node.id && i.enabled).length;
  return here + node.children.reduce((s, c) => s + countEnabledInTree(c, items), 0);
}

function accountHasTxns(
  nodeId: string,
  transactions: Transaction[],
  kind: 'income' | 'expense',
  accounts: Account[],
): boolean {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const types = kind === 'income' ? new Set(['INCOME']) : new Set(['EXPENSE']);
  return transactions.some((t) =>
    t.splits.some((s) => {
      if (s.accountId !== nodeId) return false;
      const a = accountMap.get(s.accountId);
      return a && types.has(a.type);
    })
  );
}

function MiniTreeNode({
  node, depth, selectedId, onSelect, items, transactions, kind, accounts,
}: {
  node: AccountNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  items: RecurringItem[];
  transactions: Transaction[];
  kind: 'income' | 'expense';
  accounts: Account[];
}) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const enabledCount = countEnabledInTree(node, items);
  const hasTx = accountHasTxns(node.id, transactions, kind, accounts);
  const isSelected = node.id === selectedId;
  const clickable = hasTx && !node.placeholder;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-[5px] rounded cursor-pointer text-sm transition-colors',
          'hover:bg-white/5',
          isSelected && 'bg-blue-600/20',
          !hasTx && !hasChildren && 'opacity-30 cursor-default'
        )}
        style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: 8 }}
        onClick={() => {
          if (hasChildren) setOpen((o) => !o);
          if (clickable) onSelect(node.id);
        }}
      >
        <span className="w-4 flex-shrink-0 text-gray-600">
          {hasChildren ? (open ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : null}
        </span>
        <span className={cn(
          'flex-1 truncate',
          node.placeholder ? 'text-gray-400 font-medium' : isSelected ? 'text-blue-300' : 'text-gray-300',
        )}>
          {node.name}
        </span>
        {enabledCount > 0 && (
          <span className="flex-shrink-0 text-xs bg-blue-600/25 text-blue-400 rounded px-1.5 py-0.5 ml-1">
            {enabledCount}
          </span>
        )}
      </div>
      {open && hasChildren && node.children.map((c) => (
        <MiniTreeNode
          key={c.id} node={c} depth={depth + 1}
          selectedId={selectedId} onSelect={onSelect}
          items={items} transactions={transactions} kind={kind} accounts={accounts}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction list for selected account
// ─────────────────────────────────────────────────────────────────────────────

function TransactionRow({
  item,
  onToggle,
  onFrequency,
  onAmount,
}: {
  item: RecurringItem;
  onToggle: (key: string) => void;
  onFrequency: (key: string, freq: RecurringFrequency) => void;
  onAmount: (key: string, v: number | null) => void;
}) {
  const [editingAmt, setEditingAmt] = useState(false);
  const displayAmount = item.customAmount ?? item.amount;

  const commitAmt = (raw: string) => {
    const v = parseFloat(raw);
    onAmount(item.key, isNaN(v) ? null : Math.round(v * 100) / 100);
    setEditingAmt(false);
  };

  return (
    <tr className={cn(
      'border-b border-white/5 group transition-colors',
      item.enabled ? 'bg-blue-500/5' : 'hover:bg-white/[0.02]'
    )}>
      {/* Toggle */}
      <td className="pl-4 pr-2 py-2.5 w-10">
        <button
          onClick={() => onToggle(item.key)}
          className={cn(
            'transition-colors',
            item.enabled ? 'text-blue-400 hover:text-blue-300' : 'text-gray-700 hover:text-gray-400'
          )}
        >
          {item.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
      </td>

      {/* Date */}
      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono w-24 whitespace-nowrap">
        {formatDate(item.datePosted)}
      </td>

      {/* Description */}
      <td className="px-3 py-2.5">
        <span className={cn('text-sm', item.enabled ? 'text-gray-100' : 'text-gray-400')}>
          {item.label || <span className="italic text-gray-600">No description</span>}
        </span>
      </td>

      {/* Amount */}
      <td className="px-3 py-2.5 text-right w-32">
        {editingAmt ? (
          <input
            type="number" step="0.01"
            defaultValue={displayAmount.toFixed(2)}
            autoFocus
            className="bg-gray-800 border border-blue-500 rounded px-2 py-0.5 text-sm font-mono text-right w-28 outline-none"
            onBlur={(e) => commitAmt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAmt((e.target as HTMLInputElement).value);
              if (e.key === 'Escape') setEditingAmt(false);
            }}
          />
        ) : (
          <div className="flex items-center justify-end gap-1">
            <button
              onDoubleClick={() => setEditingAmt(true)}
              title="Double-click to override amount"
              className={cn(
                'font-mono text-sm',
                item.enabled
                  ? item.kind === 'expense' ? 'text-orange-400' : 'text-emerald-400'
                  : 'text-gray-500'
              )}
            >
              {formatCurrency(displayAmount)}
            </button>
            {item.customAmount !== null && (
              <button
                onClick={() => onAmount(item.key, null)}
                className="text-gray-600 hover:text-gray-400 text-xs"
                title="Reset to actual amount"
              >↺</button>
            )}
          </div>
        )}
        {item.customAmount !== null && (
          <p className="text-xs text-amber-600 text-right">Overridden</p>
        )}
      </td>

      {/* Frequency — only shown when enabled */}
      <td className="px-3 py-2.5 w-48">
        {item.enabled ? (
          <div>
            <select
              value={item.frequency}
              onChange={(e) => onFrequency(item.key, e.target.value as RecurringFrequency)}
              className="bg-gray-800 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 outline-none focus:border-blue-500 w-full"
            >
              {(Object.entries(FREQ_LABELS) as [RecurringFrequency, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            {item.suggestedFrequency && item.suggestedFrequency !== item.frequency && (
              <button
                className="flex items-center gap-1 mt-0.5 text-xs text-blue-500 hover:text-blue-400"
                onClick={() => onFrequency(item.key, item.suggestedFrequency!)}
                title="Apply suggested frequency"
              >
                <Sparkles size={10} />
                Suggested: {FREQ_LABELS[item.suggestedFrequency]}
              </button>
            )}
            {item.suggestedFrequency && item.suggestedFrequency === item.frequency && (
              <p className="flex items-center gap-1 mt-0.5 text-xs text-blue-600">
                <Sparkles size={10} />
                Auto-detected
              </p>
            )}
          </div>
        ) : (
          item.suggestedFrequency ? (
            <p className="flex items-center gap-1 text-xs text-gray-700">
              <Sparkles size={10} className="text-blue-700" />
              {FREQ_LABELS[item.suggestedFrequency]} detected
            </p>
          ) : null
        )}
      </td>
    </tr>
  );
}

function AccountTransactionList({
  accountId,
  accountName,
  kind,
  transactions,
  accounts,
  savedItems,
  onToggle,
  onFrequency,
  onAmount,
}: {
  accountId: string;
  accountName: string;
  kind: 'income' | 'expense';
  transactions: Transaction[];
  accounts: Account[];
  savedItems: RecurringItem[];
  onToggle: (key: string) => void;
  onFrequency: (key: string, freq: RecurringFrequency) => void;
  onAmount: (key: string, v: number | null) => void;
}) {
  // Build fresh items for this account (last 3 months), merged with saved state
  const items = useMemo(() => {
    const fresh = buildTransactionItems(transactions, accounts, kind, accountId);
    return mergeWithSaved(fresh, savedItems);
  }, [transactions, accounts, kind, accountId, savedItems]);

  const enabledCount = items.filter((i) => i.enabled).length;

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }, []);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm gap-1">
        <p>No transactions in the last 3 months</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/10 flex-shrink-0 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-100">{accountName}</h3>
          <p className="text-xs text-gray-600 mt-0.5">
            Since {cutoff} · {items.length} transactions · {enabledCount} marked recurring
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => items.filter((i) => !i.enabled).forEach((i) => onToggle(i.key))}
            className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200 border border-white/10 rounded transition-colors"
          >
            Enable all
          </button>
          <button
            onClick={() => items.filter((i) => i.enabled).forEach((i) => onToggle(i.key))}
            className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200 border border-white/10 rounded transition-colors"
          >
            Disable all
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-950 z-10">
            <tr className="text-xs text-gray-600 border-b border-white/10">
              <th className="pl-4 pr-2 py-2 w-10"></th>
              <th className="px-3 py-2 text-left w-24">Date</th>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right w-32">Amount</th>
              <th className="px-3 py-2 text-left w-48">Frequency</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <TransactionRow
                key={item.key}
                item={item}
                onToggle={onToggle}
                onFrequency={onFrequency}
                onAmount={onAmount}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Account explorer (tree + transaction list)
// ─────────────────────────────────────────────────────────────────────────────

function AccountExplorer({
  kind, accountTree, accounts, transactions, savedItems,
  onToggle, onFrequency, onAmount,
}: {
  kind: 'income' | 'expense';
  accountTree: AccountNode[];
  accounts: Account[];
  transactions: Transaction[];
  savedItems: RecurringItem[];
  onToggle: (key: string) => void;
  onFrequency: (key: string, freq: RecurringFrequency) => void;
  onAmount: (key: string, v: number | null) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const roots = accountTree.filter((n) =>
    kind === 'income' ? n.type === 'INCOME' : n.type === 'EXPENSE'
  );

  const kindItems = savedItems.filter((i) => i.kind === kind);

  // Auto-select the first account that has recent transactions
  useEffect(() => {
    if (selectedId) return;
    const cutoffStr = (() => {
      const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10);
    })();
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const types = kind === 'income' ? new Set(['INCOME']) : new Set(['EXPENSE']);
    const firstAcc = transactions.find((t) =>
      t.datePosted >= cutoffStr &&
      t.splits.some((s) => {
        const a = accountMap.get(s.accountId);
        return a && types.has(a.type) && !a.placeholder;
      })
    );
    if (firstAcc) {
      const split = firstAcc.splits.find((s) => {
        const a = accountMap.get(s.accountId);
        return a && types.has(a.type);
      });
      if (split) setSelectedId(split.accountId);
    }
  }, [accounts, transactions, kind, selectedId]);

  const selectedAccount = selectedId ? accounts.find((a) => a.id === selectedId) : null;

  return (
    <div className="flex h-full">
      {/* Left: account tree */}
      <div className="w-56 flex-shrink-0 border-r border-white/10 flex flex-col">
        <div className="px-3 pt-3 pb-1.5 border-b border-white/5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Accounts</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {roots.map((node) => (
            <MiniTreeNode
              key={node.id} node={node} depth={0}
              selectedId={selectedId} onSelect={setSelectedId}
              items={kindItems} transactions={transactions}
              kind={kind} accounts={accounts}
            />
          ))}
        </div>
      </div>

      {/* Right: transaction list */}
      <div className="flex-1 overflow-hidden bg-gray-950">
        {selectedId && selectedAccount ? (
          <AccountTransactionList
            accountId={selectedId}
            accountName={selectedAccount.name}
            kind={kind}
            transactions={transactions}
            accounts={accounts}
            savedItems={savedItems}
            onToggle={onToggle}
            onFrequency={onFrequency}
            onAmount={onAmount}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Select an account from the tree
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Projection chart + table
// ─────────────────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-white/20 rounded-lg p-3 text-sm shadow-xl min-w-[180px]">
      <p className="text-gray-400 mb-2 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-mono">{formatCurrency(Math.abs(p.value))}</span>
        </p>
      ))}
    </div>
  );
};

function ProjectionView({ items }: { items: RecurringItem[] }) {
  const projection = useMemo(() => buildProjection(items), [items]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalIncome   = projection.reduce((s, r) => s + r.income, 0);
  const totalExpenses = projection.reduce((s, r) => s + r.expenses, 0);
  const totalNet      = totalIncome - totalExpenses;
  const enabledCount  = items.filter((i) => i.enabled).length;

  if (enabledCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-600 gap-2">
        <TrendingUp size={36} className="opacity-20" />
        <p>Mark transactions as recurring in the Income and Expenses tabs to see your projection</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '6-Month Income',   value: totalIncome,   color: 'text-emerald-400' },
          { label: '6-Month Expenses', value: totalExpenses, color: 'text-orange-400'  },
          { label: '6-Month Net',      value: totalNet,      color: totalNet >= 0 ? 'text-blue-400' : 'text-red-400' },
        ].map((c) => (
          <div key={c.label} className="bg-gray-900 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={cn('text-2xl font-bold font-mono', c.color)}>
              {formatCurrency(Math.abs(c.value))}
            </p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Projected Cash Flow</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={projection} barGap={4} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} tickLine={false} />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={(v) => formatCurrency(v, true)}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
            <ReferenceLine y={0} stroke="#ffffff20" />
            <Bar dataKey="income"   name="Income"   fill="#10b981" radius={[4,4,0,0]} maxBarSize={36} />
            <Bar dataKey="expenses" name="Expenses" fill="#f97316" radius={[4,4,0,0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly table */}
      <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-gray-300">Monthly Breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-600 border-b border-white/5">
              <th className="px-4 py-2 text-left w-8"></th>
              <th className="px-4 py-2 text-left">Month</th>
              <th className="px-4 py-2 text-right">Income</th>
              <th className="px-4 py-2 text-right">Expenses</th>
              <th className="px-4 py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {projection.map((row) => (
              <>
                <tr
                  key={row.iso}
                  className="border-b border-white/5 hover:bg-white/3 cursor-pointer"
                  onClick={() => setExpanded(expanded === row.iso ? null : row.iso)}
                >
                  <td className="px-4 py-2.5 text-gray-600">
                    {row.lineItems.length > 0
                      ? expanded === row.iso ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      : null}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-200">{row.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-emerald-400">
                    {row.income > 0 ? formatCurrency(row.income) : <span className="text-gray-700">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-orange-400">
                    {row.expenses > 0 ? formatCurrency(row.expenses) : <span className="text-gray-700">—</span>}
                  </td>
                  <td className={cn(
                    'px-4 py-2.5 text-right font-mono font-semibold',
                    row.net >= 0 ? 'text-emerald-400' : 'text-red-400'
                  )}>
                    {(row.income > 0 || row.expenses > 0) ? formatCurrency(row.net) : <span className="text-gray-700">—</span>}
                  </td>
                </tr>
                {expanded === row.iso && row.lineItems.length > 0 && (
                  <tr key={`${row.iso}-d`} className="border-b border-white/5 bg-white/[0.015]">
                    <td colSpan={5} className="px-8 py-3">
                      <div className="space-y-1.5">
                        {row.lineItems.map((li, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className={li.kind === 'income' ? 'text-emerald-600' : 'text-orange-600'}>
                                {li.kind === 'income' ? '↑' : '↓'}
                              </span>
                              <span className="text-gray-400">{li.label}</span>
                            </div>
                            <span className={cn('font-mono', li.kind === 'income' ? 'text-emerald-500' : 'text-orange-500')}>
                              {li.kind === 'income' ? '+' : '−'}{formatCurrency(li.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            <tr className="border-t-2 border-white/20 bg-white/[0.02]">
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 font-bold text-gray-300">6-Month Total</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-emerald-400">{formatCurrency(totalIncome)}</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-orange-400">{formatCurrency(totalExpenses)}</td>
              <td className={cn('px-4 py-3 text-right font-mono font-bold', totalNet >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                {formatCurrency(totalNet)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Projections page
// ─────────────────────────────────────────────────────────────────────────────

export function Projections({ accounts, transactions }: ProjectionsProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKind>('income');
  // savedItems is the persisted list of enabled recurring items
  const [savedItems, setSavedItems] = useState<RecurringItem[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: savedData, isLoading } = useQuery({
    queryKey: ['projections'],
    queryFn: fetchProjections,
  });

  const saveMutation = useMutation({
    mutationFn: saveProjections,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projections'] });
      setDirty(false);
    },
  });

  // Hydrate from persisted data
  useEffect(() => {
    if (savedData) setSavedItems(savedData.items ?? []);
  }, [savedData]);

  // Update a specific item in savedItems. If it doesn't exist yet, add it.
  const upsertItem = useCallback((updated: RecurringItem) => {
    setSavedItems((prev) => {
      const idx = prev.findIndex((i) => i.key === updated.key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [...prev, updated];
    });
    setDirty(true);
  }, []);

  // Helpers that need to look up the current item state and upsert
  const handleToggle = useCallback((key: string, freshItems: RecurringItem[]) => {
    const current = savedItems.find((i) => i.key === key) ?? freshItems.find((i) => i.key === key);
    if (!current) return;
    upsertItem({ ...current, enabled: !current.enabled });
  }, [savedItems, upsertItem]);

  const handleFrequency = useCallback((key: string, frequency: RecurringFrequency, freshItems: RecurringItem[]) => {
    const current = savedItems.find((i) => i.key === key) ?? freshItems.find((i) => i.key === key);
    if (!current) return;
    upsertItem({ ...current, frequency });
  }, [savedItems, upsertItem]);

  const handleAmount = useCallback((key: string, customAmount: number | null, freshItems: RecurringItem[]) => {
    const current = savedItems.find((i) => i.key === key) ?? freshItems.find((i) => i.key === key);
    if (!current) return;
    upsertItem({ ...current, customAmount });
  }, [savedItems, upsertItem]);

  const accountTree = useMemo(() => buildAccountTree(accounts, []), [accounts]);

  const enabledTotal = savedItems.filter((i) => i.enabled).length;

  // Build full resolved items for projection (income + expense, all enabled accounts)
  const allProjectionItems = useMemo(() => {
    // Gather all accounts that appear in savedItems
    const accountIds = new Set(savedItems.map((i) => i.accountId));
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const result: RecurringItem[] = [];
    for (const accountId of accountIds) {
      const acc = accountMap.get(accountId);
      if (!acc) continue;
      const kind = acc.type === 'INCOME' ? 'income' : 'expense';
      const fresh = buildTransactionItems(transactions, accounts, kind, accountId);
      const merged = mergeWithSaved(fresh, savedItems);
      result.push(...merged.filter((i) => i.enabled));
    }
    // Also include enabled items from savedItems that might not be in the 3-month window
    // (if user saved and transactions aged out)
    return result;
  }, [savedItems, accounts, transactions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={20} className="animate-spin text-gray-500" />
      </div>
    );
  }

  const tabs: { id: TabKind; label: string; icon: React.ReactNode }[] = [
    { id: 'income',     label: 'Income',     icon: <TrendingUp size={14} />   },
    { id: 'expense',    label: 'Expenses',   icon: <TrendingDown size={14} /> },
    { id: 'projection', label: 'Projection', icon: <ChevronUp size={14} />    },
  ];

  // We pass curried handlers into AccountExplorer that capture fresh items via callback
  // The child builds fresh items and calls handlers with them included
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-white/10 flex-shrink-0 bg-gray-900/50">
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                tab === t.id ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-xs text-gray-600">
          {enabledTotal} recurring item{enabledTotal !== 1 ? 's' : ''} enabled
        </span>
        <button
          onClick={() => saveMutation.mutate({ items: savedItems })}
          disabled={saveMutation.isPending || !dirty}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors',
            dirty ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed'
          )}
        >
          <Save size={13} />
          {saveMutation.isPending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {(tab === 'income' || tab === 'expense') && (
          <AccountExplorerWrapper
            kind={tab}
            accountTree={accountTree}
            accounts={accounts}
            transactions={transactions}
            savedItems={savedItems}
            onToggle={handleToggle}
            onFrequency={handleFrequency}
            onAmount={handleAmount}
          />
        )}
        {tab === 'projection' && (
          <div className="h-full overflow-auto p-6">
            <div className="max-w-4xl mx-auto">
              <ProjectionView items={allProjectionItems} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper that builds fresh items and passes through to handlers
function AccountExplorerWrapper({
  kind, accountTree, accounts, transactions, savedItems,
  onToggle, onFrequency, onAmount,
}: {
  kind: 'income' | 'expense';
  accountTree: AccountNode[];
  accounts: Account[];
  transactions: Transaction[];
  savedItems: RecurringItem[];
  onToggle: (key: string, fresh: RecurringItem[]) => void;
  onFrequency: (key: string, freq: RecurringFrequency, fresh: RecurringItem[]) => void;
  onAmount: (key: string, v: number | null, fresh: RecurringItem[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const roots = accountTree.filter((n) =>
    kind === 'income' ? n.type === 'INCOME' : n.type === 'EXPENSE'
  );

  const kindItems = savedItems.filter((i) => i.kind === kind);

  useEffect(() => {
    if (selectedId) return;
    const cutoffStr = (() => {
      const d = new Date(); d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10);
    })();
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const types = kind === 'income' ? new Set(['INCOME']) : new Set(['EXPENSE']);
    const firstTxn = [...transactions]
      .sort((a, b) => b.datePosted.localeCompare(a.datePosted))
      .find((t) =>
        t.datePosted >= cutoffStr &&
        t.splits.some((s) => {
          const a = accountMap.get(s.accountId);
          return a && types.has(a.type) && !a.placeholder;
        })
      );
    if (firstTxn) {
      const split = firstTxn.splits.find((s) => {
        const a = accountMap.get(s.accountId);
        return a && types.has(a.type);
      });
      if (split) setSelectedId(split.accountId);
    }
  }, [accounts, transactions, kind, selectedId]);

  const selectedAccount = selectedId ? accounts.find((a) => a.id === selectedId) : null;

  // Build fresh items for the selected account (memoized)
  const freshItems = useMemo(() => {
    if (!selectedId) return [];
    return buildTransactionItems(transactions, accounts, kind, selectedId);
  }, [selectedId, transactions, accounts, kind]);

  const mergedItems = useMemo(
    () => mergeWithSaved(freshItems, savedItems),
    [freshItems, savedItems]
  );

  return (
    <div className="flex h-full">
      <div className="w-56 flex-shrink-0 border-r border-white/10 flex flex-col">
        <div className="px-3 pt-3 pb-1.5 border-b border-white/5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Accounts</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {roots.map((node) => (
            <MiniTreeNode
              key={node.id} node={node} depth={0}
              selectedId={selectedId} onSelect={setSelectedId}
              items={kindItems} transactions={transactions}
              kind={kind} accounts={accounts}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-gray-950">
        {selectedId && selectedAccount ? (
          <AccountTransactionList
            accountId={selectedId}
            accountName={selectedAccount.name}
            kind={kind}
            transactions={transactions}
            accounts={accounts}
            savedItems={savedItems}
            onToggle={(key) => onToggle(key, mergedItems)}
            onFrequency={(key, freq) => onFrequency(key, freq, mergedItems)}
            onAmount={(key, v) => onAmount(key, v, mergedItems)}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            Select an account from the tree
          </div>
        )}
      </div>
    </div>
  );
}

