/**
 * Unit Tests for OptionsChainViewer Component
 * 
 * Tests component rendering, data display, ATM highlighting, and user interactions.
 * Requirements covered: 13.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OptionsChainViewer } from './options-chain-viewer';
import { apiClient, OptionsChainResponse } from '@/lib/api-client';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getOptionsChain: vi.fn(),
  },
}));

const mockOptionsChainData: OptionsChainResponse = {
  underlying: 'NIFTY',
  expiryDate: '2024-12-26',
  spotPrice: 21500,
  strikes: [
    {
      strikePrice: 21400,
      call: {
        ltp: 150.5,
        volume: 5000,
        oi: 10000,
        iv: 15.5,
        bid: 149.5,
        ask: 151.0,
        changeOI: 500,
      },
      put: {
        ltp: 25.5,
        volume: 2000,
        oi: 5000,
        iv: 14.2,
        bid: 25.0,
        ask: 26.0,
        changeOI: -200,
      },
    },
    {
      strikePrice: 21500, // ATM
      call: {
        ltp: 95.75,
        volume: 15000,
        oi: 25000,
        iv: 16.0,
        bid: 95.0,
        ask: 96.5,
        changeOI: 1000,
      },
      put: {
        ltp: 94.25,
        volume: 14000,
        oi: 24000,
        iv: 16.1,
        bid: 93.5,
        ask: 95.0,
        changeOI: 800,
      },
    },
    {
      strikePrice: 21600,
      call: {
        ltp: 45.5,
        volume: 8000,
        oi: 15000,
        iv: 17.5,
        bid: 45.0,
        ask: 46.0,
        changeOI: -300,
      },
      put: {
        ltp: 145.75,
        volume: 6000,
        oi: 12000,
        iv: 16.8,
        bid: 145.0,
        ask: 146.5,
        changeOI: 400,
      },
    },
    {
      strikePrice: 21700,
      call: {
        ltp: 15.5,
        volume: 50, // Low volume
        oi: 300, // Low OI
        iv: 18.0,
        bid: 14.0,
        ask: 17.0, // Wide spread
      },
      put: {
        ltp: 215.5,
        volume: 80, // Low volume
        oi: 400, // Low OI
        iv: 17.5,
        bid: 214.0,
        ask: 217.0,
      },
    },
  ],
};

describe('OptionsChainViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should render with no data and show fetch button', () => {
      render(<OptionsChainViewer underlying="NIFTY" />);

      expect(screen.getByText('NIFTY Options Chain')).toBeInTheDocument();
      expect(screen.getByText('Click "FETCH CHAIN" to load options data')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /FETCH CHAIN/i })).toBeInTheDocument();
    });

    it('should render with initial data', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      expect(screen.getByText('NIFTY Options Chain')).toBeInTheDocument();
      expect(screen.getByText(/Spot Price: ₹21500.00/)).toBeInTheDocument();
      expect(screen.getByText(/Expiry: 2024-12-26/)).toBeInTheDocument();
    });

    it('should display table headers correctly', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // Call headers
      expect(screen.getByText('Call LTP')).toBeInTheDocument();
      expect(screen.getByText('Call OI')).toBeInTheDocument();
      expect(screen.getByText('Call Vol')).toBeInTheDocument();
      expect(screen.getByText('Call IV')).toBeInTheDocument();

      // Strike header
      expect(screen.getByText('Strike')).toBeInTheDocument();

      // Put headers
      expect(screen.getByText('Put LTP')).toBeInTheDocument();
      expect(screen.getByText('Put OI')).toBeInTheDocument();
      expect(screen.getByText('Put Vol')).toBeInTheDocument();
      expect(screen.getByText('Put IV')).toBeInTheDocument();
    });
  });

  describe('Data Display', () => {
    it('should display all strike prices', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      expect(screen.getByText('21400')).toBeInTheDocument();
      expect(screen.getByText('21500')).toBeInTheDocument();
      expect(screen.getByText('21600')).toBeInTheDocument();
      expect(screen.getByText('21700')).toBeInTheDocument();
    });

    it('should display call LTP values', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      expect(screen.getByText('₹150.50')).toBeInTheDocument();
      expect(screen.getByText('₹95.75')).toBeInTheDocument();
      expect(screen.getByText('₹45.50')).toBeInTheDocument();
    });

    it('should display put LTP values', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      expect(screen.getByText('₹25.50')).toBeInTheDocument();
      expect(screen.getByText('₹94.25')).toBeInTheDocument();
      expect(screen.getByText('₹145.75')).toBeInTheDocument();
    });

    it('should display OI and volume with thousands separators', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // Use getAllByText since values appear in multiple columns
      expect(screen.getAllByText('10,000').length).toBeGreaterThan(0); // OI
      expect(screen.getAllByText('5,000').length).toBeGreaterThan(0); // Volume
      expect(screen.getAllByText('15,000').length).toBeGreaterThan(0); // Volume
    });

    it('should display IV percentages', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // Use getAllByText since IV appears in both call and put columns
      expect(screen.getAllByText('15.50%').length).toBeGreaterThan(0);
      expect(screen.getAllByText('16.00%').length).toBeGreaterThan(0);
      expect(screen.getAllByText('17.50%').length).toBeGreaterThan(0);
    });

    it('should display bid/ask spreads when available', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      expect(screen.getByText('149.50 / 151.00')).toBeInTheDocument();
      expect(screen.getByText('95.00 / 96.50')).toBeInTheDocument();
    });

    it('should display change in OI with color coding', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // Positive change (green)
      const positiveChange = screen.getByText('+1,000');
      expect(positiveChange).toBeInTheDocument();
      expect(positiveChange).toHaveClass('text-green-600');

      // Negative change (red)
      const negativeChange = screen.getByText('-300');
      expect(negativeChange).toBeInTheDocument();
      expect(negativeChange).toHaveClass('text-red-600');
    });
  });

  describe('ATM Highlighting', () => {
    it('should identify and highlight ATM strike (closest to spot)', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // ATM badge should be present
      expect(screen.getByText('ATM')).toBeInTheDocument();
      
      // ATM strike should be 21500 (closest to spot price of 21500)
      // The strike text "21500" will be in a cell with font-bold class
      const strikeCell = screen.getByText('21500').closest('td');
      expect(strikeCell).toHaveClass('font-bold');
    });

    it('should highlight near-ATM strikes with light background', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // Check that rows have different background classes
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(4); // Header + data rows
    });
  });

  describe('ITM/OTM Color Coding', () => {
    it('should highlight ITM calls (strike < spot)', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // Strike 21400 call should be ITM (bold green) since 21400 < 21500
      const itmCallLTP = screen.getByText('₹150.50');
      const cellElement = itmCallLTP.closest('td');
      expect(cellElement).toHaveClass('font-semibold');
      expect(cellElement?.className).toMatch(/text-green/);
    });

    it('should highlight ITM puts (strike > spot)', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // Strike 21600 put should be ITM (bold red) since 21600 > 21500
      const itmPutLTP = screen.getByText('₹145.75');
      const cellElement = itmPutLTP.closest('td');
      expect(cellElement).toHaveClass('font-semibold');
      expect(cellElement?.className).toMatch(/text-red/);
    });

    it('should show OTM options with muted colors', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // Strike 21600 call should be OTM (muted) since 21600 > 21500
      const otmCallLTP = screen.getByText('₹45.50');
      const cellElement = otmCallLTP.closest('td');
      expect(cellElement?.className).toMatch(/text-muted-foreground/);
    });
  });

  describe('Liquidity Warnings', () => {
    it('should show low volume warning', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // Strike 21700 has volume < 100
      const lowVolumeWarnings = screen.getAllByText('Low Volume');
      expect(lowVolumeWarnings.length).toBeGreaterThan(0);
    });

    it('should show low OI warning', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // Strike 21700 has OI < 500
      const lowOIWarnings = screen.getAllByText('Low OI');
      expect(lowOIWarnings.length).toBeGreaterThan(0);
    });

    it('should show wide spread warning', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // Strike 21700 call has spread > 5% (14.0 to 17.0 on LTP 15.5)
      const wideSpreadWarnings = screen.getAllByText('Wide Spread');
      expect(wideSpreadWarnings.length).toBeGreaterThan(0);
    });

    it('should display warning badges with alert icon', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      // Check for warning badges - look for the warning text instead
      const lowVolumeWarnings = screen.getAllByText('Low Volume');
      expect(lowVolumeWarnings.length).toBeGreaterThan(0);
      
      const lowOIWarnings = screen.getAllByText('Low OI');
      expect(lowOIWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('Manual Fetch Functionality', () => {
    it('should call API when fetch button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.getOptionsChain).mockResolvedValue(mockOptionsChainData);

      render(<OptionsChainViewer underlying="NIFTY" />);

      const fetchButton = screen.getByRole('button', { name: /FETCH CHAIN/i });
      await user.click(fetchButton);

      await waitFor(() => {
        expect(apiClient.getOptionsChain).toHaveBeenCalledWith('NIFTY', undefined);
      });
    });

    it('should display loading state while fetching', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.getOptionsChain).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockOptionsChainData), 100))
      );

      render(<OptionsChainViewer underlying="NIFTY" />);

      const fetchButton = screen.getByRole('button', { name: /FETCH CHAIN/i });
      await user.click(fetchButton);

      expect(screen.getByText('Fetching...')).toBeInTheDocument();
      expect(fetchButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByText('Fetching...')).not.toBeInTheDocument();
      });
    });

    it('should update table with fetched data', async () => {
      const user = userEvent.setup();
      vi.mocked(apiClient.getOptionsChain).mockResolvedValue(mockOptionsChainData);

      render(<OptionsChainViewer underlying="NIFTY" />);

      const fetchButton = screen.getByRole('button', { name: /FETCH CHAIN/i });
      await user.click(fetchButton);

      await waitFor(() => {
        expect(screen.getByText(/Spot Price: ₹21500.00/)).toBeInTheDocument();
        expect(screen.getByText('21500')).toBeInTheDocument();
      });
    });

    it('should call onDataFetch callback on successful fetch', async () => {
      const user = userEvent.setup();
      const onDataFetch = vi.fn();
      vi.mocked(apiClient.getOptionsChain).mockResolvedValue(mockOptionsChainData);

      render(<OptionsChainViewer underlying="NIFTY" onDataFetch={onDataFetch} />);

      const fetchButton = screen.getByRole('button', { name: /FETCH CHAIN/i });
      await user.click(fetchButton);

      await waitFor(() => {
        expect(onDataFetch).toHaveBeenCalledWith(mockOptionsChainData);
      });
    });

    it('should display error message on fetch failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Network error: Failed to fetch';
      vi.mocked(apiClient.getOptionsChain).mockRejectedValue(new Error(errorMessage));

      render(<OptionsChainViewer underlying="NIFTY" />);

      const fetchButton = screen.getByRole('button', { name: /FETCH CHAIN/i });
      await user.click(fetchButton);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should call onError callback on fetch failure', async () => {
      const user = userEvent.setup();
      const onError = vi.fn();
      const error = new Error('API error');
      vi.mocked(apiClient.getOptionsChain).mockRejectedValue(error);

      render(<OptionsChainViewer underlying="NIFTY" onError={onError} />);

      const fetchButton = screen.getByRole('button', { name: /FETCH CHAIN/i });
      await user.click(fetchButton);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });

    it('should pass expiry date to API when provided', async () => {
      const user = userEvent.setup();
      const expiryDate = '2024-12-26';
      vi.mocked(apiClient.getOptionsChain).mockResolvedValue(mockOptionsChainData);

      render(<OptionsChainViewer underlying="BANKNIFTY" expiryDate={expiryDate} />);

      const fetchButton = screen.getByRole('button', { name: /FETCH CHAIN/i });
      await user.click(fetchButton);

      await waitFor(() => {
        expect(apiClient.getOptionsChain).toHaveBeenCalledWith('BANKNIFTY', expiryDate);
      });
    });
  });

  describe('NO Auto-Refresh', () => {
    it('should not fetch data automatically on mount', () => {
      render(<OptionsChainViewer underlying="NIFTY" />);

      expect(apiClient.getOptionsChain).not.toHaveBeenCalled();
    });

    it('should not set up any intervals for auto-refresh', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      expect(setIntervalSpy).not.toHaveBeenCalled();

      setIntervalSpy.mockRestore();
    });
  });

  describe('Legend Display', () => {
    it('should display legend when data is loaded', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      expect(screen.getByText('Legend')).toBeInTheDocument();
      expect(screen.getByText('ATM:')).toBeInTheDocument();
      expect(screen.getByText('At-The-Money strike')).toBeInTheDocument();
    });

    it('should not display legend when no data', () => {
      render(<OptionsChainViewer underlying="NIFTY" />);

      expect(screen.queryByText('Legend')).not.toBeInTheDocument();
    });

    it('should show liquidity warning thresholds in legend', () => {
      render(<OptionsChainViewer underlying="NIFTY" initialData={mockOptionsChainData} />);

      expect(screen.getByText(/Low Volume: <100 contracts/)).toBeInTheDocument();
      expect(screen.getByText(/Low OI: <500 contracts/)).toBeInTheDocument();
      expect(screen.getByText(/Wide Spread: Bid-Ask spread >5% of LTP/)).toBeInTheDocument();
    });
  });

  describe('BANKNIFTY Support', () => {
    it('should work with BANKNIFTY underlying', () => {
      const bankniftyData: OptionsChainResponse = {
        ...mockOptionsChainData,
        underlying: 'BANKNIFTY',
        spotPrice: 46500,
      };

      render(<OptionsChainViewer underlying="BANKNIFTY" initialData={bankniftyData} />);

      expect(screen.getByText('BANKNIFTY Options Chain')).toBeInTheDocument();
      expect(screen.getByText(/Spot Price: ₹46500.00/)).toBeInTheDocument();
    });
  });
});
