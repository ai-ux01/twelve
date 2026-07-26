import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LiveStatusPanel, LiveStatusPanelProps } from './LiveStatusPanel';

describe('LiveStatusPanel', () => {
  const defaultProps: LiveStatusPanelProps = {
    status: 'active',
    lastUpdated: new Date('2024-01-15T14:30:45'),
    secondsUntilRefresh: 45,
    isRefreshing: false,
    onRefreshNow: vi.fn(),
    onTogglePause: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should display pulsing green dot when active', () => {
    render(<LiveStatusPanel {...defaultProps} />);
    const dot = screen.getByLabelText('Auto-refresh active');
    expect(dot).toHaveClass('bg-green-500');
    expect(dot).toHaveClass('animate-pulse-dot');
  });

  it('should display gray non-pulsing dot when paused', () => {
    render(<LiveStatusPanel {...defaultProps} status="paused" />);
    const dot = screen.getByLabelText('Auto-refresh paused');
    expect(dot).toHaveClass('bg-gray-400');
    expect(dot).not.toHaveClass('animate-pulse-dot');
  });

  it('should display red dot when error', () => {
    render(
      <LiveStatusPanel {...defaultProps} status="error" errorMessage="Fetch failed" />
    );
    const dot = screen.getByLabelText('Error: Fetch failed');
    expect(dot).toHaveClass('bg-red-500');
  });

  it('should display "Initializing..." state before first analysis', () => {
    render(<LiveStatusPanel {...defaultProps} status="initializing" />);
    expect(screen.getByText('Initializing...')).toBeInTheDocument();
  });

  it('should display Last Updated timestamp in HH:MM:SS AM/PM format', () => {
    render(<LiveStatusPanel {...defaultProps} />);
    expect(screen.getByText('Last Updated:')).toBeInTheDocument();
    // The formatted time should contain AM/PM
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}\s*(AM|PM)/i)).toBeInTheDocument();
  });

  it('should display countdown timer', () => {
    render(<LiveStatusPanel {...defaultProps} secondsUntilRefresh={45} />);
    expect(screen.getByText('0:45')).toBeInTheDocument();
  });

  it('should update countdown every second', () => {
    render(<LiveStatusPanel {...defaultProps} secondsUntilRefresh={45} />);
    expect(screen.getByText('0:45')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('0:44')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('0:43')).toBeInTheDocument();
  });

  it('should display REFRESH NOW button', () => {
    render(<LiveStatusPanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /refresh now/i })).toBeInTheDocument();
  });

  it('should trigger onRefreshNow when REFRESH NOW is clicked', () => {
    const onRefreshNow = vi.fn();
    render(<LiveStatusPanel {...defaultProps} onRefreshNow={onRefreshNow} />);
    fireEvent.click(screen.getByRole('button', { name: /refresh now/i }));
    expect(onRefreshNow).toHaveBeenCalledTimes(1);
  });

  it('should disable REFRESH NOW button while refresh in progress', () => {
    render(<LiveStatusPanel {...defaultProps} isRefreshing={true} />);
    expect(screen.getByRole('button', { name: /refresh now/i })).toBeDisabled();
  });

  it('should display PAUSE AUTO REFRESH toggle button', () => {
    render(<LiveStatusPanel {...defaultProps} />);
    expect(
      screen.getByRole('button', { name: /pause auto refresh/i })
    ).toBeInTheDocument();
  });

  it('should display PAUSED indicator when paused', () => {
    render(<LiveStatusPanel {...defaultProps} status="paused" />);
    const paused = screen.getByText('PAUSED');
    expect(paused).toBeInTheDocument();
    // Font should be >= 14px
    expect(paused).toHaveStyle({ fontSize: '14px' });
  });

  it('should call onTogglePause with true when pause button is clicked', () => {
    const onTogglePause = vi.fn();
    render(<LiveStatusPanel {...defaultProps} onTogglePause={onTogglePause} />);
    fireEvent.click(screen.getByRole('button', { name: /pause auto refresh/i }));
    expect(onTogglePause).toHaveBeenCalledWith(true);
  });

  it('should call onTogglePause with false when resume button is clicked', () => {
    const onTogglePause = vi.fn();
    render(
      <LiveStatusPanel {...defaultProps} status="paused" onTogglePause={onTogglePause} />
    );
    fireEvent.click(screen.getByRole('button', { name: /resume auto refresh/i }));
    expect(onTogglePause).toHaveBeenCalledWith(false);
  });

  it('should not call onRefreshNow when button is disabled', () => {
    const onRefreshNow = vi.fn();
    render(
      <LiveStatusPanel {...defaultProps} isRefreshing={true} onRefreshNow={onRefreshNow} />
    );
    fireEvent.click(screen.getByRole('button', { name: /refresh now/i }));
    expect(onRefreshNow).not.toHaveBeenCalled();
  });

  it('should handle null lastUpdated gracefully', () => {
    render(<LiveStatusPanel {...defaultProps} lastUpdated={null} />);
    expect(screen.getByText('--:--:-- --')).toBeInTheDocument();
  });

  it('should not show countdown when paused', () => {
    render(<LiveStatusPanel {...defaultProps} status="paused" />);
    expect(screen.queryByText('Next refresh:')).not.toBeInTheDocument();
  });
});
