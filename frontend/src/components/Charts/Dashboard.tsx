import { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, CreditCard } from 'lucide-react';
import type { Account, AccountNode, Transaction } from '../../types';
import { cn, formatCurrency, buildAccountTree } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';

interface DashboardProps {
  accounts: Account[];
  transactions: Transaction[];
}

const EXPENSE_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd',
  '#818cf8', '#60a5fa', '#34d399', '#fbbf24',
  '#f87171', '#fb923c', '#e879f9', '#2dd4bf',
];

function StatCard({
  label,
  value,
  change,
  icon,
  colorClass,
}: {
  label: string;
  value: number;
  change?: number;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">{label}</p>
        <span className={cn('p-1.5 rounded-lg bg-white/5', colorClass)}>{icon}</span>
      </div>
      <p className={cn('text-2xl font-bold', colorClass)}>{formatCurrency(Math.abs(value))}</p>
      {change !== undefined && (
        <p className={cn('text-xs mt-1', change >= 0 ? 'text-emerald-400' : 'text-red-400')}>
          {change >= 0 ? '↑' : '↓'} {formatCurrency(Math.abs(change))} this month
        </p>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 border border-white/20 rounded-lg p-3 text-sm shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(Math.abs(p.value))}
        </p>
      ))}
    </div>
  );
};

