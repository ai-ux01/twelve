'use client';

/**
 * SettingsPanel Component
 *
 * Slide-over settings panel for configuring scalper parameters:
 * - refresh_interval (default 60, min 30, max 300)
 * - probability_threshold (default 70, min 50, max 90)
 * - risk_reward_threshold (default 2.0, min 1.0, max 5.0)
 * - max_spread_percentage (default 5, min 1, max 10)
 * - min_open_interest (default 1000, min 100, max 10000)
 * - Validate input ranges and show error messages
 * - "SAVE CHANGES" and "RESET TO DEFAULTS" buttons
 * - Load saved config on mount, apply new settings on save
 *
 * Requirements covered: 30.1-30.13
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Settings, X, Save, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ScalperConfig {
  refresh_interval: number;
  probability_threshold: number;
  risk_reward_threshold: number;
  max_spread_percentage: number;
  min_open_interest: number;
}

export interface SettingsPanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Callback when settings are saved */
  onSave: (config: ScalperConfig) => void;
  /** Currently active configuration (loaded from backend) */
  currentConfig?: ScalperConfig | null;
}

interface FieldConfig {
  key: keyof ScalperConfig;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: 'refresh_interval',
    label: 'Refresh Interval',
    unit: 'seconds',
    min: 30,
    max: 300,
    step: 1,
    defaultValue: 60,
  },
  {
    key: 'probability_threshold',
    label: 'Probability Threshold',
    unit: '%',
    min: 50,
    max: 90,
    step: 1,
    defaultValue: 70,
  },
  {
    key: 'risk_reward_threshold',
    label: 'Risk/Reward Threshold',
    unit: 'ratio',
    min: 1.0,
    max: 5.0,
    step: 0.1,
    defaultValue: 2.0,
  },
  {
    key: 'max_spread_percentage',
    label: 'Max Spread Percentage',
    unit: '%',
    min: 1,
    max: 10,
    step: 1,
    defaultValue: 5,
  },
  {
    key: 'min_open_interest',
    label: 'Min Open Interest',
    unit: 'contracts',
    min: 100,
    max: 10000,
    step: 100,
    defaultValue: 1000,
  },
];

const DEFAULT_CONFIG: ScalperConfig = {
  refresh_interval: 60,
  probability_threshold: 70,
  risk_reward_threshold: 2.0,
  max_spread_percentage: 5,
  min_open_interest: 1000,
};

export function SettingsPanel({ isOpen, onClose, onSave, currentConfig }: SettingsPanelProps) {
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Load saved config on mount or when currentConfig changes
  useEffect(() => {
    const config = currentConfig || DEFAULT_CONFIG;
    const values: Record<string, string> = {};
    for (const field of FIELD_CONFIGS) {
      values[field.key] = String(config[field.key]);
    }
    setFormValues(values);
    setErrors({});
  }, [currentConfig, isOpen]);

  const validateField = useCallback((field: FieldConfig, value: string): string | null => {
    if (value.trim() === '') {
      return `${field.label} is required`;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      return `${field.label} must be a number`;
    }

    if (numValue < field.min) {
      return `${field.label} must be at least ${field.min}`;
    }

    if (numValue > field.max) {
      return `${field.label} must be at most ${field.max}`;
    }

    return null;
  }, []);

  const handleInputChange = useCallback(
    (key: string, value: string) => {
      setFormValues((prev) => ({ ...prev, [key]: value }));

      // Clear error when user starts typing
      const field = FIELD_CONFIGS.find((f) => f.key === key);
      if (field) {
        const error = validateField(field, value);
        setErrors((prev) => {
          const next = { ...prev };
          if (error) {
            next[key] = error;
          } else {
            delete next[key];
          }
          return next;
        });
      }
    },
    [validateField]
  );

  const handleSave = useCallback(async () => {
    // Validate all fields
    const newErrors: Record<string, string> = {};
    for (const field of FIELD_CONFIGS) {
      const error = validateField(field, formValues[field.key] || '');
      if (error) {
        newErrors[field.key] = error;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      const config: ScalperConfig = {
        refresh_interval: Number(formValues.refresh_interval),
        probability_threshold: Number(formValues.probability_threshold),
        risk_reward_threshold: Number(formValues.risk_reward_threshold),
        max_spread_percentage: Number(formValues.max_spread_percentage),
        min_open_interest: Number(formValues.min_open_interest),
      };

      onSave(config);
    } finally {
      setIsSaving(false);
    }
  }, [formValues, validateField, onSave]);

  const handleReset = useCallback(() => {
    const values: Record<string, string> = {};
    for (const field of FIELD_CONFIGS) {
      values[field.key] = String(field.defaultValue);
    }
    setFormValues(values);
    setErrors({});
  }, []);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background shadow-xl border-l overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Scalper Settings"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background p-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close settings"
            className="min-w-[44px] min-h-[44px]"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Settings Form */}
        <div className="p-4 space-y-6">
          {FIELD_CONFIGS.map((field) => (
            <div key={field.key} className="space-y-2">
              <label
                htmlFor={`setting-${field.key}`}
                className="text-sm font-medium leading-none"
              >
                {field.label}
                <span className="text-muted-foreground ml-1 font-normal">
                  ({field.min}-{field.max} {field.unit})
                </span>
              </label>
              <Input
                id={`setting-${field.key}`}
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={formValues[field.key] || ''}
                onChange={(e) => handleInputChange(field.key, e.target.value)}
                className={cn(
                  'min-h-[44px]',
                  errors[field.key] && 'border-red-500 focus-visible:ring-red-500'
                )}
                aria-invalid={!!errors[field.key]}
                aria-describedby={errors[field.key] ? `error-${field.key}` : undefined}
              />
              {errors[field.key] && (
                <p
                  id={`error-${field.key}`}
                  className="text-xs text-red-600 dark:text-red-400"
                  role="alert"
                >
                  {errors[field.key]}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 border-t bg-background p-4 space-y-3">
          <Button
            onClick={handleSave}
            disabled={isSaving || Object.keys(errors).length > 0}
            className="w-full min-h-[44px] flex items-center justify-center gap-2"
          >
            <Save className="h-4 w-4" />
            SAVE CHANGES
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            className="w-full min-h-[44px] flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            RESET TO DEFAULTS
          </Button>
        </div>
      </div>
    </>
  );
}
