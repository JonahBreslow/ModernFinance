import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight, ChevronDown,
  TrendingUp, TrendingDown, PiggyBank, Building2, CreditCard,
  FolderPlus, Pencil, Trash2, Check, X, AlertTriangle,
} from 'lucide-react';
import type { Account, AccountNode } from '../../types';
import { cn, formatCurrency, getAccountDisplayBalance } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { renameAccount, deleteAccount } from '../../lib/api';
import { NewAccountModal } from '../NewAccountModal/NewAccountModal';

// ─────────────────────────────────────────────────────────────────────────────
// Group config
// ─────────────────────────────────────────────────────────────────────────────

const GROUP_CONFIG: Record<string, { label: string; icon: React.ReactNode; colorClass: string }> = {
  Assets:      { label: 'Assets',      icon: <Building2 size={14} />,    colorClass: 'text-emerald-400' },
  Liabilities: { label: 'Liabilities', icon: <CreditCard size={14} />,   colorClass: 'text-red-400'     },
  Income:      { label: 'Income',      icon: <TrendingUp size={14} />,   colorClass: 'text-blue-400'    },
  Expenses:    { label: 'Expenses',    icon: <TrendingDown size={14} />, colorClass: 'text-orange-400'  },
  Equity:      { label: 'Equity',      icon: <PiggyBank size={14} />,    colorClass: 'text-purple-400'  },
};

function getGroupForNode(node: AccountNode): string {
  if (['ASSET', 'BANK', 'CASH', 'STOCK', 'MUTUAL', 'RECEIVABLE'].includes(node.type)) return 'Assets';
  if (['LIABILITY', 'CREDIT', 'PAYABLE'].includes(node.type)) return 'Liabilities';
  if (node.type === 'INCOME') return 'Income';
  if (node.type === 'EXPENSE') return 'Expenses';
  if (node.type === 'EQUITY') return 'Equity';
  return 'Assets';
}

// ─────────────────────────────────────────────────────────────────────────────
// Context menu
// ─────────────────────────────────────────────────────────────────────────────

