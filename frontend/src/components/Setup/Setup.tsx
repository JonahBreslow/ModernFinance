import { useState } from 'react';
import { BookOpen, FolderOpen, Sparkles, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

type Mode = 'choose' | 'link' | 'new';

async function apiPost(endpoint: string, body: object) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Link existing file panel ─────────────────────────────────────────────────

function LinkPanel({ onDone }: { onDone: () => void }) {
  const [filePath, setFilePath] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!filePath.trim()) return;
    setLoading(true); setError(null);
    try {
      await apiPost('/api/setup/link', { filePath: filePath.trim() });
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">
          Absolute path to your <code className="text-blue-400">.gnucash</code> file
        </label>
        <input
          autoFocus
          type="text"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          placeholder="/Users/you/Documents/finances.gnucash"
          className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-blue-500 transition-colors font-mono"
        />
        <p className="text-xs text-gray-600 mt-1.5">
          The file must already exist. GnuCash backups (.log, .gnucash.YYYYMMDD…) will be stored in the same directory.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !filePath.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {loading ? <><Loader2 size={14} className="animate-spin" />Linking…</> : <>Link file <ArrowRight size={14} /></>}
      </button>
    </form>
  );
}

// ─── New file panel ───────────────────────────────────────────────────────────

const DEFAULT_ACCOUNTS = [
  { group: 'Assets',      accounts: ['Checking Account', 'Savings Account'] },
  { group: 'Liabilities', accounts: ['Credit Card'] },
  { group: 'Income',      accounts: ['Salary', 'Other Income'] },
  { group: 'Expenses',    accounts: ['Groceries', 'Utilities', 'Housing', 'Transportation', 'Other Expenses'] },
  { group: 'Equity',      accounts: ['Opening Balances', 'Imbalance-USD'] },
];

function NewPanel({ onDone }: { onDone: () => void }) {
  const [filePath, setFilePath] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!filePath.trim()) return;
    setLoading(true); setError(null);
    try {
      await apiPost('/api/setup/new', { filePath: filePath.trim() });
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs text-gray-500 mb-1.5">
          Where to save your new <code className="text-blue-400">.gnucash</code> file
        </label>
        <input
          autoFocus
          type="text"
          value={filePath}
          onChange={(e) => setFilePath(e.target.value)}
          placeholder="/Users/you/Documents/finances.gnucash"
          className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-blue-500 transition-colors font-mono"
        />
        <p className="text-xs text-gray-600 mt-1.5">The directory must already exist. The file will be created fresh.</p>
      </div>

      {/* Account preview */}
      <div className="bg-gray-800/50 border border-white/5 rounded-lg p-3 space-y-2">
        <p className="text-xs text-gray-500 font-medium">Starter accounts that will be created:</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {DEFAULT_ACCOUNTS.map(({ group, accounts }) => (
            <div key={group}>
              <p className="text-xs font-semibold text-gray-400">{group}</p>
              {accounts.map((a) => (
                <p key={a} className="text-xs text-gray-600 pl-2">• {a}</p>
              ))}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600">You can add, rename, or delete any of these after setup.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !filePath.trim()}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {loading
          ? <><Loader2 size={14} className="animate-spin" />Creating…</>
          : <><Sparkles size={14} />Create new file</>}
      </button>
    </form>
  );
}

// ─── Main setup screen ────────────────────────────────────────────────────────

export function Setup({ onComplete }: { onComplete: () => void }) {
  const [mode, setMode] = useState<Mode>('choose');

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 bg-blue-600/20 rounded-2xl">
              <BookOpen size={32} className="text-blue-400" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-100">Welcome to GnuCash Web</h1>
          <p className="text-sm text-gray-500">
            A modern web interface for your GnuCash finances. Let's point it at your data.
          </p>
        </div>

        {/* Mode chooser */}
        {mode === 'choose' && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMode('link')}
              className="group flex flex-col items-start gap-3 p-5 bg-gray-900 border border-white/10 rounded-2xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left"
            >
              <div className="p-2 bg-blue-500/10 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                <FolderOpen size={22} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-100">Link existing file</p>
                <p className="text-xs text-gray-500 mt-1">
                  Already use GnuCash? Point this app at your existing <code>.gnucash</code> file.
                </p>
              </div>
              <ArrowRight size={14} className="text-gray-600 group-hover:text-blue-400 mt-auto ml-auto transition-colors" />
            </button>

            <button
              onClick={() => setMode('new')}
              className="group flex flex-col items-start gap-3 p-5 bg-gray-900 border border-white/10 rounded-2xl hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-left"
            >
              <div className="p-2 bg-emerald-500/10 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                <Sparkles size={22} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-100">Start fresh</p>
                <p className="text-xs text-gray-500 mt-1">
                  New to GnuCash? Create a new file with starter accounts ready to go.
                </p>
              </div>
              <ArrowRight size={14} className="text-gray-600 group-hover:text-emerald-400 mt-auto ml-auto transition-colors" />
            </button>
          </div>
        )}

        {/* Link panel */}
        {mode === 'link' && (
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setMode('choose')} className="text-gray-600 hover:text-gray-400 text-xs">← Back</button>
              <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <FolderOpen size={15} className="text-blue-400" /> Link existing file
              </h2>
            </div>
            <LinkPanel onDone={onComplete} />
          </div>
        )}

        {/* New file panel */}
        {mode === 'new' && (
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setMode('choose')} className="text-gray-600 hover:text-gray-400 text-xs">← Back</button>
              <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                <Sparkles size={15} className="text-emerald-400" /> Start fresh
              </h2>
            </div>
            <NewPanel onDone={onComplete} />
          </div>
        )}

        <p className="text-center text-xs text-gray-700">
          Your path is saved in <code className="text-gray-500">app/.env</code> — edit it anytime to change files.
        </p>
      </div>
    </div>
  );
}
