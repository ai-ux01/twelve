'use client';

/**
 * BrokerHeader Component
 *
 * Displays broker connection status and provides connect/disconnect buttons
 * for Kite Connect and Kotak Neo.
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, ExternalLink } from 'lucide-react';
import { KotakLoginDialog } from '@/components/kotak-login-dialog';
import { kotakApi } from '@/lib/kotak-api';

const API_BASE = 'http://localhost:4000/api';

interface BrokerStatus {
  connected: boolean;
  expiresAt: string | null;
  apiKey: string | null;
}

interface KotakNeoStatus {
  connected: boolean;
  greetingName: string | null;
  baseUrl: string | null;
  dataCenter: string | null;
}

export function BrokerHeader() {
  const [kiteStatus, setKiteStatus] = useState<BrokerStatus>({
    connected: false,
    expiresAt: null,
    apiKey: null,
  });
  const [kotakStatus, setKotakStatus] = useState<KotakNeoStatus>({
    connected: false,
    greetingName: null,
    baseUrl: null,
    dataCenter: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [kotakDialogOpen, setKotakDialogOpen] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const sessionId = kotakApi.getSessionId();
      const headers: HeadersInit = {};
      if (sessionId) {
        headers['X-Session-Id'] = sessionId;
      }

      const [kiteRes, kotakRes] = await Promise.allSettled([
        fetch(`${API_BASE}/kite/status`),
        fetch(`${API_BASE}/kotak-neo/status`, { headers }),
      ]);

      if (kiteRes.status === 'fulfilled' && kiteRes.value.ok) {
        const data = await kiteRes.value.json();
        setKiteStatus(data);
      }

      if (kotakRes.status === 'fulfilled' && kotakRes.value.ok) {
        const data = await kotakRes.value.json();
        setKotakStatus({
          connected: data.connected || false,
          greetingName: data.greetingName || null,
          baseUrl: data.baseUrl || null,
          dataCenter: data.dataCenter || null,
        });
      }
    } catch {
      // Silently handle errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Poll status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Check URL params for broker connection success
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('kite') === 'connected' || params.get('kotak') === 'connected') {
        fetchStatus();
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [fetchStatus]);

  const handleKiteConnect = () => {
    window.location.href = `${API_BASE}/kite/login`;
  };

  const handleKiteDisconnect = async () => {
    await fetch(`${API_BASE}/kite/logout`);
    setKiteStatus({ connected: false, expiresAt: null, apiKey: null });
  };

  const handleKotakConnect = () => {
    setKotakDialogOpen(true);
  };

  const handleKotakLoginSuccess = (sessionId: string, greetingName?: string) => {
    setKotakStatus({
      connected: true,
      greetingName: greetingName || null,
      baseUrl: null,
      dataCenter: null,
    });
    // Refresh status from server to get full data
    fetchStatus();
  };

  const handleKotakDisconnect = async () => {
    try {
      await kotakApi.logout();
    } catch {
      // Clear local state even if server call fails
      kotakApi.clearSessionId();
    }
    setKotakStatus({ connected: false, greetingName: null, baseUrl: null, dataCenter: null });
  };

  return (
    <>
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-6">
          {/* Left: Title */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Broker Connections</span>
          </div>

          {/* Right: Connection Buttons */}
          <div className="flex items-center gap-3">
            {/* Kite Connect */}
            <div className="flex items-center gap-2">
              {kiteStatus.connected ? (
                <>
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
                    <Wifi className="h-3 w-3" />
                    Kite Connected
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleKiteDisconnect}
                    className="text-xs text-muted-foreground"
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleKiteConnect}
                  disabled={isLoading}
                  className="gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Connect Kite
                </Button>
              )}
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-border" />

            {/* Kotak Neo */}
            <div className="flex items-center gap-2">
              {kotakStatus.connected ? (
                <>
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700 gap-1">
                    <Wifi className="h-3 w-3" />
                    Kotak Neo{kotakStatus.greetingName ? ` (${kotakStatus.greetingName})` : ''}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleKotakDisconnect}
                    className="text-xs text-muted-foreground"
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleKotakConnect}
                  disabled={isLoading}
                  className="gap-1.5"
                >
                  <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                  Connect Kotak Neo
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Kotak Neo Login Dialog */}
      <KotakLoginDialog
        open={kotakDialogOpen}
        onOpenChange={setKotakDialogOpen}
        onSuccess={handleKotakLoginSuccess}
      />
    </>
  );
}
