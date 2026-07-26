import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Kite Connect Authentication Controller
 *
 * Implements the Zerodha Kite Connect login flow:
 * 1. GET /api/kite/login-url → Returns the Kite login URL
 * 2. GET /api/kite/callback → Handles redirect from Zerodha, exchanges request_token for access_token
 * 3. GET /api/kite/status → Returns current session status
 *
 * The access_token is stored in a local file for the quant engine's backfill service to use.
 */

const KITE_LOGIN_URL = 'https://kite.zerodha.com/connect/login';
const KITE_API_BASE = 'https://api.kite.trade';
const TOKEN_FILE = path.join(__dirname, '..', '..', '.kite-token.json');

interface KiteSession {
  accessToken: string;
  apiKey: string;
  userId?: string;
  userName?: string;
  createdAt: string;
}

@SkipThrottle()
@Controller('kite')
export class KiteConnectAuthController {
  private readonly logger = new Logger(KiteConnectAuthController.name);
  private session: KiteSession | null = null;

  constructor(private readonly configService: ConfigService) {
    // Load existing token from disk on startup
    this.loadTokenFromDisk();
  }

  /**
   * GET /api/kite/login-url
   *
   * Returns the Zerodha Kite Connect login URL for the user to authenticate.
   */
  @Get('login-url')
  getLoginUrl() {
    const apiKey = this.configService.get<string>('KITE_API_KEY');
    if (!apiKey) {
      throw new HttpException('KITE_API_KEY not configured', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const redirectUrl = this.configService.get<string>(
      'KITE_REDIRECT_URI',
      'http://localhost:4000/api/kite/callback',
    );

    const loginUrl = `${KITE_LOGIN_URL}?v=3&api_key=${apiKey}&redirect_url=${encodeURIComponent(redirectUrl)}`;

    this.logger.log(`Generated Kite login URL`);
    return { loginUrl };
  }

  /**
   * GET /api/kite/callback
   *
   * Callback URL that Zerodha redirects to after successful login.
   * Exchanges the request_token for an access_token.
   */
  @Get('callback')
  async handleCallback(
    @Query('request_token') requestToken: string,
    @Query('status') status: string,
    @Res() res: Response,
  ) {
    if (status !== 'success' || !requestToken) {
      this.logger.warn(`Kite callback failed: status=${status}`);
      return res.redirect('http://localhost:3000?kite=failed');
    }

    const apiKey = this.configService.get<string>('KITE_API_KEY');
    const apiSecret = this.configService.get<string>('KITE_API_SECRET');

    if (!apiKey || !apiSecret) {
      this.logger.error('KITE_API_KEY or KITE_API_SECRET not configured');
      return res.redirect('http://localhost:3000?kite=error');
    }

    try {
      // Compute checksum: SHA256(api_key + request_token + api_secret)
      const checksum = crypto
        .createHash('sha256')
        .update(`${apiKey}${requestToken}${apiSecret}`)
        .digest('hex');

      // Exchange request_token for access_token
      const response = await axios.post(`${KITE_API_BASE}/session/token`, null, {
        params: {
          api_key: apiKey,
          request_token: requestToken,
          checksum,
        },
        headers: {
          'X-Kite-Version': '3',
        },
      });

      const data = response.data?.data;
      if (!data?.access_token) {
        throw new Error('No access_token in response');
      }

      // Store the session
      this.session = {
        accessToken: data.access_token,
        apiKey,
        userId: data.user_id,
        userName: data.user_name,
        createdAt: new Date().toISOString(),
      };

      // Persist to disk for quant engine backfill service
      this.saveTokenToDisk();

      this.logger.log(
        `Kite login successful: user=${data.user_name || data.user_id}`,
      );

      // Redirect back to frontend with success
      return res.redirect('http://localhost:3000?kite=success');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      this.logger.error(`Kite token exchange failed: ${msg}`);
      return res.redirect(`http://localhost:3000?kite=error&message=${encodeURIComponent(msg)}`);
    }
  }

  /**
   * POST /api/kite/complete-login
   *
   * SPA-friendly login completion (for when the frontend handles the redirect).
   */
  @Post('complete-login')
  async completeLogin(@Body() body: { request_token: string }) {
    const { request_token: requestToken } = body;
    if (!requestToken) {
      throw new HttpException('request_token required', HttpStatus.BAD_REQUEST);
    }

    const apiKey = this.configService.get<string>('KITE_API_KEY');
    const apiSecret = this.configService.get<string>('KITE_API_SECRET');

    if (!apiKey || !apiSecret) {
      throw new HttpException(
        'KITE_API_KEY or KITE_API_SECRET not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Compute checksum
    const checksum = crypto
      .createHash('sha256')
      .update(`${apiKey}${requestToken}${apiSecret}`)
      .digest('hex');

    try {
      const response = await axios.post(`${KITE_API_BASE}/session/token`, null, {
        params: {
          api_key: apiKey,
          request_token: requestToken,
          checksum,
        },
        headers: {
          'X-Kite-Version': '3',
        },
      });

      const data = response.data?.data;
      if (!data?.access_token) {
        throw new Error('No access_token in response');
      }

      this.session = {
        accessToken: data.access_token,
        apiKey,
        userId: data.user_id,
        userName: data.user_name,
        createdAt: new Date().toISOString(),
      };

      this.saveTokenToDisk();

      this.logger.log(
        `Kite login (SPA) successful: user=${data.user_name || data.user_id}`,
      );

      return {
        success: true,
        userId: data.user_id,
        userName: data.user_name,
      };
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message;
      this.logger.error(`Kite token exchange failed: ${msg}`);
      throw new HttpException(msg || 'Token exchange failed', HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * GET /api/kite/status
   *
   * Returns current Kite session status and whether the backfill service can use it.
   */
  @Get('status')
  getStatus() {
    return {
      connected: !!this.session,
      userId: this.session?.userId || null,
      userName: this.session?.userName || null,
      createdAt: this.session?.createdAt || null,
      tokenFile: TOKEN_FILE,
    };
  }

  /**
   * GET /api/kite/access-token
   *
   * Returns the access token for internal services (quant engine backfill).
   * Not exposed externally in production.
   */
  @Get('access-token')
  getAccessToken() {
    if (!this.session) {
      throw new HttpException('No active Kite session. Login first.', HttpStatus.UNAUTHORIZED);
    }
    return {
      accessToken: this.session.accessToken,
      apiKey: this.session.apiKey,
    };
  }

  // --- Private helpers ---

  private saveTokenToDisk(): void {
    if (!this.session) return;
    try {
      fs.writeFileSync(
        TOKEN_FILE,
        JSON.stringify({
          access_token: this.session.accessToken,
          api_key: this.session.apiKey,
          user_id: this.session.userId,
          created_at: this.session.createdAt,
        }),
        'utf-8',
      );
      this.logger.log(`Kite token saved to ${TOKEN_FILE}`);
    } catch (error) {
      this.logger.warn(`Failed to save Kite token to disk: ${error}`);
    }
  }

  private loadTokenFromDisk(): void {
    try {
      if (fs.existsSync(TOKEN_FILE)) {
        const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
        if (data.access_token && data.api_key) {
          this.session = {
            accessToken: data.access_token,
            apiKey: data.api_key,
            userId: data.user_id,
            createdAt: data.created_at,
          };
          this.logger.log(`Loaded Kite token from disk (user: ${data.user_id || 'unknown'})`);
        }
      }
    } catch {
      // Silently ignore — no persisted token
    }
  }
}
