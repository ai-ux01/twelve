/**
 * Unit tests for OptionsRiskPanel component
 * 
 * Requirements covered: 8.5, 13.2, 16.4
 */

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { OptionsRiskPanel, OptionsRiskMetrics } from './options-risk-panel';

// Mock the UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-title" className={className}>{children}</div>
  ),
  CardDescription: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-description">{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className }: { children: React.ReactNode; variant?: string; className?: string }) => (
    <span data-testid="badge" data-variant={variant} className={className}>{children}</span>
  ),
}));

describe('OptionsRiskPanel', () => {
  const mockHealthyMetrics: OptionsRiskMetrics = {
    totalOptionsExposure: 50000,
    totalOptionsExposurePercent: 10,
    maxOptionsExposurePercent: 20,
    optionsPositionCount: 3,
    maxOpenPositions: 10,
    liquidityWarnings: [],
    riskViolations: [],
    recommendations: [],
  };

  const mockMetricsWithWarnings: OptionsRiskMetrics = {
    totalOptionsExposure: 80000,
    totalOptionsExposurePercent: 16, // 80% of max
    maxOptionsExposurePercent: 20,
    optionsPositionCount: 5,
    maxOpenPositions: 10,
    liquidityWarnings: [
      {
        symbol: 'NIFTY',
        strikePrice: 21500,
        optionType: 'CALL',
        reason: 'Low Volume - only 50 contracts traded',
        severity: 'WARNING',
      },
    ],
    riskViolations: [
      {
        rule: 'APPROACHING_EXPOSURE_LIMIT',
        message: 'Options exposure at 80% of maximum allowed',
        severity: 'WARNING',
      },
    ],
    recommendations: [
      'Consider reducing options exposure to maintain safety margin',
      'Monitor liquidity on NIFTY 21500 CALL position',
    ],
  };

  const mockMetricsWithErrors: OptionsRiskMetrics = {
    totalOptionsExposure: 120000,
    totalOptionsExposurePercent: 24,
    maxOptionsExposurePercent: 20,
    optionsPositionCount: 8,
    maxOpenPositions: 10,
    liquidityWarnings: [
      {
        symbol: 'BANKNIFTY',
        strikePrice: 45000,
        optionType: 'PUT',
        reason: 'Wide Bid-Ask Spread - 8% of LTP',
        severity: 'CRITICAL',
      },
    ],
    riskViolations: [
      {
        rule: 'MAX_OPTIONS_EXPOSURE',
        message: 'Total options exposure 24% exceeds max 20%',
        severity: 'ERROR',
        currentValue: 24,
        limit: 20,
      },
    ],
    recommendations: [
      'URGENT: Reduce options exposure immediately',
      'Close or reduce BANKNIFTY 45000 PUT position due to liquidity concerns',
    ],
  };

  describe('Loading State', () => {
    it('should display loading message when isLoading is true', () => {
      render(<OptionsRiskPanel metrics={null} isLoading={true} />);
      
      expect(screen.getByText('Options Risk Summary')).toBeInTheDocument();
      expect(screen.getByText('Loading risk metrics...')).toBeInTheDocument();
      expect(screen.getByText('Calculating risk metrics...')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state when metrics is null and not loading', () => {
      render(<OptionsRiskPanel metrics={null} isLoading={false} />);
      
      expect(screen.getByText('Options Risk Summary')).toBeInTheDocument();
      expect(screen.getByText('No options positions found')).toBeInTheDocument();
      expect(screen.getByText('You currently have no options positions.')).toBeInTheDocument();
      expect(screen.getByText('Risk metrics will appear when you open options positions.')).toBeInTheDocument();
    });
  });

  describe('Healthy Metrics Display', () => {
    it('should display all key metrics correctly', () => {
      render(<OptionsRiskPanel metrics={mockHealthyMetrics} portfolioValue={500000} />);
      
      // Check title
      expect(screen.getByText('Options Risk Summary')).toBeInTheDocument();
      
      // Check portfolio value
      expect(screen.getByText(/Portfolio Value: ₹500,000/)).toBeInTheDocument();
      
      // Check exposure percentage
      expect(screen.getByText('10.0%')).toBeInTheDocument();
      expect(screen.getByText('₹50,000 / 20% max')).toBeInTheDocument();
      
      // Check position count
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('10 max')).toBeInTheDocument();
      
      // Check liquidity warnings count
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('All positions liquid')).toBeInTheDocument();
    });

    it('should show healthy status badge', () => {
      render(<OptionsRiskPanel metrics={mockHealthyMetrics} />);
      
      const badges = screen.getAllByTestId('badge');
      const healthyBadge = badges.find(badge => badge.textContent?.includes('Healthy'));
      expect(healthyBadge).toBeInTheDocument();
    });

    it('should display success message when no issues', () => {
      render(<OptionsRiskPanel metrics={mockHealthyMetrics} />);
      
      expect(screen.getByText('All Risk Checks Passed')).toBeInTheDocument();
      expect(screen.getByText('Your options positions are within safe risk limits.')).toBeInTheDocument();
    });
  });

  describe('Warning State Display (Requirement 8.5)', () => {
    it('should display warnings in yellow when approaching limits', () => {
      render(<OptionsRiskPanel metrics={mockMetricsWithWarnings} />);
      
      // Check for warning badge
      const badges = screen.getAllByTestId('badge');
      const warningBadge = badges.find(badge => badge.textContent?.includes('Warnings'));
      expect(warningBadge).toBeInTheDocument();
      
      // Check exposure is shown (approaching 80% of max)
      expect(screen.getByText('16.0%')).toBeInTheDocument();
    });

    it('should display risk violations with WARNING severity', () => {
      render(<OptionsRiskPanel metrics={mockMetricsWithWarnings} />);
      
      expect(screen.getByText('Risk Violations')).toBeInTheDocument();
      expect(screen.getByText('APPROACHING EXPOSURE LIMIT')).toBeInTheDocument();
      expect(screen.getByText('Options exposure at 80% of maximum allowed')).toBeInTheDocument();
    });

    it('should display liquidity warnings', () => {
      render(<OptionsRiskPanel metrics={mockMetricsWithWarnings} />);
      
      expect(screen.getByText('Liquidity Warnings')).toBeInTheDocument();
      expect(screen.getByText('NIFTY 21500 CALL')).toBeInTheDocument();
      expect(screen.getByText('Low Volume - only 50 contracts traded')).toBeInTheDocument();
    });

    it('should display recommendations', () => {
      render(<OptionsRiskPanel metrics={mockMetricsWithWarnings} />);
      
      expect(screen.getByText('Risk Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Consider reducing options exposure to maintain safety margin')).toBeInTheDocument();
      expect(screen.getByText('Monitor liquidity on NIFTY 21500 CALL position')).toBeInTheDocument();
    });
  });

  describe('Error State Display (Requirement 8.5)', () => {
    it('should display risk violations in red when limits breached', () => {
      render(<OptionsRiskPanel metrics={mockMetricsWithErrors} />);
      
      // Check for error badge
      const badges = screen.getAllByTestId('badge');
      const errorBadge = badges.find(badge => badge.textContent?.includes('Risk Violations'));
      expect(errorBadge).toBeInTheDocument();
    });

    it('should display ERROR severity violations prominently', () => {
      render(<OptionsRiskPanel metrics={mockMetricsWithErrors} />);
      
      expect(screen.getByText('MAX OPTIONS EXPOSURE')).toBeInTheDocument();
      expect(screen.getByText('Total options exposure 24% exceeds max 20%')).toBeInTheDocument();
      
      // Check that current and limit values are shown
      expect(screen.getByText(/Current: 24.00 \| Limit: 20.00/)).toBeInTheDocument();
    });

    it('should display critical liquidity warnings', () => {
      render(<OptionsRiskPanel metrics={mockMetricsWithErrors} />);
      
      expect(screen.getByText('BANKNIFTY 45000 PUT')).toBeInTheDocument();
      expect(screen.getByText('Wide Bid-Ask Spread - 8% of LTP')).toBeInTheDocument();
      
      // Check for CRITICAL badge
      const badges = screen.getAllByTestId('badge');
      const criticalBadges = badges.filter(badge => badge.textContent?.includes('CRITICAL'));
      expect(criticalBadges.length).toBeGreaterThan(0);
    });

    it('should display urgent recommendations', () => {
      render(<OptionsRiskPanel metrics={mockMetricsWithErrors} />);
      
      expect(screen.getByText('URGENT: Reduce options exposure immediately')).toBeInTheDocument();
      expect(screen.getByText('Close or reduce BANKNIFTY 45000 PUT position due to liquidity concerns')).toBeInTheDocument();
    });

    it('should show exposure exceeding maximum', () => {
      render(<OptionsRiskPanel metrics={mockMetricsWithErrors} />);
      
      expect(screen.getByText('24.0%')).toBeInTheDocument();
      expect(screen.getByText('₹120,000 / 20% max')).toBeInTheDocument();
    });
  });

  describe('Liquidity Warnings Count (Requirement 13.2)', () => {
    it('should display correct count of liquidity warnings', () => {
      render(<OptionsRiskPanel metrics={mockMetricsWithWarnings} />);
      
      // Find the liquidity issues card
      const liquidityCountElements = screen.getAllByText('1');
      expect(liquidityCountElements.length).toBeGreaterThan(0);
      
      expect(screen.getByText('Contracts with warnings')).toBeInTheDocument();
    });

    it('should show zero when no liquidity warnings', () => {
      render(<OptionsRiskPanel metrics={mockHealthyMetrics} />);
      
      expect(screen.getByText('All positions liquid')).toBeInTheDocument();
    });
  });

  describe('Progress Bar Visualization', () => {
    it('should render progress bar for exposure', () => {
      const { container } = render(<OptionsRiskPanel metrics={mockHealthyMetrics} />);
      
      // Check for progress bar elements
      const progressBars = container.querySelectorAll('.h-2.rounded-full');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('should use green color for healthy exposure', () => {
      const { container } = render(<OptionsRiskPanel metrics={mockHealthyMetrics} />);
      
      const greenBar = container.querySelector('.bg-green-500');
      expect(greenBar).toBeInTheDocument();
    });

    it('should use yellow color for warning exposure', () => {
      const { container } = render(<OptionsRiskPanel metrics={mockMetricsWithWarnings} />);
      
      const yellowBar = container.querySelector('.bg-yellow-500');
      expect(yellowBar).toBeInTheDocument();
    });

    it('should use red color for error exposure', () => {
      const { container } = render(<OptionsRiskPanel metrics={mockMetricsWithErrors} />);
      
      const redBar = container.querySelector('.bg-red-600');
      expect(redBar).toBeInTheDocument();
    });
  });

  describe('Options Position Count Display', () => {
    it('should display position count correctly', () => {
      render(<OptionsRiskPanel metrics={mockHealthyMetrics} />);
      
      expect(screen.getByText('Open Positions')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should show max positions when available', () => {
      render(<OptionsRiskPanel metrics={mockHealthyMetrics} />);
      
      expect(screen.getByText('10 max')).toBeInTheDocument();
    });

    it('should show generic label when max not available', () => {
      const metricsWithoutMax = { ...mockHealthyMetrics, maxOpenPositions: undefined };
      render(<OptionsRiskPanel metrics={metricsWithoutMax} />);
      
      expect(screen.getByText('Options contracts')).toBeInTheDocument();
    });
  });

  describe('Multiple Violations Display', () => {
    it('should display multiple risk violations', () => {
      const metricsWithMultipleViolations: OptionsRiskMetrics = {
        ...mockMetricsWithErrors,
        riskViolations: [
          {
            rule: 'MAX_OPTIONS_EXPOSURE',
            message: 'Total options exposure exceeds limit',
            severity: 'ERROR',
          },
          {
            rule: 'ILLIQUID_POSITION',
            message: 'Position has insufficient liquidity',
            severity: 'WARNING',
          },
        ],
      };

      render(<OptionsRiskPanel metrics={metricsWithMultipleViolations} />);
      
      expect(screen.getByText('MAX OPTIONS EXPOSURE')).toBeInTheDocument();
      expect(screen.getByText('ILLIQUID POSITION')).toBeInTheDocument();
    });

    it('should display multiple liquidity warnings', () => {
      const metricsWithMultipleWarnings: OptionsRiskMetrics = {
        ...mockMetricsWithWarnings,
        liquidityWarnings: [
          {
            symbol: 'NIFTY',
            strikePrice: 21500,
            optionType: 'CALL',
            reason: 'Low Volume',
            severity: 'WARNING',
          },
          {
            symbol: 'BANKNIFTY',
            strikePrice: 45000,
            optionType: 'PUT',
            reason: 'Wide Spread',
            severity: 'WARNING',
          },
        ],
      };

      render(<OptionsRiskPanel metrics={metricsWithMultipleWarnings} />);
      
      expect(screen.getByText('NIFTY 21500 CALL')).toBeInTheDocument();
      expect(screen.getByText('BANKNIFTY 45000 PUT')).toBeInTheDocument();
    });
  });

  describe('Portfolio Value Display', () => {
    it('should display portfolio value when provided', () => {
      render(<OptionsRiskPanel metrics={mockHealthyMetrics} portfolioValue={750000} />);
      
      expect(screen.getByText(/Portfolio Value: ₹750,000/)).toBeInTheDocument();
    });

    it('should not show portfolio value when not provided', () => {
      render(<OptionsRiskPanel metrics={mockHealthyMetrics} />);
      
      const portfolioText = screen.queryByText(/Portfolio Value:/);
      expect(portfolioText).not.toBeInTheDocument();
    });
  });

  describe('Requirement 8.5: Risk Validation Result Display', () => {
    it('should display risk validation violations with reasons', () => {
      render(<OptionsRiskPanel metrics={mockMetricsWithErrors} />);
      
      // Verify violation rule name is shown
      expect(screen.getByText('MAX OPTIONS EXPOSURE')).toBeInTheDocument();
      
      // Verify violation message (reason) is shown
      expect(screen.getByText('Total options exposure 24% exceeds max 20%')).toBeInTheDocument();
      
      // Verify severity is shown
      const badges = screen.getAllByTestId('badge');
      const errorBadges = badges.filter(badge => badge.textContent?.includes('ERROR'));
      expect(errorBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Requirement 13.2: Structured Display', () => {
    it('should display recommendations in structured format', () => {
      render(<OptionsRiskPanel metrics={mockMetricsWithWarnings} />);
      
      // Verify recommendations section exists
      expect(screen.getByText('Risk Recommendations')).toBeInTheDocument();
      
      // Verify recommendations are displayed
      expect(screen.getByText('Consider reducing options exposure to maintain safety margin')).toBeInTheDocument();
    });

    it('should use card components for structured layout', () => {
      render(<OptionsRiskPanel metrics={mockHealthyMetrics} />);
      
      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('card-header')).toBeInTheDocument();
      expect(screen.getByTestId('card-content')).toBeInTheDocument();
    });
  });
});
