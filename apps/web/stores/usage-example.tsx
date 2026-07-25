/**
 * Usage Examples for Zustand Stores
 *
 * This file demonstrates how to use the UI and Auth stores
 * in React components. These are example components for reference.
 */

'use client';

import { useUiStore, useAuthStore, useIsAuthenticated } from '@/stores';

/**
 * Example: Theme Toggle Component
 * Demonstrates using UI store for theme management
 */
export function ThemeToggle() {
  const { theme, setTheme } = useUiStore();

  return (
    <div className="flex gap-2">
      <button onClick={() => setTheme('light')} className={theme === 'light' ? 'font-bold' : ''}>
        Light
      </button>
      <button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'font-bold' : ''}>
        Dark
      </button>
      <button onClick={() => setTheme('system')} className={theme === 'system' ? 'font-bold' : ''}>
        System
      </button>
    </div>
  );
}

/**
 * Example: Sidebar Toggle Button
 * Demonstrates using UI store for sidebar state
 */
export function SidebarToggle() {
  const { sidebarOpen, toggleSidebar } = useUiStore();

  return <button onClick={toggleSidebar}>{sidebarOpen ? 'Close Sidebar' : 'Open Sidebar'}</button>;
}

/**
 * Example: Notification Demo
 * Demonstrates adding and displaying notifications
 */
export function NotificationDemo() {
  const { notifications, addNotification, removeNotification } = useUiStore();

  const showSuccess = () => {
    addNotification('success', 'Trade executed successfully!');
  };

  const showError = () => {
    addNotification('error', 'Failed to fetch market data');
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={showSuccess}>Show Success</button>
        <button onClick={showError}>Show Error</button>
      </div>

      <div className="space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-3 rounded ${
              notification.type === 'success'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {notification.message}
            <button onClick={() => removeNotification(notification.id)} className="ml-2 font-bold">
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Example: Auth Status Display
 * Demonstrates using auth store and custom hooks
 */
export function AuthStatus() {
  const isAuthenticated = useIsAuthenticated();
  const { user, tradingMode, setTradingMode } = useAuthStore();

  if (!isAuthenticated) {
    return <div>Not authenticated</div>;
  }

  return (
    <div>
      <p>Logged in as: {user?.email}</p>
      <p>Trading Mode: {tradingMode}</p>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => setTradingMode('paper')}
          className={tradingMode === 'paper' ? 'font-bold' : ''}
        >
          Paper Trading
        </button>
        <button
          onClick={() => setTradingMode('live')}
          className={tradingMode === 'live' ? 'font-bold' : ''}
        >
          Live Trading
        </button>
      </div>
    </div>
  );
}

/**
 * Example: User Config Display
 * Demonstrates accessing user configuration from auth store
 */
export function UserConfigDisplay() {
  const { userConfig } = useAuthStore();

  if (!userConfig) {
    return <div>No configuration loaded</div>;
  }

  return (
    <div className="space-y-2">
      <h3 className="font-bold">Risk Parameters</h3>
      <div>Max Position Size: ₹{userConfig.maxPositionSize.toLocaleString()}</div>
      <div>Max Drawdown: {(userConfig.maxDrawdown * 100).toFixed(2)}%</div>
      <div>Max Portfolio Exposure: {(userConfig.maxPortfolioExposure * 100).toFixed(2)}%</div>
      <div>Default Stop Loss: {(userConfig.defaultStopLoss * 100).toFixed(2)}%</div>

      <h3 className="font-bold mt-4">API Configuration</h3>
      <div>Kite Configured: {userConfig.kiteConfigured ? '✓' : '✗'}</div>
      <div>Kotak Configured: {userConfig.kotakConfigured ? '✓' : '✗'}</div>
      <div>AI Provider: {userConfig.aiProvider}</div>
    </div>
  );
}

/**
 * Example: Loading Indicator
 * Demonstrates using global loading state
 */
export function LoadingIndicator() {
  const { isLoading, setLoading } = useUiStore();

  const simulateLoading = async () => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setLoading(false);
  };

  return (
    <div>
      {isLoading && <div className="spinner">Loading...</div>}
      <button onClick={simulateLoading}>Simulate Loading</button>
    </div>
  );
}

/**
 * Example: Dialog Management
 * Demonstrates opening and closing dialogs
 */
export function DialogExample() {
  const { activeDialog, openDialog, closeDialog } = useUiStore();

  return (
    <div>
      <button onClick={() => openDialog('trade-confirmation')}>Open Trade Confirmation</button>

      {activeDialog === 'trade-confirmation' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Confirm Trade</h2>
            <p className="mb-4">Are you sure you want to execute this trade?</p>
            <div className="flex gap-2">
              <button onClick={closeDialog}>Cancel</button>
              <button
                onClick={() => {
                  // Execute trade logic here
                  closeDialog();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
