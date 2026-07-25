/**
 * Zustand Stores Index
 *
 * Centralized exports for all client-side state management stores
 */

export { useUiStore } from './ui-store';
export type { Theme } from './ui-store';

export { useAuthStore, useIsAuthenticated, useAuthHeaders } from './auth-store';
export type { UserProfile, UserConfig } from './auth-store';
