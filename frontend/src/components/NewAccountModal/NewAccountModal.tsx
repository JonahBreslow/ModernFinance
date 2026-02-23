import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Loader2, FolderPlus } from 'lucide-react';
import type { Account, AccountType } from '../../types';
import { cn, getAccountPath } from '../../lib/utils';
import { createAccount } from '../../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACCOUNT_TYPES: { value: AccountType; label: string; group: string }[] = [
  { value: 'BANK',       label: 'Bank',              group: 'Assets'      },
  { value: 'CASH',       label: 'Cash',              group: 'Assets'      },
  { value: 'ASSET',      label: 'Asset',             group: 'Assets'      },
  { value: 'STOCK',      label: 'Stock',             group: 'Assets'      },
  { value: 'MUTUAL',     label: 'Mutual Fund',       group: 'Assets'      },
  { value: 'RECEIVABLE', label: 'Accounts Receivable', group: 'Assets'   },
  { value: 'CREDIT',     label: 'Credit Card',       group: 'Liabilities' },
  { value: 'LIABILITY',  label: 'Liability',         group: 'Liabilities' },
  { value: 'PAYABLE',    label: 'Accounts Payable',  group: 'Liabilities' },
  { value: 'INCOME',     label: 'Income',            group: 'Income'      },
  { value: 'EXPENSE',    label: 'Expense',           group: 'Expenses'    },
  { value: 'EQUITY',     label: 'Equity',            group: 'Equity'      },
];

const TYPE_GROUPS = ['Assets', 'Liabilities', 'Income', 'Expenses', 'Equity'];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  accounts: Account[];
  defaultParentId?: string;
  onClose: () => void;
}

export function NewAccountModal({ accounts, defaultParentId, onClose }: Props) {
  const queryClient = useQueryClient();

  const [name,        setName]        = useState('');
  const [type,        setType]        = useState<AccountType>('EXPENSE');
  const [parentId,    setParentId]    = useState(defaultParentId ?? '');
  const [description, setDescription] = useState('');
  const [placeholder, setPlaceholder] = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Filter parent account candidates to non-ROOT, non-placeholder (or placeholder OK for nesting)
  const parentCandidates = accounts
    .filter((a) => a.type !== 'ROOT')
    .map((a) => ({ ...a, path: getAccountPath(a.id, accounts) }))
    .sort((a, b) => a.path.localeCompare(b.path));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Account name is required.'); return; }

    setSaving(true);
    setError(null);
    try {
      await createAccount({ name: name.trim(), type, parentId: parentId || null, description, placeholder });
      queryClient.invalidateQueries({ queryKey: ['gnucash'] });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <FolderPlus size={18} className="text-blue-400" />
          <h2 className="text-sm font-semibold text-gray-100">New Account</h2>
          <button
            onClick={onClose}
            className="ml-auto p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              Account name <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Groceries"
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Account type <span className="text-red-400">*</span></label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500 transition-colors"
            >
              {TYPE_GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {ACCOUNT_TYPES.filter((t) => t.group === group).map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Parent account */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Parent account</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">— none (top-level) —</option>
              {parentCandidates.map((a) => (
                <option key={a.id} value={a.id}>{a.path}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Description <span className="text-gray-700">(optional)</span></label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description…"
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Placeholder toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => setPlaceholder((p) => !p)}
              className={cn(
                'w-9 h-5 rounded-full flex-shrink-0 transition-colors relative',
                placeholder ? 'bg-blue-600' : 'bg-gray-700'
              )}
            >
              <span className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                placeholder ? 'translate-x-4' : 'translate-x-0.5'
              )} />
            </div>
            <span className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors select-none">
              Placeholder (contains sub-accounts only, cannot hold transactions)
            </span>
          </label>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {saving ? <><Loader2 size={13} className="animate-spin" />Creating…</> : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