export function Dashboard({ accounts, transactions }: DashboardProps) {
  const { setSelectedAccount } = useAppStore();
  const [period, setPeriod] = useState<'3m' | '6m' | '12m' | 'all'>('12m');

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  // Filter transactions by period
  const now = new Date();
  const cutoff = useMemo(() => {
    if (period === 'all') return new Date(0);
    const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;
    const d = new Date(now);
    d.setMonth(d.getMonth() - months);
    return d;
  }, [period]);

  const filteredTxns = useMemo(
    () =>
      transactions.filter((t) => {
        const d = new Date(t.datePosted + 'T00:00:00');
        return d >= cutoff;
      }),
    [transactions, cutoff]
  );

  // Net worth (all time, using all transactions)
  const { netWorthData } = useMemo(() => {
    const assetIds = new Set(
      accounts
        .filter((a) => ['ASSET', 'BANK', 'CASH', 'STOCK', 'MUTUAL', 'RECEIVABLE'].includes(a.type))
        .map((a) => a.id)
    );
    const liabIds = new Set(
      accounts
        .filter((a) => ['LIABILITY', 'CREDIT', 'PAYABLE'].includes(a.type))
        .map((a) => a.id)
    );

    const sorted = [...transactions].sort((a, b) =>
      a.datePosted.localeCompare(b.datePosted)
    );

    let assets = 0;
    let liabs = 0;
    const points: { month: string; assets: number; liabilities: number; netWorth: number }[] = [];
    let currentMonth = '';

    for (const txn of sorted) {
      const month = txn.datePosted.slice(0, 7);
      for (const split of txn.splits) {
        if (assetIds.has(split.accountId)) assets += split.value;
        if (liabIds.has(split.accountId)) liabs += split.value;
      }
      if (month !== currentMonth) {
        currentMonth = month;
        const [y, mo] = month.split('-').map(Number);
        points.push({
          month: new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          assets: Math.round(assets),
          liabilities: Math.round(-liabs),
          netWorth: Math.round(assets + liabs),
        });
      }
    }
    return { netWorthData: points };
  }, [transactions, accounts]);

  // Spending by category (expense accounts, current period)
  const spendingByCategory = useMemo(() => {
    const expenseIds = new Set(
      accounts.filter((a) => a.type === 'EXPENSE').map((a) => a.id)
    );
    const totals = new Map<string, number>();

    for (const txn of filteredTxns) {
      for (const split of txn.splits) {
        if (expenseIds.has(split.accountId)) {
          const acc = accountMap.get(split.accountId)!;
          const cur = totals.get(acc.name) ?? 0;
          totals.set(acc.name, cur + split.value);
        }
      }
    }

    return Array.from(totals.entries())
      .map(([name, value]) => ({ name, value: Math.abs(value) }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [filteredTxns, accounts, accountMap]);

  // Income vs Expenses by month
  const monthlyData = useMemo(() => {
    const incomeIds = new Set(
      accounts.filter((a) => a.type === 'INCOME').map((a) => a.id)
    );
    const expenseIds = new Set(
      accounts.filter((a) => a.type === 'EXPENSE').map((a) => a.id)
    );

    const currentMonthKey = now.toISOString().slice(0, 7);
    const map = new Map<string, { income: number; expenses: number }>();

    // Always include the current month so it appears even with no transactions yet
    map.set(currentMonthKey, { income: 0, expenses: 0 });

    for (const txn of filteredTxns) {
      const month = txn.datePosted.slice(0, 7);
      if (!map.has(month)) map.set(month, { income: 0, expenses: 0 });
      const entry = map.get(month)!;
      for (const split of txn.splits) {
        if (incomeIds.has(split.accountId)) entry.income += -split.value;
        if (expenseIds.has(split.accountId)) entry.expenses += split.value;
      }
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const [y, m] = month.split('-').map(Number);
        return {
          month: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          income: Math.round(data.income),
          expenses: Math.round(data.expenses),
          savings: Math.round(data.income - data.expenses),
          isCurrent: month === currentMonthKey,
        };
      });
  }, [filteredTxns, accounts]);

  // Summary stats
  const summary = useMemo(() => {
    const thisMonth = now.toISOString().slice(0, 7);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString().slice(0, 7);

    const incomeIds = new Set(
      accounts.filter((a) => a.type === 'INCOME').map((a) => a.id)
    );
    const expenseIds = new Set(
      accounts.filter((a) => a.type === 'EXPENSE').map((a) => a.id)
    );
    const assetIds = new Set(
      accounts.filter((a) => ['ASSET', 'BANK', 'CASH'].includes(a.type)).map((a) => a.id)
    );
    const liabIds = new Set(
      accounts.filter((a) => ['LIABILITY', 'CREDIT', 'PAYABLE'].includes(a.type)).map((a) => a.id)
    );

    let totalAssets = 0, totalLiabs = 0, thisMonthIncome = 0, thisMonthExpenses = 0;
    let lastMonthExpenses = 0;

    for (const txn of transactions) {
      const month = txn.datePosted.slice(0, 7);
      for (const split of txn.splits) {
        if (assetIds.has(split.accountId)) totalAssets += split.value;
        if (liabIds.has(split.accountId)) totalLiabs += split.value;
        if (month === thisMonth) {
          if (incomeIds.has(split.accountId)) thisMonthIncome += -split.value;
          if (expenseIds.has(split.accountId)) thisMonthExpenses += split.value;
        }
        if (month === lastMonth) {
          if (expenseIds.has(split.accountId)) lastMonthExpenses += split.value;
        }
      }
    }

    return {
      netWorth: totalAssets + totalLiabs,
      totalAssets,
      totalLiabs: -totalLiabs,
      thisMonthIncome,
      thisMonthExpenses,
      spendingChange: thisMonthExpenses - lastMonthExpenses,
    };
  }, [transactions, accounts]);

  // Recent transactions
  const recentTxns = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.datePosted.localeCompare(a.datePosted))
        .slice(0, 8),
    [transactions]
  );

  return (
    <div className="overflow-auto h-full">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-100">Dashboard</h1>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
            {(['3m', '6m', '12m', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1 text-xs rounded-md transition-colors',
                  period === p
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                )}
              >
                {p === 'all' ? 'All' : p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Net Worth"
            value={summary.netWorth}
            icon={<Wallet size={16} />}
            colorClass="text-blue-400"
          />
          <StatCard
            label="Total Assets"
            value={summary.totalAssets}
            icon={<TrendingUp size={16} />}
            colorClass="text-emerald-400"
          />
          <StatCard
            label="Total Liabilities"
            value={summary.totalLiabs}
            icon={<CreditCard size={16} />}
            colorClass="text-red-400"
          />
          <StatCard
            label="Spending This Month"
            value={summary.thisMonthExpenses}
            change={summary.spendingChange}
            icon={<TrendingDown size={16} />}
            colorClass="text-orange-400"
          />
        </div>

        {/* Net Worth chart */}
        <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Net Worth Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={netWorthData}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="assetsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCurrency(v, true)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="assets" name="Assets" stroke="#10b981" fill="url(#assetsGrad)" strokeWidth={1.5} dot={false} />
              <Area type="monotone" dataKey="netWorth" name="Net Worth" stroke="#3b82f6" fill="url(#nwGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bottom row: Income/Expenses + Spending pie */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Income vs Expenses bar chart */}
          <div className="lg:col-span-2 bg-gray-900 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Income vs Expenses</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCurrency(v, true)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24}>
                  {monthlyData.map((entry, i) => (
                    <Cell key={i} fill="#10b981" fillOpacity={entry.isCurrent ? 0.4 : 1} />
                  ))}
                </Bar>
                <Bar dataKey="expenses" name="Expenses" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={24}>
                  {monthlyData.map((entry, i) => (
                    <Cell key={i} fill="#f97316" fillOpacity={entry.isCurrent ? 0.4 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Spending pie */}
          <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Spending by Category</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={spendingByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {spendingByCategory.map((_, idx) => (
                    <Cell key={idx} fill={EXPENSE_COLORS[idx % EXPENSE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2 overflow-auto max-h-32">
              {spendingByCategory.slice(0, 8).map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: EXPENSE_COLORS[i % EXPENSE_COLORS.length] }}
                  />
                  <span className="flex-1 truncate text-gray-400">{d.name}</span>
                  <span className="text-gray-500 tabular-nums">{formatCurrency(d.value, true)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Transactions</h3>
          <div className="space-y-1">
            {recentTxns.map((txn) => {
              const split = txn.splits[0];
              const acc = accountMap.get(split?.accountId ?? '');
              return (
                <div
                  key={txn.id}
                  className="flex items-center gap-3 py-2 px-2 hover:bg-white/5 rounded cursor-pointer group"
                  onClick={() => acc && setSelectedAccount(acc.id)}
                >
                  <span className="text-xs text-gray-600 font-mono w-20 flex-shrink-0">
                    {txn.datePosted.slice(5).replace('-', '/')}
                  </span>
                  <span className="flex-1 text-sm text-gray-300 truncate">
                    {txn.description || <span className="text-gray-600 italic">No description</span>}
                  </span>
                  <span className="text-xs text-gray-600 w-32 truncate text-right">
                    {acc?.name ?? '?'}
                  </span>
                  <span className={cn(
                    'text-sm font-mono w-24 text-right',
                    split?.value < 0 ? 'text-red-400' : 'text-emerald-400'
                  )}>
                    {formatCurrency(split?.value ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
