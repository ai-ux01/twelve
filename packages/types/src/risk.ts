// Risk validation types

export interface RiskViolation {
  rule: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export interface RiskValidationResult {
  passed: boolean;
  violations: RiskViolation[];
}
