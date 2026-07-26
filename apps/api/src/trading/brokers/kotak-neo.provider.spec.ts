import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { KotakNeoProvider, PlaceOrderRequest } from './kotak-neo.provider';
import { ConfigService } from '../../config/config.service';
import { AuditLogService } from '../../audit/audit.service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('KotakNeoProvider', () => {
  let provider: KotakNeoProvider;
  let mockAxiosInstance: Record<string, jest.Mock>;
  let mockAuditLogService: Partial<AuditLogService>;

  beforeEach(async () => {
    // Create mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
    };

    (mockedAxios.create as jest.Mock) = jest.fn().mockReturnValue({
      ...mockAxiosInstance,
      defaults: { headers: {} },
    });

    mockAuditLogService = {
      logBrokerCall: jest.fn().mockResolvedValue('audit-id'),
      log: jest.fn().mockResolvedValue('audit-id'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KotakNeoProvider,
        {
          provide: ConfigService,
          useValue: {
            kotakApiKey: 'test-api-key',
            kotakApiSecret: 'test-api-secret',
            kotakNeoConsumerKey: 'test-consumer-key',
            kotakNeoConsumerSecret: 'test-consumer-secret',
            kotakNeoAccessToken: 'test-access-token',
            kotakNeoSessionToken: 'test-session-token',
          },
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    provider = module.get<KotakNeoProvider>(KotakNeoProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('placeOrder', () => {
    const validOrderRequest: PlaceOrderRequest = {
      symbol: 'RELIANCE',
      action: 'BUY',
      quantity: 10,
      price: 2460.5,
      orderType: 'LIMIT',
      productType: 'CNC',
    };

    it('should successfully place a BUY order', async () => {
      const mockResponse = {
        data: {
          stat: 'Ok',
          nOrdNo: '240125000123456',
          stCode: 200,
          message: 'Order placed successfully',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.placeOrder(validOrderRequest);

      expect(result.success).toBe(true);
      expect(result.brokerOrderId).toBe('240125000123456');
      expect(result.status).toBe('OPEN');
      expect(result.message).toBe('Order placed successfully');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Orders/2.0/quick/order/rule/ms',
        expect.objectContaining({
          ts: 'RELIANCE',
          tt: 'L',
          qt: '10',
          pr: '2460.5',
        })
      );
    });

    it('should successfully place a SELL order', async () => {
      const sellRequest: PlaceOrderRequest = {
        ...validOrderRequest,
        action: 'SELL',
      };

      const mockResponse = {
        data: {
          stat: 'Ok',
          nOrdNo: '240125000123457',
          stCode: 200,
          message: 'Order placed successfully',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.placeOrder(sellRequest);

      expect(result.success).toBe(true);
      expect(result.brokerOrderId).toBe('240125000123457');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Orders/2.0/quick/order/rule/ms',
        expect.objectContaining({
          am: expect.any(String) as string, // SELL order
        })
      );
    });

    it('should place order with stop loss', async () => {
      const orderWithSL: PlaceOrderRequest = {
        ...validOrderRequest,
        stopLoss: 2430.0,
      };

      const mockResponse = {
        data: {
          stat: 'Ok',
          nOrdNo: '240125000123458',
          stCode: 200,
          message: 'Order placed successfully',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await provider.placeOrder(orderWithSL);

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/Orders/2.0/quick/order/rule/ms',
        expect.objectContaining({
          tt: 'SL', // Stop loss trigger type
        })
      );
    });

    it('should throw error for invalid symbol (empty)', async () => {
      const invalidRequest: PlaceOrderRequest = {
        ...validOrderRequest,
        symbol: '',
      };

      await expect(provider.placeOrder(invalidRequest)).rejects.toThrow(
        new HttpException('Symbol is required', HttpStatus.BAD_REQUEST)
      );
    });

    it('should throw error for invalid action', async () => {
      const invalidRequest: PlaceOrderRequest = {
        ...validOrderRequest,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        action: 'HOLD' as any,
      };

      await expect(provider.placeOrder(invalidRequest)).rejects.toThrow(
        new HttpException('Action must be BUY or SELL', HttpStatus.BAD_REQUEST)
      );
    });

    it('should throw error for zero or negative quantity', async () => {
      const invalidRequest: PlaceOrderRequest = {
        ...validOrderRequest,
        quantity: 0,
      };

      await expect(provider.placeOrder(invalidRequest)).rejects.toThrow(
        new HttpException('Quantity must be a positive integer', HttpStatus.BAD_REQUEST)
      );
    });

    it('should throw error for negative price', async () => {
      const invalidRequest: PlaceOrderRequest = {
        ...validOrderRequest,
        price: -100,
      };

      await expect(provider.placeOrder(invalidRequest)).rejects.toThrow(
        new HttpException('Price must be positive', HttpStatus.BAD_REQUEST)
      );
    });

    it('should throw error for invalid stop loss on BUY order (SL >= price)', async () => {
      const invalidRequest: PlaceOrderRequest = {
        ...validOrderRequest,
        action: 'BUY',
        price: 2460.5,
        stopLoss: 2470.0, // SL above entry price for BUY
      };

      await expect(provider.placeOrder(invalidRequest)).rejects.toThrow(
        new HttpException(
          'Stop loss must be below entry price for BUY orders',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should throw error for invalid stop loss on SELL order (SL <= price)', async () => {
      const invalidRequest: PlaceOrderRequest = {
        ...validOrderRequest,
        action: 'SELL',
        price: 2460.5,
        stopLoss: 2450.0, // SL below entry price for SELL
      };

      await expect(provider.placeOrder(invalidRequest)).rejects.toThrow(
        new HttpException(
          'Stop loss must be above entry price for SELL orders',
          HttpStatus.BAD_REQUEST
        )
      );
    });

    it('should handle broker authentication error (401)', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
        message: 'Request failed with status code 401',
      });

      await expect(provider.placeOrder(validOrderRequest)).rejects.toThrow(
        new HttpException(
          'Kotak Neo authentication failed. Check API credentials.',
          HttpStatus.UNAUTHORIZED
        )
      );
    });

    it('should handle broker rate limit error (429)', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 429,
          data: { message: 'Rate limit exceeded' },
        },
        message: 'Request failed with status code 429',
      });

      await expect(provider.placeOrder(validOrderRequest)).rejects.toThrow(
        new HttpException(
          'Kotak Neo rate limit exceeded. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS
        )
      );
    });

    it('should handle broker server error (500)', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
        message: 'Request failed with status code 500',
      });

      await expect(provider.placeOrder(validOrderRequest)).rejects.toThrow(
        new HttpException(
          'Broker service temporarily unavailable: Internal server error',
          HttpStatus.SERVICE_UNAVAILABLE
        )
      );
    });

    it('should handle network timeout error', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'Timeout exceeded',
        // No response object for network timeouts
      });

      await expect(provider.placeOrder(validOrderRequest)).rejects.toThrow(
        new HttpException(
          'Failed to communicate with broker. Please try again.',
          HttpStatus.SERVICE_UNAVAILABLE
        )
      );
    });

    it('should retry on network error and succeed on second attempt', async () => {
      // First call fails with network error (no response object)
      mockAxiosInstance.post
        .mockRejectedValueOnce({
          isAxiosError: true,
          code: 'ECONNABORTED',
          message: 'Timeout exceeded',
          // No response for network timeout
        })
        .mockResolvedValueOnce({
          data: {
            stat: 'Ok',
            nOrdNo: '240125000123459',
            stCode: 200,
            message: 'Order placed successfully',
          },
        });

      const result = await provider.placeOrder(validOrderRequest);

      expect(result.success).toBe(true);
      expect(result.brokerOrderId).toBe('240125000123459');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });

    it('should retry on authentication error after token refresh', async () => {
      // First call returns 401
      mockAxiosInstance.post.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
        message: 'Request failed with status code 401',
      });

      // Token refresh call (via static axios.post)
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: { token: 'new-session-token' },
      });

      // Retry succeeds
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          stat: 'Ok',
          nOrdNo: '240125000123460',
          stCode: 200,
          message: 'Order placed successfully',
        },
      });

      const result = await provider.placeOrder(validOrderRequest);

      expect(result.success).toBe(true);
      expect(result.brokerOrderId).toBe('240125000123460');
      // Called twice: original (401) + retry after refresh
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('getOrderStatus', () => {
    const brokerOrderId = '240125000123456';

    it('should successfully fetch order status for COMPLETE order', async () => {
      const mockResponse = {
        data: {
          data: {
            orderId: brokerOrderId,
            tradingSymbol: 'RELIANCE',
            transactionType: 'BUY',
            quantity: 10,
            filledQuantity: 10,
            orderPrice: 2460.5,
            averagePrice: 2460.75,
            orderStatus: 'COMPLETE',
            orderType: 'LIMIT',
            productType: 'CNC',
            orderTimestamp: '2024-01-25T10:30:15Z',
            statusMessage: 'Order executed successfully',
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await provider.getOrderStatus(brokerOrderId);

      expect(result.brokerOrderId).toBe(brokerOrderId);
      expect(result.symbol).toBe('RELIANCE');
      expect(result.action).toBe('BUY');
      expect(result.quantity).toBe(10);
      expect(result.filledQuantity).toBe(10);
      expect(result.status).toBe('COMPLETE');
      expect(result.averagePrice).toBe(2460.75);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/Orders/2.0/quick/order/info', {
        params: { ono: brokerOrderId },
      });
    });

    it('should successfully fetch order status for PENDING order', async () => {
      const mockResponse = {
        data: {
          data: {
            orderId: brokerOrderId,
            tradingSymbol: 'RELIANCE',
            transactionType: 'BUY',
            quantity: 10,
            filledQuantity: 0,
            orderPrice: 2460.5,
            orderStatus: 'PENDING',
            orderType: 'LIMIT',
            productType: 'CNC',
            orderTimestamp: '2024-01-25T10:30:15Z',
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await provider.getOrderStatus(brokerOrderId);

      expect(result.status).toBe('OPEN');
      expect(result.filledQuantity).toBe(0);
    });

    it('should successfully fetch order status for REJECTED order', async () => {
      const mockResponse = {
        data: {
          data: {
            orderId: brokerOrderId,
            tradingSymbol: 'RELIANCE',
            transactionType: 'BUY',
            quantity: 10,
            filledQuantity: 0,
            orderPrice: 2460.5,
            orderStatus: 'REJECTED',
            orderType: 'LIMIT',
            productType: 'CNC',
            orderTimestamp: '2024-01-25T10:30:15Z',
            statusMessage: 'Insufficient funds',
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await provider.getOrderStatus(brokerOrderId);

      expect(result.status).toBe('REJECTED');
      expect(result.statusMessage).toBe('Insufficient funds');
    });

    it('should throw error for empty broker order ID', async () => {
      await expect(provider.getOrderStatus('')).rejects.toThrow(
        new HttpException('Invalid broker order ID', HttpStatus.BAD_REQUEST)
      );

      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    it('should handle broker authentication error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 401,
          data: { message: 'Invalid credentials' },
        },
        message: 'Request failed with status code 401',
      });

      await expect(provider.getOrderStatus(brokerOrderId)).rejects.toThrow(
        new HttpException(
          'Kotak Neo authentication failed. Check API credentials.',
          HttpStatus.UNAUTHORIZED
        )
      );
    });

    it('should handle order not found error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 404,
          data: { message: 'Order not found' },
        },
        message: 'Request failed with status code 404',
      });

      await expect(provider.getOrderStatus(brokerOrderId)).rejects.toThrow(HttpException);
    });

    it('should handle network error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        isAxiosError: true,
        code: 'ECONNABORTED',
        message: 'Timeout exceeded',
        // No response object for network errors
      });

      await expect(provider.getOrderStatus(brokerOrderId)).rejects.toThrow(
        new HttpException(
          'Failed to communicate with broker. Please try again.',
          HttpStatus.SERVICE_UNAVAILABLE
        )
      );
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages for broker validation errors', async () => {
      const validOrderRequest: PlaceOrderRequest = {
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2460.5,
        orderType: 'LIMIT',
        productType: 'CNC',
      };

      mockAxiosInstance.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 400,
          data: { message: 'Invalid trading symbol' },
        },
        message: 'Request failed with status code 400',
      });

      await expect(provider.placeOrder(validOrderRequest)).rejects.toThrow(
        new HttpException('Invalid order request: Invalid trading symbol', HttpStatus.BAD_REQUEST)
      );
    });
  });

  describe('Circuit Breaker', () => {
    const validOrderRequest: PlaceOrderRequest = {
      symbol: 'RELIANCE',
      action: 'BUY',
      quantity: 10,
      price: 2460.5,
      orderType: 'LIMIT',
      productType: 'CNC',
    };

    it('should track consecutive failures and open circuit after 5 failures', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
        message: 'Request failed with status code 500',
      });

      // Fail 5 times to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        try {
          await provider.placeOrder(validOrderRequest);
        } catch (error) {
          // Expected to fail
        }
      }

      // 6th request should fail with circuit breaker error
      try {
        await provider.placeOrder(validOrderRequest);
        fail('Expected circuit breaker error');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.message).toContain('Circuit breaker is OPEN');
        expect(httpError.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }

      // Check circuit breaker state
      const state = provider.getCircuitBreakerState();
      expect(state.state).toBe('OPEN');
      expect(state.failureCount).toBe(5);
    }, 30000); // Increase timeout to 30 seconds

    it('should allow requests again after 30s cooldown', async () => {
      // Reset circuit breaker first
      provider.resetCircuitBreaker();

      mockAxiosInstance.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
        message: 'Request failed with status code 500',
      });

      // Fail 5 times to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await provider.placeOrder(validOrderRequest);
        } catch (error) {
          // Expected to fail
        }
      }

      // Verify circuit is open
      expect(provider.getCircuitBreakerState().state).toBe('OPEN');

      // Mock time passing (30 seconds)
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 31000);

      // Next request should transition to HALF_OPEN
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          stat: 'Ok',
          nOrdNo: '240125000123456',
          stCode: 200,
          message: 'Order placed successfully',
        },
      });

      const result = await provider.placeOrder(validOrderRequest);
      expect(result.success).toBe(true);

      // Circuit should be closed after successful request in HALF_OPEN
      const state = provider.getCircuitBreakerState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);

      // Restore Date.now
      jest.spyOn(Date, 'now').mockRestore();
    }, 30000); // Increase timeout to 30 seconds

    it('should reset failure count after manual reset', async () => {
      // Reset circuit breaker first
      provider.resetCircuitBreaker();

      mockAxiosInstance.post.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
        message: 'Request failed with status code 500',
      });

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await provider.placeOrder(validOrderRequest);
        } catch (error) {
          // Expected to fail
        }
      }

      // Verify failure count
      expect(provider.getCircuitBreakerState().failureCount).toBe(3);

      // Reset circuit breaker
      provider.resetCircuitBreaker();

      // Verify state is reset
      const state = provider.getCircuitBreakerState();
      expect(state.state).toBe('CLOSED');
      expect(state.failureCount).toBe(0);
      expect(state.lastFailureTime).toBeNull();
    }, 15000); // Increase timeout to 15 seconds

    it('should not count successful requests towards failure threshold', async () => {
      // Reset circuit breaker first
      provider.resetCircuitBreaker();

      // First request succeeds
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          stat: 'Ok',
          nOrdNo: '240125000123456',
          stCode: 200,
          message: 'Order placed successfully',
        },
      });

      await provider.placeOrder(validOrderRequest);
      expect(provider.getCircuitBreakerState().failureCount).toBe(0);

      // Second request fails
      mockAxiosInstance.post.mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
        message: 'Request failed with status code 500',
      });

      try {
        await provider.placeOrder(validOrderRequest);
      } catch (error) {
        // Expected to fail
      }

      // After retry exhaustion, failure count should be 1
      expect(provider.getCircuitBreakerState().failureCount).toBe(1);

      // Third request succeeds - failure count should remain at 1
      // (only HALF_OPEN -> CLOSED resets count, not success in CLOSED state)
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          stat: 'Ok',
          nOrdNo: '240125000123457',
          stCode: 200,
          message: 'Order placed successfully',
        },
      });

      await provider.placeOrder(validOrderRequest);
      expect(provider.getCircuitBreakerState().failureCount).toBe(1);
    }, 15000);

    it('should apply circuit breaker to getOrderStatus as well', async () => {
      // Reset circuit breaker first
      provider.resetCircuitBreaker();

      const brokerOrderId = '240125000123456';

      mockAxiosInstance.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
        message: 'Request failed with status code 500',
      });

      // Fail 5 times to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await provider.getOrderStatus(brokerOrderId);
        } catch (error) {
          // Expected to fail
        }
      }

      // 6th request should fail with circuit breaker error
      try {
        await provider.getOrderStatus(brokerOrderId);
        fail('Expected circuit breaker error');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        const httpError = error as HttpException;
        expect(httpError.message).toContain('Circuit breaker is OPEN');
        expect(httpError.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      }

      expect(provider.getCircuitBreakerState().state).toBe('OPEN');
    });
  });
});
