import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard, Search as SearchIcon, FileText, PanelLeft,
  RefreshCw, AlertCircle, BookOpen, TrendingUp, Tag, Upload, Plus,
} from 'lucide-react';
import { fetchData } from './lib/api';
import { buildAccountTree, cn } from './lib/utils';
import { useAppStore } from './store/useAppStore';
import { AccountTree } from './components/AccountTree/AccountTree';
import { Register } from './components/Register/Register';
import { Dashboard } from './components/Charts/Dashboard';
import { Search } from './components/Search/Search';
import { Reports } from './components/Reports/Reports';
import { Projections } from './components/Projections/Projections';
import { Recategorize } from './components/Recategorize/Recategorize';
import { Import } from './components/Import/Import';
import { ChatWidget } from './components/Chat/Chat';
import { NewAccountModal } from './components/NewAccountModal/NewAccountModal';
import { Setup } from './components/Setup/Setup';

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <RefreshCw size={24} className="animate-spin" />
        <p className="text-sm">Loading GnuCash data…</p>
      </div>
    </div>
  );
}

function ErrorState({ error }: { error: Error }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-red-400 max-w-md text-center">
        <AlertCircle size={32} />
        <p className="font-semibold">Failed to load data</p>
        <p className="text-sm text-gray-500">{error.message}</p>
        <p className="text-xs text-gray-600">Make sure the backend server is running on port 3001</p>
      </div>
    </div>
  );
}

export default function App() {
  const queryClient = useQueryClient();

  // Check whether a .gnucash file is configured before loading main data
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['status'],
    queryFn: () => fetch('/api/status').then((r) => r.json()) as Promise<{ configured: boolean }>,
    staleTime: Infinity,
    retry: false,
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['gnucash'],
    queryFn: fetchData,
    staleTime: 30_000,
    enabled: status?.configured === true,
  });

  const { activeView, selectedAccountId, sidebarCollapsed, toggleSidebar, setActiveView } =
    useAppStore();

  const [showNewAccount, setShowNewAccount] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    e.preventDefault();
  }, [sidebarWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - dragStartX.current;
      const newWidth = Math.max(160, Math.min(600, dragStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => { isDragging.current = false; };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Show setup screen when no file is configured
  if (statusLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950 text-gray-500 text-sm">
        Loading…
      </div>
    );
  }
  if (!status?.configured) {
    return (
      <Setup onComplete={() => {
        queryClient.invalidateQueries({ queryKey: ['status'] });
        queryClient.invalidateQueries({ queryKey: ['gnucash'] });
      }} />
    );
  }

  const accountTree = data
    ? buildAccountTree(data.accounts, data.transactions)
    : [];

  const selectedAccount = selectedAccountId
    ? data?.accounts.find((a) => a.id === selectedAccountId) ?? null
    : null;

  const navItems = [
    { id: 'dashboard' as const, icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
    { id: 'search' as const, icon: <SearchIcon size={16} />, label: 'Search' },
    { id: 'reports' as const, icon: <FileText size={16} />, label: 'Reports' },
    { id: 'projections' as const,   icon: <TrendingUp size={16} />, label: 'Projections'   },
    { id: 'recategorize' as const, icon: <Tag size={16} />,        label: 'Recategorize'  },
    { id: 'import'       as const, icon: <Upload size={16} />,     label: 'Import'        },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Top nav bar */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-gray-900 border-b border-white/10 flex-shrink-0 z-20">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded hover:bg-white/10 text-gray-400 transition-colors"
          title="Toggle sidebar"
        >
          <PanelLeft size={16} />
        </button>

        <div className="flex items-center gap-2">
          <BookOpen size={18} className="text-blue-400" />
          <span className="font-semibold text-gray-200 text-sm">GnuCash</span>
        </div>

        <div className="h-4 w-px bg-white/10" />

        <nav className="flex gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors',
                activeView === item.id && selectedAccountId === null
                  ? 'bg-blue-600/20 text-blue-300'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {data && (
          <span className="text-xs text-gray-600">
            {data.accounts.length} accounts · {data.transactions.length} transactions
          </span>
        )}

        <button
          onClick={() => refetch()}
          className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
          title="Reload data"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'flex flex-col bg-gray-900 border-r border-white/10 flex-shrink-0 overflow-hidden',
            sidebarCollapsed ? 'w-0 transition-all duration-200' : 'transition-none'
          )}
          style={sidebarCollapsed ? undefined : { width: sidebarWidth }}
        >
          <div className="px-3 pt-3 pb-1 flex items-center">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider px-2 flex-1">
              Accounts
            </p>
            <button
              onClick={() => setShowNewAccount(true)}
              className="p-1 rounded hover:bg-white/10 text-gray-600 hover:text-blue-400 transition-colors"
              title="New account"
            >
              <Plus size={14} />
            </button>
          </div>
          {data ? (
            <AccountTree roots={accountTree} accounts={data.accounts} />
          ) : (
            <div className="flex-1" />
          )}
        </aside>

        {/* Resize handle */}
        {!sidebarCollapsed && (
          <div
            className="w-1 flex-shrink-0 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500/70 transition-colors relative group"
            onMouseDown={handleDragStart}
          >
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          {isLoading && <LoadingSpinner />}
          {error && <ErrorState error={error as Error} />}
          {data && (
            <>
              {activeView === 'account' && selectedAccount ? (
                <Register
                  account={selectedAccount}
                  accounts={data.accounts}
                  transactions={data.transactions}
                />
              ) : activeView === 'search' ? (
                <Search accounts={data.accounts} transactions={data.transactions} />
              ) : activeView === 'reports' ? (
                <Reports accounts={data.accounts} transactions={data.transactions} />
              ) : activeView === 'projections' ? (
                <Projections accounts={data.accounts} transactions={data.transactions} />
              ) : activeView === 'recategorize' ? (
                <Recategorize accounts={data.accounts} transactions={data.transactions} />
              ) : activeView === 'import' ? (
                <Import accounts={data.accounts} transactions={data.transactions} />
              ) : (
                <Dashboard accounts={data.accounts} transactions={data.transactions} />
              )}
            </>
          )}
        </main>
      </div>

      {showNewAccount && data && (
        <NewAccountModal
          accounts={data.accounts}
          onClose={() => setShowNewAccount(false)}
        />
      )}

      {/* Floating AI advisor widget — available from any view */}
      <ChatWidget />
    </div>
  );
}
