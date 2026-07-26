import {
  Controller, Get, Post, Body, Headers, Query, Res,
  Logger, HttpException, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '../config/config.service';
import { KotakSessionStore } from './kotak-neo-session.store';
import axios from 'axios';

/**
 * Kotak Neo Trade API — Full BFF Proxy Controller.
 *
 * Implements the complete Backend-for-Frontend pattern:
 * - TOTP Login → View Token
 * - MPIN Validate → Trade Session Token + baseUrl
 * - Session store with opaque sessionId
 * - All order/report/portfolio/quotes proxy routes
 *
 * Frontend uses X-Session-Id header for authenticated calls.
 * Sensitive broker tokens never reach the browser.
 */

const TOTP_LOGIN_URL = 'https://mis.kotaksecurities.com/login/1.0/tradeApiLogin';
const MPIN_VALIDATE_URL = 'https://mis.kotaksecurities.com/login/1.0/tradeApiValidate';
const NEO_FIN_KEY = 'neotradeapi';

@SkipThrottle()
@Controller('kotak-neo')
export class KotakNeoAuthController {
  private readonly logger = new Logger(KotakNeoAuthController.name);

  // Temporary view token storage between Step 1 and Step 2
  private viewToken: string | null = null;
  private viewSid: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly sessionStore: KotakSessionStore,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // AUTH: Login Flow
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/kotak-neo/login
   * Opens Kotak Neo trading portal in browser.
   */
  @Get('login')
  loginRedirect(@Res() res: Response) {
    return res.redirect('https://trade.kotakneo.com/Landing');
  }

  /**
   * POST /api/kotak-neo/login/totp
   * Step 1: TOTP Login → returns viewToken + viewSid
   *
   * Body: { mobileNumber, ucc, totp }
   * Header: Authorization: Bearer <access_token> (optional, uses env if missing)
   */
  @Post('login/totp')
  async totpLogin(
    @Body() body: { mobileNumber: string; ucc: string; totp: string },
    @Headers('authorization') authHeader?: string,
  ) {
    const accessToken = this.extractAccessToken(authHeader);

    if (!accessToken) {
      throw new HttpException(
        'Access token required. Set KOTAK_NEO_ACCESS_TOKEN in .env or pass Authorization header.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!body.mobileNumber || !body.ucc || !body.totp) {
      throw new HttpException('mobileNumber, ucc, and totp are required.', HttpStatus.BAD_REQUEST);
    }

    try {
      const response = await axios.post(
        TOTP_LOGIN_URL,
        { mobileNumber: body.mobileNumber, ucc: body.ucc, totp: body.totp },
        {
          headers: {
            'Authorization': accessToken,
            'neo-fin-key': NEO_FIN_KEY,
            'Content-Type': 'application/json',
          },
        },
      );

      const data = response.data?.data || response.data;

      if (data?.token && data?.sid) {
        this.viewToken = data.token;
        this.viewSid = data.sid;
        this.logger.log(`TOTP login success. User: ${data.greetingName || body.ucc}`);

        return {
          message: 'Success',
          data: { token: data.token, sid: data.sid, greetingName: data.greetingName },
        };
      }

      throw new HttpException(data?.message || 'TOTP login failed', HttpStatus.UNAUTHORIZED);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      const msg = error.response?.data?.message || error.message;
      this.logger.error(`TOTP login failed: ${msg}`);
      throw new HttpException(msg || 'TOTP login failed', HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * POST /api/kotak-neo/login/mpin
   * Step 2: MPIN Validate → returns sessionId + baseUrl
   *
   * Body: { mpin }
   * Headers: sid, auth (optional — uses stored view tokens if omitted)
   */
  @Post('login/mpin')
  async mpinValidate(
    @Body() body: { mpin: string },
    @Headers('authorization') authHeader?: string,
    @Headers('sid') headerSid?: string,
    @Headers('auth') headerAuth?: string,
  ) {
    const accessToken = this.extractAccessToken(authHeader);
    const vToken = headerAuth || this.viewToken;
    const vSid = headerSid || this.viewSid;

    if (!accessToken) {
      throw new HttpException('Access token required.', HttpStatus.UNAUTHORIZED);
    }
    if (!vToken || !vSid) {
      throw new HttpException('Complete Step 1 (TOTP login) first.', HttpStatus.BAD_REQUEST);
    }
    if (!body.mpin) {
      throw new HttpException('mpin is required.', HttpStatus.BAD_REQUEST);
    }

    try {
      const response = await axios.post(
        MPIN_VALIDATE_URL,
        { mpin: body.mpin },
        {
          headers: {
            'Authorization': accessToken,
            'neo-fin-key': NEO_FIN_KEY,
            'sid': vSid,
            'Auth': vToken,
            'Content-Type': 'application/json',
          },
        },
      );

      const data = response.data?.data || response.data;

      if (data?.token && data?.sid && data?.baseUrl) {
        // Log the full response for debugging
        this.logger.log(`MPIN response kType: ${data.kType}, token length: ${data.token?.length}, sid: ${data.sid?.substring(0, 8)}...`);
        
        // Store session securely — return opaque sessionId to frontend
        const sessionId = this.sessionStore.create(data.token, data.sid, data.baseUrl, {
          dataCenter: data.dataCenter,
          greetingName: data.greetingName,
        });

        // Clear temporary view tokens
        this.viewToken = null;
        this.viewSid = null;

        this.logger.log(`MPIN validated. Session: ${sessionId}, baseUrl: ${data.baseUrl}`);

        return {
          sessionId,
          baseUrl: data.baseUrl,
          greetingName: data.greetingName,
        };
      }

      throw new HttpException(data?.message || 'MPIN validation failed', HttpStatus.UNAUTHORIZED);
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      const msg = error.response?.data?.message || error.message;
      this.logger.error(`MPIN validate failed: ${msg}`);
      throw new HttpException(msg || 'MPIN validation failed', HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * GET /api/kotak-neo/status
   */
  @Get('status')
  getStatus() {
    const session = this.sessionStore.getLatest();
    return {
      connected: !!session,
      greetingName: session?.greetingName || null,
      baseUrl: session?.baseUrl || null,
      dataCenter: session?.dataCenter || null,
    };
  }

  /**
   * GET /api/kotak-neo/logout
   */
  @Get('logout')
  logout(@Headers('x-session-id') sessionId?: string) {
    if (sessionId) {
      this.sessionStore.delete(sessionId);
    }
    // Also clear any view tokens
    this.viewToken = null;
    this.viewSid = null;
    return { success: true, message: 'Session cleared.' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ORDERS: Place, Modify, Cancel
  // ─────────────────────────────────────────────────────────────────────────

  /** POST /api/kotak-neo/orders/place */
  @Post('orders/place')
  async placeOrder(@Headers('x-session-id') sessionId: string, @Body() body: any) {
    return this.postForm(sessionId, '/quick/order/rule/ms/place', body);
  }

  /** POST /api/kotak-neo/orders/modify */
  @Post('orders/modify')
  async modifyOrder(@Headers('x-session-id') sessionId: string, @Body() body: any) {
    return this.postForm(sessionId, '/quick/order/vr/modify', body);
  }

  /** POST /api/kotak-neo/orders/cancel */
  @Post('orders/cancel')
  async cancelOrder(@Headers('x-session-id') sessionId: string, @Body() body: any) {
    return this.postForm(sessionId, '/quick/order/cancel', body);
  }

  /** POST /api/kotak-neo/orders/exit-cover */
  @Post('orders/exit-cover')
  async exitCover(@Headers('x-session-id') sessionId: string, @Body() body: any) {
    return this.postForm(sessionId, '/quick/order/co/exit', body);
  }

  /** POST /api/kotak-neo/orders/exit-bracket */
  @Post('orders/exit-bracket')
  async exitBracket(@Headers('x-session-id') sessionId: string, @Body() body: any) {
    return this.postForm(sessionId, '/quick/order/bo/exit', body);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REPORTS: Orders, Trades, Positions, Holdings
  // ─────────────────────────────────────────────────────────────────────────

  /** GET /api/kotak-neo/reports/orders */
  @Get('reports/orders')
  async getOrders(@Headers('x-session-id') sessionId: string) {
    return this.proxyGet(sessionId, '/quick/user/orders');
  }

  /** POST /api/kotak-neo/reports/order-history */
  @Post('reports/order-history')
  async getOrderHistory(@Headers('x-session-id') sessionId: string, @Body() body: any) {
    return this.postForm(sessionId, '/quick/order/history', body);
  }

  /** GET /api/kotak-neo/reports/trades */
  @Get('reports/trades')
  async getTrades(@Headers('x-session-id') sessionId: string) {
    return this.proxyGet(sessionId, '/quick/user/trades');
  }

  /** GET /api/kotak-neo/reports/positions */
  @Get('reports/positions')
  async getPositions(@Headers('x-session-id') sessionId: string) {
    return this.proxyGet(sessionId, '/quick/user/positions');
  }

  /** GET /api/kotak-neo/reports/holdings */
  @Get('reports/holdings')
  async getHoldings(@Headers('x-session-id') sessionId: string) {
    return this.proxyGet(sessionId, '/portfolio/v1/holdings');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FUNDS: Limits, Margins
  // ─────────────────────────────────────────────────────────────────────────

  /** POST /api/kotak-neo/funds/limits */
  @Post('funds/limits')
  async getLimits(@Headers('x-session-id') sessionId: string, @Body() body: any) {
    const jData = body?.jData || { seg: 'ALL', exch: 'ALL', prod: 'ALL' };
    return this.postForm(sessionId, '/quick/user/limits', { jData });
  }

  /** POST /api/kotak-neo/funds/margins */
  @Post('funds/margins')
  async checkMargin(@Headers('x-session-id') sessionId: string, @Body() body: any) {
    return this.postForm(sessionId, '/quick/user/check-margin', body);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUOTES & SCRIPMASTER (use access token, no session needed)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * GET /api/kotak-neo/quotes?baseUrl=&exchangeSegment=&symbol=&filter=
   */
  @Get('quotes')
  async getQuotes(
    @Query('baseUrl') baseUrl: string,
    @Query('exchangeSegment') exchangeSegment: string,
    @Query('symbol') symbol: string,
    @Query('filter') filter?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const accessToken = this.extractAccessToken(authHeader);
    if (!accessToken) {
      throw new HttpException('Access token required for quotes.', HttpStatus.UNAUTHORIZED);
    }

    // Use session baseUrl if not provided in query
    const url = baseUrl || this.sessionStore.getLatest()?.baseUrl;
    if (!url) {
      throw new HttpException('baseUrl required. Login first or pass as query param.', HttpStatus.BAD_REQUEST);
    }

    const filterPath = filter || 'all';
    const endpoint = `${url}/script-details/1.0/quotes/neosymbol/${exchangeSegment}|${symbol}/${filterPath}`;

    try {
      const response = await axios.get(endpoint, {
        headers: { 'Authorization': accessToken, 'Content-Type': 'application/json' },
      });
      return response.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || error.message,
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * GET /api/kotak-neo/scripmaster/file-paths?baseUrl=
   */
  @Get('scripmaster/file-paths')
  async getScripmaster(
    @Query('baseUrl') baseUrl?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const accessToken = this.extractAccessToken(authHeader);
    if (!accessToken) {
      throw new HttpException('Access token required.', HttpStatus.UNAUTHORIZED);
    }

    const url = baseUrl || this.sessionStore.getLatest()?.baseUrl;
    if (!url) {
      throw new HttpException('baseUrl required.', HttpStatus.BAD_REQUEST);
    }

    try {
      const response = await axios.get(`${url}/script-details/1.0/masterscrip/file-paths`, {
        headers: { 'Authorization': accessToken },
      });
      return response.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data || error.message,
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Proxy a GET request to Kotak, injecting Auth/Sid/neo-fin-key headers.
   */
  private async proxyGet(sessionId: string, path: string) {
    const session = this.resolveSession(sessionId);
    const url = `${session.baseUrl}${path}`;

    try {
      const response = await axios.get(url, {
        headers: {
          'Auth': session.auth,
          'Sid': session.sid,
          'neo-fin-key': NEO_FIN_KEY,
          'accept': 'application/json',
        },
      });
      return response.data;
    } catch (error: any) {
      const errData = error.response?.data;
      const errStatus = error.response?.status;
      this.logger.error(`Kotak GET error [${errStatus}]: ${JSON.stringify(errData)}`);
      throw new HttpException(
        errData || { message: error.message },
        errStatus || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Proxy a POST request with jData form encoding to Kotak.
   */
  private async postForm(sessionId: string, path: string, body: any) {
    const session = this.resolveSession(sessionId);
    const url = `${session.baseUrl}${path}`;

    // Kotak expects: Content-Type: application/x-www-form-urlencoded
    // with body: jData=<stringified JSON>
    const jData = typeof body === 'string' ? body : JSON.stringify(body?.jData || body);

    this.logger.log(`POST ${url} | jData=${jData.substring(0, 200)}`);

    try {
      // curl --data-urlencode 'jData={...}' sends: jData={"am":"NO",...}
      // The JSON value itself is NOT percent-encoded in the body
      const formBody = 'jData=' + jData;

      const response = await axios({
        method: 'POST',
        url,
        data: formBody,
        headers: {
          'accept': 'application/json',
          'Sid': session.sid,
          'Auth': session.auth,
          'neo-fin-key': NEO_FIN_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      this.logger.log(`Kotak response: ${JSON.stringify(response.data).substring(0, 200)}`);
      return response.data;
    } catch (error: any) {
      const errData = error.response?.data;
      const errStatus = error.response?.status;
      this.logger.error(`Kotak API error [${errStatus}]: ${JSON.stringify(errData)}`);
      // Return Kotak's actual error to the frontend
      throw new HttpException(
        errData || { message: error.message, status: errStatus },
        errStatus || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Resolve session from X-Session-Id header.
   * Falls back to latest session if header is missing/invalid.
   */
  private resolveSession(sessionId: string) {
    if (sessionId) {
      const session = this.sessionStore.get(sessionId);
      if (session) return session;
    }
    // Fallback: use the latest session (single-user local app)
    const latest = this.sessionStore.getLatest();
    if (latest) return latest;

    throw new HttpException('No active Kotak session. Login first.', HttpStatus.UNAUTHORIZED);
  }

  /**
   * Extract access token from Authorization header or env config.
   * Strips "Bearer " prefix if present.
   */
  private extractAccessToken(authHeader?: string): string | null {
    if (authHeader) {
      return authHeader.replace(/^Bearer\s+/i, '');
    }
    return this.configService.kotakNeoAccessToken || this.configService.kotakApiKey || null;
  }
}
