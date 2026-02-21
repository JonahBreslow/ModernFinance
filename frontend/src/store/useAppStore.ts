import { create } from 'zustand';

interface AppStore {
  selectedAccountId: string | null;
  activeView: 'dashboard' | 'account' | 'reports' | 'search' | 'projections' | 'recategorize' | 'import';
  sidebarCollapsed: boolean;
  searchQuery: string;

  setSelectedAccount: (id: string | null) => void;
  setActiveView: (view: AppStore['activeView']) => void;
  toggleSidebar: () => void;
  setSearchQuery: (q: string) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  selectedAccountId: null,
  activeView: 'dashboard',
  sidebarCollapsed: false,
  searchQuery: '',

  setSelectedAccount: (id) =>
    set({ selectedAccountId: id, activeView: 'account' }),
  setActiveView: (view) =>
    set({ activeView: view, selectedAccountId: view !== 'account' ? null : undefined }),
  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSearchQuery: (q) => set({ searchQuery: q }),
}));
