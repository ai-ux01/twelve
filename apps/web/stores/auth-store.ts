import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * User profile information
 */
export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
}

/**
 * User configuration including API credentials and risk parameters
 */
export interface UserConfig {
  // API Provider Settings
  aiProvider: 'openai' | 'ollama';
  kiteConfigured: boolean;
  kotakConfigured: boolean;

  // Risk Parameters
  maxPositionSize: number;
  maxDrawdown: number;
  maxPortfolioExposure: number;
  defaultStopLoss: number;
}

/**
 * Authentication state interface
 */
interface AuthState {
  // Authentication status
  isAuthenticated: boolean;
  accessToken: string | null;

  // User information
  user: UserProfile | null;
  userConfig: UserConfig | null;

  // Authentication actions
  login: (token: string, user: UserProfile) => void;
  logout: () => void;
  updateUser: (user: Partial<UserProfile>) => void;

  // Configuration actions
  setUserConfig: (config: UserConfig) => void;
  updateUserConfig: (config: Partial<UserConfig>) => void;

  // Trading mode
  tradingMode: 'paper' | 'live';
  setTradingMode: (mode: 'paper' | 'live') => void;

  // Session management
  lastActivity: number | null;
  updateActivity: () => void;
  isSessionExpired: () => boolean;
}

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Auth Store for managing authentication and user state
 *
 * Manages:
 * - Authentication status and JWT tokens
 * - User profile information
 * - User configuration (API keys, risk parameters)
 * - Trading mode (paper/live)
 * - Session management and expiration
 *
 * Persists authentication data to localStorage with security considerations
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Authentication status
      isAuthenticated: false,
      accessToken: null,

      // User information
      user: null,
      userConfig: null,

      // Authentication actions
      login: (token, user) =>
        set({
          isAuthenticated: true,
          accessToken: token,
          user,
          lastActivity: Date.now(),
        }),

      logout: () =>
        set({
          isAuthenticated: false,
          accessToken: null,
          user: null,
          userConfig: null,
          lastActivity: null,
        }),

      updateUser: (userUpdate) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userUpdate } : null,
        })),

      // Configuration actions
      setUserConfig: (config) => set({ userConfig: config }),

      updateUserConfig: (configUpdate) =>
        set((state) => ({
          userConfig: state.userConfig ? { ...state.userConfig, ...configUpdate } : null,
        })),

      // Trading mode
      tradingMode: 'paper',
      setTradingMode: (mode) => set({ tradingMode: mode }),

      // Session management
      lastActivity: null,
      updateActivity: () => set({ lastActivity: Date.now() }),

      isSessionExpired: () => {
        const { lastActivity } = get();
        if (!lastActivity) return true;
        return Date.now() - lastActivity > SESSION_TIMEOUT;
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      // Exclude sensitive information from persistence if needed
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        // Note: In production, consider using httpOnly cookies for tokens
        // instead of localStorage to prevent XSS attacks
        accessToken: state.accessToken,
        user: state.user,
        userConfig: state.userConfig
          ? {
              ...state.userConfig,
              // Don't persist actual API keys in localStorage for security
              // These should be fetched from backend after authentication
            }
          : null,
        tradingMode: state.tradingMode,
        lastActivity: state.lastActivity,
      }),
    }
  )
);

/**
 * Hook to check if user is authenticated and session is valid
 */
export const useIsAuthenticated = () => {
  const { isAuthenticated, isSessionExpired, logout } = useAuthStore();

  if (isAuthenticated && isSessionExpired()) {
    logout();
    return false;
  }

  return isAuthenticated;
};

/**
 * Hook to get authentication headers for API requests
 */
export const useAuthHeaders = () => {
  const { accessToken } = useAuthStore();

  if (!accessToken) return {};

  return {
    Authorization: `Bearer ${accessToken}`,
  };
};
