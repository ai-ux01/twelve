import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../../audit/audit.service';
import { KillSwitchState } from '../brokers/kotak-neo.interfaces';

/**
 * KillSwitchService - Emergency stop for all live trading operations.
 *
 * CRITICAL SAFETY:
 * - Default state: ENABLED (live trading is OFF)
 * - Users must explicitly disable the kill switch to allow live trading
 * - State changes are audit-logged
 *
 * Uses in-memory storage for simplicity (survives within process lifetime).
 * For multi-instance deployments, this would need database/Redis persistence.
 */
@Injectable()
export class KillSwitchService {
  private readonly logger = new Logger(KillSwitchService.name);

  // In-memory kill switch state — defaults to enabled (live trading OFF)
  private state: KillSwitchState = {
    enabled: true, // SAFE DEFAULT: live trading is OFF
    updatedBy: 'system',
    updatedAt: new Date(),
  };

  constructor(private readonly auditLogService: AuditLogService) {
    this.logger.log('KillSwitchService initialized — live trading is OFF (kill switch enabled)');
  }

  /**
   * Get the current kill switch state
   */
  getState(): KillSwitchState {
    return { ...this.state };
  }

  /**
   * Toggle the kill switch state
   *
   * @param userId - User performing the toggle
   * @param enabled - true = live trading OFF, false = live trading ON
   */
  async toggle(userId: string, enabled: boolean): Promise<KillSwitchState> {
    const previousState = this.state.enabled;

    this.state = {
      enabled,
      updatedBy: userId,
      updatedAt: new Date(),
    };

    this.logger.log(
      `Kill switch toggled by ${userId}: ${previousState ? 'ENABLED' : 'DISABLED'} → ${enabled ? 'ENABLED' : 'DISABLED'} (live trading ${enabled ? 'OFF' : 'ON'})`
    );

    // Audit log the state change
    await this.auditLogService.log({
      userId,
      service: 'kill-switch',
      action: 'toggle',
      entityType: 'kill_switch',
      entityId: 'global',
      payload: {
        previousEnabled: previousState,
        newEnabled: enabled,
      },
      success: true,
    });

    return this.getState();
  }

  /**
   * Check if live trading is currently allowed.
   * Returns true only when the kill switch is DISABLED (enabled=false).
   */
  isLiveTradingAllowed(): boolean {
    return !this.state.enabled;
  }
}
