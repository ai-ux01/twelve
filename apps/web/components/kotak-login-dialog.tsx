'use client';

/**
 * KotakLoginDialog Component
 *
 * A 2-step login dialog for Kotak Neo Trade API:
 * Step 1: Mobile number, UCC (client code), TOTP → calls POST /api/kotak-neo/login/totp
 * Step 2: MPIN → calls POST /api/kotak-neo/login/mpin → stores sessionId
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { kotakApi } from '@/lib/kotak-api';

interface KotakLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (sessionId: string, greetingName?: string) => void;
}

export function KotakLoginDialog({ open, onOpenChange, onSuccess }: KotakLoginDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hardcoded credentials
  const [mobileNumber] = useState('+91XXXX');
  const [ucc] = useState('XXXXXxxx');
  const [totp, setTotp] = useState('');

  // Step 2 fields
  const [mpin] = useState('12323223456');

  // Step 1 response
  const [greetingName, setGreetingName] = useState<string | null>(null);

  const resetForm = () => {
    setStep(1);
    setTotp('');
    setError(null);
    setGreetingName(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await kotakApi.loginTotp(mobileNumber, ucc, totp);
      setGreetingName(result.data?.greetingName || null);
      // Auto-submit MPIN since it's hardcoded
      await handleStep2Auto();
    } catch (err: any) {
      setError(err.message || 'TOTP login failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleStep2Auto = async () => {
    try {
      const result = await kotakApi.loginMpin(mpin);
      const { sessionId, greetingName: name } = result;
      kotakApi.setSessionId(sessionId);
      onSuccess(sessionId, name || greetingName || undefined);
      handleOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'MPIN validation failed.');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle>Connect Kotak Neo</DialogTitle>
          <DialogDescription className="text-slate-400">
            Enter your TOTP from the authenticator app.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-red-500/20 border border-red-500/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="totp" className="text-sm font-medium text-slate-300">
                TOTP
              </label>
              <Input
                id="totp"
                type="text"
                inputMode="numeric"
                placeholder="6-digit TOTP from authenticator"
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                required
                disabled={isLoading}
                maxLength={6}
                className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isLoading || !totp}>
                {isLoading ? 'Connecting...' : 'Connect'}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
