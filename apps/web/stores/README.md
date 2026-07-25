# Zustand Stores

This directory contains all Zustand stores for client-side state management in the ProfitTerminal frontend application.

## Overview

The application uses Zustand for managing client-side UI and authentication state. For server state (market data, portfolio, recommendations), we use TanStack Query (see `lib/query-keys.ts`).

## Available Stores

### UI Store (`ui-store.ts`)

Manages UI-related state including:

- **Theme**: Light, dark, or system theme preference
- **Sidebar**: Sidebar open/closed state
- **Dialogs**: Active modal/dialog tracking
- **Loading**: Global loading indicators
- **Notifications**: Toast notifications

**Persistence**: Theme and sidebar state are persisted to localStorage

#### Usage Example

```typescript
import { useUiStore } from '@/stores';

function MyComponent() {
  const { theme, setTheme, sidebarOpen, toggleSidebar } = useUiStore();

  return (
    <div>
      <button onClick={() => setTheme('dark')}>
        Switch to Dark Mode
      </button>
      <button onClick={toggleSidebar}>
        Toggle Sidebar
      </button>
    </div>
  );
}
```

#### Adding Notifications

```typescript
const { addNotification } = useUiStore();

// Success notification
addNotification('success', 'Trade executed successfully');

// Error notification
addNotification('error', 'Failed to fetch market data');
```

### Auth Store (`auth-store.ts`)

Manages authentication and user state including:

- **Authentication**: Login status and JWT tokens
- **User Profile**: User information (id, email, name)
- **User Config**: API credentials status and risk parameters
- **Trading Mode**: Paper or live trading mode
- **Session**: Session management and expiration (24-hour timeout)

**Persistence**: Authentication data is persisted to localStorage (see security notes below)

#### Usage Example

```typescript
import { useAuthStore, useIsAuthenticated, useAuthHeaders } from '@/stores';

function Dashboard() {
  const isAuthenticated = useIsAuthenticated();
  const { user, tradingMode, setTradingMode } = useAuthStore();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div>
      <h1>Welcome, {user?.name || user?.email}</h1>
      <select
        value={tradingMode}
        onChange={(e) => setTradingMode(e.target.value as 'paper' | 'live')}
      >
        <option value="paper">Paper Trading</option>
        <option value="live">Live Trading</option>
      </select>
    </div>
  );
}
```

#### Making Authenticated API Calls

```typescript
import { useAuthHeaders } from '@/stores';

function useApiCall() {
  const headers = useAuthHeaders();

  const fetchData = async () => {
    const response = await fetch('/api/portfolio', {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  };

  return { fetchData };
}
```

## Security Considerations

### Auth Store

1. **Token Storage**: Currently stores JWT tokens in localStorage for simplicity. In production, consider:
   - Using httpOnly cookies for token storage (prevents XSS attacks)
   - Implementing token refresh mechanisms
   - Adding CSRF protection

2. **API Key Storage**: The `UserConfig` should NOT store actual API keys in localStorage. Instead:
   - Store only configuration status (e.g., `kiteConfigured: true`)
   - Fetch actual keys from backend on-demand
   - Keys should be encrypted at rest in the database

3. **Session Management**: Implements 24-hour session timeout. Sessions expire automatically and trigger logout.

## Architecture Alignment

These stores follow the ProfitTerminal architecture:

- **Client State**: Managed by Zustand stores (UI preferences, auth state)
- **Server State**: Managed by TanStack Query (market data, portfolio, trades)
- **Separation of Concerns**: UI/auth state is decoupled from data fetching logic

This aligns with **Requirement 13.6**: "THE Frontend_App SHALL update data reactively using TanStack Query"

## Testing

Unit tests for stores should verify:

1. State updates work correctly
2. Persistence/rehydration works as expected
3. Session expiration logic functions properly
4. Notification management behaves correctly

## Future Enhancements

Potential additions:

- Portfolio store for optimistic updates
- WebSocket store for real-time market data connection management
- Settings store for advanced user preferences
- Chart store for chart configuration and annotations
