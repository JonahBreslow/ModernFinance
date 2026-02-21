export interface Split {
  id: string;
  accountId: string;
  value: number;
  quantity: number;
  reconciledState: 'n' | 'c' | 'y';
  reconcileDate: string | null;
  memo: string;
  action: string;
  onlineId: string | null;
}

export interface Transaction {
  id: string;
  description: string;
  datePosted: string;
  dateEntered: string;
  notes: string;
  currency: string;
  splits: Split[];
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  description: string;
  placeholder: boolean;
  hidden: boolean;
}

export type AccountType =
  | 'ROOT'
  | 'ASSET'
  | 'BANK'
  | 'CASH'
  | 'CREDIT'
  | 'LIABILITY'
  | 'INCOME'
  | 'EXPENSE'
  | 'EQUITY'
  | 'STOCK'
  | 'MUTUAL'
  | 'RECEIVABLE'
  | 'PAYABLE';

export interface GnuCashData {
  accounts: Account[];
  transactions: Transaction[];
}

export interface AccountNode extends Account {
  children: AccountNode[];
  balance: number;
  totalBalance: number;
}

export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'bimonthly' | 'quarterly';

/** A single transaction instance the user can mark as recurring */
export interface RecurringItem {
  /** Unique key: txnId + '|' + accountId */
  key: string;
  txnId: string;
  label: string;
  kind: 'expense' | 'income';
  accountId: string;
  accountName: string;
  /** Actual amount of this specific transaction split */
  amount: number;
  datePosted: string;
  /** Frequency chosen by the user */
  frequency: RecurringFrequency;
  /** Whether this item is active in the projection */
  enabled: boolean;
  /** Optional amount override (replaces the transaction's actual amount) */
  customAmount: number | null;
  /** Frequency hint surfaced from pattern analysis — shown as a suggestion only */
  suggestedFrequency: RecurringFrequency | null;
}

export interface ProjectionsData {
  items: RecurringItem[];
}
