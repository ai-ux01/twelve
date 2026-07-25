import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Theme types supported by the application
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * UI state interface for the application
 */
interface UiState {
  // Theme state
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Sidebar state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Modal/Dialog state
  activeDialog: string | null;
  openDialog: (dialogId: string) => void;
  closeDialog: () => void;

  // Loading indicators
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // Notifications/Toast state
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
  }>;
  addNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

/**
 * UI Store for managing client-side UI state
 *
 * Manages:
 * - Theme preferences (light/dark/system)
 * - Sidebar open/closed state
 * - Active dialogs/modals
 * - Loading indicators
 * - Notifications/toasts
 *
 * Persists theme and sidebar state to localStorage
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      // Theme state
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      // Sidebar state
      sidebarOpen: true,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // Modal/Dialog state
      activeDialog: null,
      openDialog: (dialogId) => set({ activeDialog: dialogId }),
      closeDialog: () => set({ activeDialog: null }),

      // Loading indicators
      isLoading: false,
      setLoading: (loading) => set({ isLoading: loading }),

      // Notifications
      notifications: [],
      addNotification: (type, message) =>
        set((state) => ({
          notifications: [
            ...state.notifications,
            {
              id: crypto.randomUUID(),
              type,
              message,
              timestamp: Date.now(),
            },
          ],
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist theme and sidebar state
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);
