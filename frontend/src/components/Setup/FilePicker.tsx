/**
 * Local filesystem browser for the setup wizard.
 * Uses the backend /api/fs/* endpoints so the user can navigate their
 * real directory tree and click to select a .gnucash file (or directory
 * when picking a save location).
 */

import { useState, useEffect } from 'react';
import {
  Folder, FolderOpen, FileText, ChevronRight,
  ChevronLeft, Home, Loader2, AlertCircle, Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Entry {
  name: string;
  isDir: boolean;
  isGnuCash: boolean;
}

interface DirListing {
  path: string;
  parent: string | null;
  entries: Entry[];
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function listDir(dirPath: string): Promise<DirListing> {
  const res = await fetch(`/api/fs/list?path=${encodeURIComponent(dirPath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Cannot read directory');
  }
  return res.json();
}

async function getHome(): Promise<string> {
  const res = await fetch('/api/fs/home');
  const data = await res.json();
  return data.path;
}

// ─── Breadcrumbs ─────────────────────────────────────────────────────────────

function Breadcrumbs({ currentPath, onNavigate }: { currentPath: string; onNavigate: (p: string) => void }) {
  // Split path into segments, building up cumulative paths
  const sep = currentPath.includes('\\') ? '\\' : '/';
  const parts = currentPath.split(sep).filter(Boolean);

  const segments: { label: string; path: string }[] = [];
  let cumulative = currentPath.startsWith(sep) ? sep : '';
  for (const part of parts) {
    cumulative = cumulative === sep ? sep + part : cumulative + sep + part;
    segments.push({ label: part, path: cumulative });
  }

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto text-xs text-gray-500 min-w-0">
      {segments.map((seg, i) => (
        <span key={seg.path} className="flex items-center gap-0.5 flex-shrink-0">
          {i > 0 && <ChevronRight size={10} className="text-gray-700" />}
          <button
            onClick={() => onNavigate(seg.path)}
            className={cn(
              'hover:text-gray-300 transition-colors px-0.5 rounded',
              i === segments.length - 1 ? 'text-gray-300 font-medium' : 'hover:underline'
            )}
          >
            {seg.label}
          </button>
        </span>
      ))}
    </div>
  );
}

// ─── Main FilePicker ──────────────────────────────────────────────────────────

interface FilePickerProps {
  /** 'open' = pick an existing .gnucash file; 'save' = pick a directory then type a filename */
  mode: 'open' | 'save';
  /** Called when the user confirms a selection */
  onSelect: (filePath: string) => void;
  /** Called to dismiss the picker without selecting */
  onCancel: () => void;
}

export function FilePicker({ mode, onSelect, onCancel }: FilePickerProps) {
  const [listing,   setListing]   = useState<DirListing | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [selected,  setSelected]  = useState<string | null>(null); // full path of selected entry
  const [fileName,  setFileName]  = useState('finances.gnucash'); // for 'save' mode

  // Navigate to a directory
  async function navigate(dirPath: string) {
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const data = await listDir(dirPath);
      setListing(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Start at home directory
  useEffect(() => {
    getHome().then(navigate).catch(() => navigate('/'));
  }, []);

  function handleEntryClick(entry: Entry) {
    if (!listing) return;
    const fullPath = listing.path.endsWith('/')
      ? listing.path + entry.name
      : listing.path + '/' + entry.name;

    if (entry.isDir) {
      navigate(fullPath);
    } else if (entry.isGnuCash) {
      setSelected(fullPath);
    }
  }

  function handleEntryDoubleClick(entry: Entry) {
    if (entry.isGnuCash && mode === 'open') {
      const fullPath = listing!.path.endsWith('/')
        ? listing!.path + entry.name
        : listing!.path + '/' + entry.name;
      onSelect(fullPath);
    }
  }

  // The final path to pass back
  function getFinalPath(): string | null {
    if (mode === 'open') return selected;
    if (mode === 'save' && listing) {
      const name = fileName.trim().endsWith('.gnucash') ? fileName.trim() : fileName.trim() + '.gnucash';
      if (!name || name === '.gnucash') return null;
      return listing.path.endsWith('/')
        ? listing.path + name
        : listing.path + '/' + name;
    }
    return null;
  }

  const finalPath = getFinalPath();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-lg bg-gray-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 flex-shrink-0">
          <FolderOpen size={15} className="text-blue-400" />
          <span className="text-sm font-semibold text-gray-200">
            {mode === 'open' ? 'Select GnuCash file' : 'Choose save location'}
          </span>
          <button
            onClick={onCancel}
            className="ml-auto text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-gray-900/50 flex-shrink-0">
          <button
            onClick={() => listing?.parent && navigate(listing.parent)}
            disabled={!listing?.parent}
            className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors"
            title="Up one level"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => getHome().then(navigate)}
            className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
            title="Home directory"
          >
            <Home size={14} />
          </button>
          <div className="flex-1 min-w-0 pl-1">
            {listing && <Breadcrumbs currentPath={listing.path} onNavigate={navigate} />}
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-2 py-1.5 min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-10 text-gray-600">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading…
            </div>
          )}
          {error && !loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-red-400">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          {!loading && !error && listing && (
            listing.entries.length === 0 ? (
              <p className="text-xs text-gray-600 px-3 py-4 text-center">
                {mode === 'open' ? 'No .gnucash files in this folder.' : 'Empty folder.'}
              </p>
            ) : (
              listing.entries.map((entry) => {
                const fullPath = listing.path.endsWith('/')
                  ? listing.path + entry.name
                  : listing.path + '/' + entry.name;
                const isSelected = selected === fullPath;

                return (
                  <button
                    key={entry.name}
                    onClick={() => handleEntryClick(entry)}
                    onDoubleClick={() => handleEntryDoubleClick(entry)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-left transition-colors',
                      isSelected
                        ? 'bg-blue-600/20 text-blue-300'
                        : 'hover:bg-white/5 text-gray-300'
                    )}
                  >
                    {entry.isDir ? (
                      <Folder size={14} className="text-yellow-500/70 flex-shrink-0" />
                    ) : (
                      <FileText size={14} className="text-blue-400/70 flex-shrink-0" />
                    )}
                    <span className="flex-1 truncate">{entry.name}</span>
                    {entry.isDir && <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />}
                    {isSelected && <Check size={12} className="text-blue-400 flex-shrink-0" />}
                  </button>
                );
              })
            )
          )}
        </div>

        {/* Save mode: filename input */}
        {mode === 'save' && (
          <div className="px-4 py-3 border-t border-white/5 flex-shrink-0">
            <label className="block text-xs text-gray-500 mb-1.5">File name</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="finances.gnucash"
              className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-blue-500 font-mono transition-colors"
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-white/5 bg-gray-900/50 flex-shrink-0">
          <div className="flex-1 min-w-0">
            {finalPath ? (
              <p className="text-xs text-gray-500 font-mono truncate" title={finalPath}>
                {finalPath}
              </p>
            ) : (
              <p className="text-xs text-gray-700">
                {mode === 'open' ? 'Click a .gnucash file to select it' : 'Navigate to a folder and enter a filename'}
              </p>
            )}
          </div>
          <button
            onClick={() => finalPath && onSelect(finalPath)}
            disabled={!finalPath}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0"
          >
            {mode === 'open' ? 'Open' : 'Save here'}
          </button>
        </div>
      </div>
    </div>
  );
}
