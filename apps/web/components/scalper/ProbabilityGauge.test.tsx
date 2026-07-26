import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProbabilityGauge } from './ProbabilityGauge';

describe('ProbabilityGauge', () => {
  it('should display percentage with 1 decimal place for valid value', () => {
    render(<ProbabilityGauge probability={75.5} />);
    expect(screen.getByText('75.5%')).toBeInTheDocument();
  });

  it('should display red color when probability < 50%', () => {
    const { container } = render(<ProbabilityGauge probability={35.2} />);
    const percentText = screen.getByText('35.2%');
    expect(percentText).toHaveClass('text-red-600');
    // Verify red background container
    const gauge = container.querySelector('[role="meter"]');
    expect(gauge).toHaveClass('bg-red-100');
  });

  it('should display yellow color when probability is 50-70%', () => {
    const { container } = render(<ProbabilityGauge probability={60.0} />);
    const percentText = screen.getByText('60.0%');
    expect(percentText).toHaveClass('text-yellow-600');
    const gauge = container.querySelector('[role="meter"]');
    expect(gauge).toHaveClass('bg-yellow-100');
  });

  it('should display green color when probability >= 70%', () => {
    const { container } = render(<ProbabilityGauge probability={85.3} />);
    const percentText = screen.getByText('85.3%');
    expect(percentText).toHaveClass('text-green-600');
    const gauge = container.querySelector('[role="meter"]');
    expect(gauge).toHaveClass('bg-green-100');
  });

  it('should display "N/A" with gray for null probability', () => {
    render(<ProbabilityGauge probability={null} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toHaveClass('text-gray-400');
  });

  it('should display "N/A" for out-of-range values (>100)', () => {
    render(<ProbabilityGauge probability={150} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('should display "N/A" for out-of-range values (<0)', () => {
    render(<ProbabilityGauge probability={-10} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('should display "N/A" for NaN values', () => {
    render(<ProbabilityGauge probability={NaN} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('should display "N/A" for Infinity values', () => {
    render(<ProbabilityGauge probability={Infinity} />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('should display "Calculating..." before first analysis', () => {
    render(<ProbabilityGauge probability={null} isInitializing={true} />);
    expect(screen.getByText('Calculating...')).toBeInTheDocument();
  });

  it('should have minimum height of 80px', () => {
    const { container } = render(<ProbabilityGauge probability={70} />);
    const gauge = container.querySelector('[role="meter"]');
    expect(gauge).toHaveStyle({ minHeight: '80px' });
  });

  it('should handle boundary value 0%', () => {
    render(<ProbabilityGauge probability={0} />);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('should handle boundary value 100%', () => {
    render(<ProbabilityGauge probability={100} />);
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('should handle boundary value exactly 50%', () => {
    const { container } = render(<ProbabilityGauge probability={50} />);
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    const gauge = container.querySelector('[role="meter"]');
    expect(gauge).toHaveClass('bg-yellow-100');
  });

  it('should handle boundary value exactly 70%', () => {
    const { container } = render(<ProbabilityGauge probability={70} />);
    expect(screen.getByText('70.0%')).toBeInTheDocument();
    const gauge = container.querySelector('[role="meter"]');
    expect(gauge).toHaveClass('bg-green-100');
  });

  it('should have proper aria attributes', () => {
    const { container } = render(<ProbabilityGauge probability={75} />);
    const gauge = container.querySelector('[role="meter"]');
    expect(gauge).toHaveAttribute('aria-valuemin', '0');
    expect(gauge).toHaveAttribute('aria-valuemax', '100');
    expect(gauge).toHaveAttribute('aria-valuenow', '75');
  });
});