function ContextMenu({
  x, y, node,
  onAddSub, onRename, onDelete, onClose,
}: {
  x: number; y: number;
  node: AccountNode;
  onAddSub: () => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Adjust position so it doesn't overflow viewport
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(x, window.innerWidth  - width  - 8),
      y: Math.min(y, window.innerHeight - height - 8),
    });
  }, [x, y]);

  return (
    <>
      {/* invisible full-screen closer */}
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={ref}
        className="fixed z-50 min-w-[200px] bg-gray-800 border border-white/10 rounded-lg shadow-2xl py-1 text-sm overflow-hidden"
        style={{ left: pos.x, top: pos.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-1.5 text-xs text-gray-500 font-medium border-b border-white/5 truncate max-w-[220px]">
          {node.name}
        </div>

        {confirmDelete ? (
          /* ── Confirmation view ── */
          <div className="px-3 py-2.5 space-y-2">
            <div className="flex items-start gap-2 text-xs text-gray-300">
              <AlertTriangle size={13} className="text-amber-400 mt-0.5 flex-shrink-0" />
              <span>Delete <span className="font-semibold text-white">"{node.name}"</span>? This cannot be undone.</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { onDelete(); onClose(); }}
                className="flex-1 px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── Normal actions ── */
          <>
            <button
              onClick={() => { onAddSub(); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left"
            >
              <FolderPlus size={13} className="text-blue-400" />
              Add sub-account
            </button>
            <button
              onClick={() => { onRename(); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-gray-300 hover:bg-white/5 hover:text-white transition-colors text-left"
            >
              <Pencil size={13} className="text-gray-400" />
              Rename
            </button>
            <div className="border-t border-white/5 mt-1 pt-1">
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left"
              >
                <Trash2 size={13} />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Account row
// ─────────────────────────────────────────────────────────────────────────────

function AccountRow({
  node, depth, onSelect, selectedId,
  onContextMenu,
  renamingId, renameDraft, onRenameDraftChange, onRenameSubmit, onRenameCancel,
}: {
  node: AccountNode;
  depth: number;
  onSelect: (id: string) => void;
  selectedId: string | null;
  onContextMenu: (node: AccountNode, e: React.MouseEvent) => void;
  renamingId: string | null;
  renameDraft: string;
  onRenameDraftChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected  = node.id === selectedId;
  const isRenaming  = node.id === renamingId;
  const displayBalance = getAccountDisplayBalance(node.totalBalance, node.type);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) inputRef.current?.select();
  }, [isRenaming]);

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-[3px] rounded cursor-pointer group text-sm',
          'hover:bg-white/5 transition-colors',
          isSelected && 'bg-blue-600/20 text-blue-300'
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => {
          if (isRenaming) return;
          if (!node.placeholder) onSelect(node.id);
          if (hasChildren) setExpanded((e) => !e);
        }}
        onContextMenu={(e) => onContextMenu(node, e)}
      >
        {/* expand/collapse chevron */}
        <span className="w-4 flex-shrink-0 text-gray-500">
          {hasChildren
            ? expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
            : null}
        </span>

        {/* Name — normal display or inline rename input */}
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameDraft}
            onChange={(e) => onRenameDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  { e.preventDefault(); onRenameSubmit(); }
              if (e.key === 'Escape') { e.preventDefault(); onRenameCancel(); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-gray-700 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-gray-100 outline-none min-w-0"
          />
        ) : (
          <span className={cn(
            'flex-1 truncate',
            node.placeholder ? 'text-gray-400 font-medium' : 'text-gray-200'
          )}>
            {node.name}
          </span>
        )}

        {/* Rename action buttons or balance */}
        {isRenaming ? (
          <span className="flex items-center gap-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onRenameSubmit}
              className="p-0.5 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors"
              title="Confirm rename"
            >
              <Check size={11} />
            </button>
            <button
              onClick={onRenameCancel}
              className="p-0.5 rounded hover:bg-red-500/20 text-red-400 transition-colors"
              title="Cancel rename"
            >
              <X size={11} />
            </button>
          </span>
        ) : (
          <span className={cn(
            'text-xs tabular-nums ml-2 flex-shrink-0',
            displayBalance < 0 ? 'text-red-400' : 'text-gray-400',
            isSelected && 'text-blue-300'
          )}>
            {formatCurrency(displayBalance)}
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <AccountRow
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
              onContextMenu={onContextMenu}
              renamingId={renamingId}
              renameDraft={renameDraft}
              onRenameDraftChange={onRenameDraftChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Group section
// ─────────────────────────────────────────────────────────────────────────────

function GroupSection({
  label, nodes, selectedId, onSelect,
  onContextMenu, renamingId, renameDraft,
  onRenameDraftChange, onRenameSubmit, onRenameCancel,
}: {
  label: string;
  nodes: AccountNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContextMenu: (node: AccountNode, e: React.MouseEvent) => void;
  renamingId: string | null;
  renameDraft: string;
  onRenameDraftChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
}) {
  const [open, setOpen] = useState(true);
  const config = GROUP_CONFIG[label];
  const totalBalance   = nodes.reduce((s, n) => s + n.totalBalance, 0);
  const displayBalance = getAccountDisplayBalance(totalBalance, nodes[0]?.type ?? 'ASSET');

  return (
    <div className="mb-1">
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={config?.colorClass}>{config?.icon}</span>
        <span className="flex-1 text-left">{label}</span>
        <span className={cn('tabular-nums normal-case font-normal text-xs', config?.colorClass)}>
          {formatCurrency(Math.abs(displayBalance))}
        </span>
        <span className="text-gray-600">
          {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
      </button>
      {open && (
        <div>
          {nodes.map((node) => (
            <AccountRow
              key={node.id}
              node={node}
              depth={0}
              onSelect={onSelect}
              selectedId={selectedId}
              onContextMenu={onContextMenu}
              renamingId={renamingId}
              renameDraft={renameDraft}
              onRenameDraftChange={onRenameDraftChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main AccountTree
// ─────────────────────────────────────────────────────────────────────────────

interface AccountTreeProps {
  roots: AccountNode[];
  accounts: Account[];
}

export function AccountTree({ roots, accounts }: AccountTreeProps) {
  const queryClient = useQueryClient();
  const { selectedAccountId, setSelectedAccount } = useAppStore();

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ node: AccountNode; x: number; y: number } | null>(null);

  // Rename state
  const [renaming, setRenaming] = useState<{ id: string; draft: string } | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);

  // New-sub-account modal state
  const [addSubParent, setAddSubParent] = useState<AccountNode | null>(null);

  // Close context menu when Escape is pressed
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtxMenu(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleContextMenu = useCallback((node: AccountNode, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ node, x: e.clientX, y: e.clientY });
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!renaming?.draft.trim()) return;
    setRenameError(null);
    try {
      await renameAccount(renaming.id, renaming.draft.trim());
      queryClient.invalidateQueries({ queryKey: ['gnucash'] });
      setRenaming(null);
    } catch (err: any) {
      setRenameError(err.message);
    }
  }, [renaming, queryClient]);

  const handleRenameCancel = useCallback(() => {
    setRenaming(null);
    setRenameError(null);
  }, []);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const handleDelete = useCallback(async (node: AccountNode) => {
    setDeleteError(null);
    try {
      await deleteAccount(node.id);
      queryClient.invalidateQueries({ queryKey: ['gnucash'] });
    } catch (err: any) {
      setDeleteError(err.message);
    }
  }, [queryClient]);

  const groups: Record<string, AccountNode[]> = {
    Assets: [], Liabilities: [], Income: [], Expenses: [], Equity: [],
  };
  for (const node of roots) groups[getGroupForNode(node)].push(node);

  return (
    <>
      <div className="overflow-y-auto flex-1 pb-4">
        {Object.entries(groups).map(([label, nodes]) =>
          nodes.length > 0 ? (
            <GroupSection
              key={label}
              label={label}
              nodes={nodes}
              selectedId={selectedAccountId}
              onSelect={setSelectedAccount}
              onContextMenu={handleContextMenu}
              renamingId={renaming?.id ?? null}
              renameDraft={renaming?.draft ?? ''}
              onRenameDraftChange={(v) => setRenaming((r) => r ? { ...r, draft: v } : null)}
              onRenameSubmit={handleRenameSubmit}
              onRenameCancel={handleRenameCancel}
            />
          ) : null
        )}

        {renameError && (
          <p className="text-xs text-red-400 px-3 py-1">{renameError}</p>
        )}
      </div>

      {/* Error toasts */}
      {(renameError || deleteError) && (
        <div className="mx-2 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start gap-2">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{renameError || deleteError}</span>
          <button className="ml-auto" onClick={() => { setRenameError(null); setDeleteError(null); }}><X size={11} /></button>
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          node={ctxMenu.node}
          onAddSub={() => { setAddSubParent(ctxMenu.node); setCtxMenu(null); }}
          onRename={() => { setRenaming({ id: ctxMenu.node.id, draft: ctxMenu.node.name }); setCtxMenu(null); }}
          onDelete={() => handleDelete(ctxMenu.node)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* New sub-account modal */}
      {addSubParent && (
        <NewAccountModal
          accounts={accounts}
          defaultParentId={addSubParent.id}
          onClose={() => setAddSubParent(null)}
        />
      )}
    </>
  );
}
