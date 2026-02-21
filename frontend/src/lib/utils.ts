import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Account, AccountNode, AccountType, Transaction } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

export function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Account types that are "natural debit" (positive = more asset/expense)
const DEBIT_TYPES: Set<AccountType> = new Set([
  'ASSET', 'BANK', 'CASH', 'STOCK', 'MUTUAL', 'RECEIVABLE', 'EXPENSE',
]);

// Account types that are "natural credit" (positive = more liability/income/equity)
const CREDIT_TYPES: Set<AccountType> = new Set([
  'LIABILITY', 'CREDIT', 'INCOME', 'EQUITY', 'PAYABLE',
]);

export function isDebitAccount(type: AccountType): boolean {
  return DEBIT_TYPES.has(type);
}

export function isCreditAccount(type: AccountType): boolean {
  return CREDIT_TYPES.has(type);
}

export function buildAccountTree(
  accounts: Account[],
  transactions: Transaction[]
): AccountNode[] {
  const balances = computeAccountBalances(accounts, transactions);

  const nodeMap = new Map<string, AccountNode>();
  for (const acc of accounts) {
    nodeMap.set(acc.id, {
      ...acc,
      children: [],
      balance: balances.get(acc.id) ?? 0,
      totalBalance: 0,
    });
  }

  const roots: AccountNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.type === 'ROOT') continue;
    if (!node.parentId || !nodeMap.has(node.parentId)) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(node.parentId)!;
      if (parent.type !== 'ROOT') {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  // Compute totalBalance (includes children)
  function sumTotal(node: AccountNode): number {
    let total = node.balance;
    for (const child of node.children) {
      total += sumTotal(child);
    }
    node.totalBalance = total;
    return total;
  }
  for (const root of roots) sumTotal(root);

  // Sort: group by type order, then alphabetical
  const typeOrder: Record<string, number> = {
    ASSET: 0, BANK: 1, CASH: 2, STOCK: 3, MUTUAL: 4,
    RECEIVABLE: 5, LIABILITY: 10, CREDIT: 11, PAYABLE: 12,
    INCOME: 20, EXPENSE: 21, EQUITY: 30,
  };

  function sortChildren(nodes: AccountNode[]) {
    nodes.sort((a, b) => {
      const ao = typeOrder[a.type] ?? 99;
      const bo = typeOrder[b.type] ?? 99;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) sortChildren(n.children);
  }
  sortChildren(roots);

  return roots;
}

export function computeAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): Map<string, number> {
  const balances = new Map<string, number>();
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  for (const txn of transactions) {
    for (const split of txn.splits) {
      const acc = accountMap.get(split.accountId);
      if (!acc) continue;
      const cur = balances.get(split.accountId) ?? 0;
      balances.set(split.accountId, cur + split.value);
    }
  }
  return balances;
}

export function getAccountDisplayBalance(
  balance: number,
  type: AccountType
): number {
  // Liabilities and income are stored as negative in splits (credit-normal)
  // We flip them for display so the user sees positive numbers
  if (isCreditAccount(type)) return -balance;
  return balance;
}

export function getTopLevelGroups(roots: AccountNode[]) {
  const groups: Record<string, AccountNode[]> = {
    Assets: [],
    Liabilities: [],
    Income: [],
    Expenses: [],
    Equity: [],
  };
  for (const node of roots) {
    if (['ASSET', 'BANK', 'CASH', 'STOCK', 'MUTUAL'].includes(node.type)) {
      groups.Assets.push(node);
    } else if (['LIABILITY', 'CREDIT', 'PAYABLE'].includes(node.type)) {
      groups.Liabilities.push(node);
    } else if (node.type === 'INCOME') {
      groups.Income.push(node);
    } else if (node.type === 'EXPENSE') {
      groups.Expenses.push(node);
    } else if (node.type === 'EQUITY') {
      groups.Equity.push(node);
    }
  }
  return groups;
}

export function generateGuid(): string {
  return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

export function getAccountPath(
  accountId: string,
  accounts: Account[]
): string {
  const map = new Map(accounts.map((a) => [a.id, a]));
  const parts: string[] = [];
  let current = map.get(accountId);
  while (current && current.type !== 'ROOT') {
    parts.unshift(current.name);
    current = current.parentId ? map.get(current.parentId) : undefined;
  }
  return parts.join(' > ');
}
