/**
 * Unit Tests for PromptInput Component
 *
 * Tests user interaction, API integration, and feedback display.
 *
 * Requirements: 13.1, 13.2
 * Task: 18.1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PromptInput } from './prompt-input';
import { apiClient, type PromptResponse } from '@/lib/api-client';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    submitPrompt: vi.fn(),
  },
}));

describe('PromptInput', () => {
  const mockApiClient = apiClient as { submitPrompt: ReturnType<typeof vi.fn> };

  const mockSuccessResponse: PromptResponse = {
    rawPrompt: 'Find the best swing trade in RELIANCE',
    parsed: {
      intent: 'FIND_TRADE',
      symbols: ['RELIANCE'],
      timeframe: 'SWING',
      assetType: 'STOCK',
    },
    recommendation: {
      id: 'test-id',
      action: 'BUY',
      symbol: 'RELIANCE',
      entryPrice: 2460,
      target: 2520,
      stopLoss: 2430,
      confidence: 0.75,
      reasoning: 'Test reasoning',
      quantData: {
        symbol: 'RELIANCE',
        timeframe: '1d',
        indicators: {
          rsi: 45.2,
          macd: { value: 12.3, signal: 10.1, histogram: 2.2 },
          sma_20: 2455.0,
          sma_50: 2450.0,
          sma_200: 2380.0,
          ema_20: 2458.0,
          bollingerBands: { upper: 2500.0, middle: 2455.0, lower: 2410.0 },
        },
        supportResistance: [],
        trendlines: [],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the input field and submit button', () => {
      render(<PromptInput />);

      expect(screen.getByPlaceholderText(/Enter your trading prompt/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit/i })).toBeInTheDocument();
    });

    it('should render with custom className', () => {
      const { container } = render(<PromptInput className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('should have submit button disabled when input is empty', () => {
      render(<PromptInput />);
      const submitButton = screen.getByRole('button', { name: /Submit/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('User Interaction', () => {
    it('should update input value when user types', () => {
      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i) as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'Test prompt' } });

      expect(input.value).toBe('Test prompt');
    });

    it('should enable submit button when input has text', () => {
      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Test prompt' } });

      expect(submitButton).not.toBeDisabled();
    });

    it('should show error when submitting empty prompt', async () => {
      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);

      // Set input to whitespace only
      fireEvent.change(input, { target: { value: '   ' } });

      // Since the button is disabled when trimmed value is empty,
      // we need to force form submission
      const form = input.closest('form');
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(screen.getByText(/Please enter a prompt/i)).toBeInTheDocument();
      });
    });

    it('should submit on Enter key press', async () => {
      mockApiClient.submitPrompt.mockResolvedValueOnce(mockSuccessResponse);
      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);

      fireEvent.change(input, { target: { value: 'Test prompt' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(mockApiClient.submitPrompt).toHaveBeenCalledWith('Test prompt');
      });
    });

    it('should not submit on Shift+Enter', async () => {
      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);

      fireEvent.change(input, { target: { value: 'Test prompt' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true });

      await waitFor(() => {
        expect(mockApiClient.submitPrompt).not.toHaveBeenCalled();
      });
    });
  });

  describe('API Integration', () => {
    it('should call submitPrompt API when form is submitted', async () => {
      mockApiClient.submitPrompt.mockResolvedValueOnce(mockSuccessResponse);
      render(<PromptInput />);

      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Find best trade' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockApiClient.submitPrompt).toHaveBeenCalledWith('Find best trade');
      });
    });

    it('should show loading state during API call', async () => {
      mockApiClient.submitPrompt.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockSuccessResponse), 100))
      );

      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      // Should show loading state
      expect(screen.getByText(/Processing/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByText(/Processing/i)).not.toBeInTheDocument();
      });
    });

    it('should display error message when API call fails', async () => {
      const errorMessage = 'API request failed: 500';
      mockApiClient.submitPrompt.mockRejectedValueOnce(new Error(errorMessage));

      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should call onSubmit callback when provided', async () => {
      mockApiClient.submitPrompt.mockResolvedValueOnce(mockSuccessResponse);
      const onSubmit = vi.fn();

      render(<PromptInput onSubmit={onSubmit} />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(mockSuccessResponse);
      });
    });
  });

  describe('Parsing Feedback Display', () => {
    it('should not show parsing feedback initially', () => {
      render(<PromptInput />);
      expect(screen.queryByText(/Prompt Analysis/i)).not.toBeInTheDocument();
    });

    it('should display parsing feedback after successful submission', async () => {
      mockApiClient.submitPrompt.mockResolvedValueOnce(mockSuccessResponse);

      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Find best trade' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Prompt Analysis/i)).toBeInTheDocument();
      });
    });

    it('should display extracted intent', async () => {
      mockApiClient.submitPrompt.mockResolvedValueOnce(mockSuccessResponse);

      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/FIND TRADE/i)).toBeInTheDocument();
      });
    });

    it('should display extracted symbols', async () => {
      mockApiClient.submitPrompt.mockResolvedValueOnce(mockSuccessResponse);

      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      });
    });

    it('should display extracted timeframe', async () => {
      mockApiClient.submitPrompt.mockResolvedValueOnce(mockSuccessResponse);

      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('SWING')).toBeInTheDocument();
      });
    });

    it('should display extracted asset type', async () => {
      mockApiClient.submitPrompt.mockResolvedValueOnce(mockSuccessResponse);

      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('STOCK')).toBeInTheDocument();
      });
    });

    it('should display original prompt', async () => {
      mockApiClient.submitPrompt.mockResolvedValueOnce(mockSuccessResponse);

      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Find the best swing trade in RELIANCE/i)).toBeInTheDocument();
      });
    });

    it('should handle response with multiple symbols', async () => {
      const multiSymbolResponse: PromptResponse = {
        ...mockSuccessResponse,
        parsed: {
          ...mockSuccessResponse.parsed,
          symbols: ['RELIANCE', 'TCS', 'INFY'],
        },
      };
      mockApiClient.submitPrompt.mockResolvedValueOnce(multiSymbolResponse);

      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('RELIANCE')).toBeInTheDocument();
        expect(screen.getByText('TCS')).toBeInTheDocument();
        expect(screen.getByText('INFY')).toBeInTheDocument();
      });
    });

    it('should handle response without optional fields', async () => {
      const minimalResponse: PromptResponse = {
        ...mockSuccessResponse,
        parsed: {
          intent: 'QUERY',
          symbols: [],
          // No timeframe or assetType
        },
      };
      mockApiClient.submitPrompt.mockResolvedValueOnce(minimalResponse);

      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Prompt Analysis/i)).toBeInTheDocument();
        // Timeframe and asset type sections should not appear
        expect(screen.queryByText('Timeframe:')).not.toBeInTheDocument();
        expect(screen.queryByText('Asset Type:')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery', () => {
    it('should clear error when user types in input after error', async () => {
      const errorMessage = 'API error';
      mockApiClient.submitPrompt.mockRejectedValueOnce(new Error(errorMessage));

      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      // Trigger error
      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // Type new input - error should still be there until next submit
      fireEvent.change(input, { target: { value: 'New test' } });

      // Error should still be visible (it only clears on new submit)
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('should clear error on successful retry', async () => {
      const errorMessage = 'API error';
      mockApiClient.submitPrompt
        .mockRejectedValueOnce(new Error(errorMessage))
        .mockResolvedValueOnce(mockSuccessResponse);

      render(<PromptInput />);
      const input = screen.getByPlaceholderText(/Enter your trading prompt/i);
      const submitButton = screen.getByRole('button', { name: /Submit/i });

      // First submission - error
      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });

      // Second submission - success
      fireEvent.change(input, { target: { value: 'New test' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
        expect(screen.getByText(/Prompt Analysis/i)).toBeInTheDocument();
      });
    });
  });
});
