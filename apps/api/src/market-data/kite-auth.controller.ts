import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '../config/config.service';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * Kite Connect OAuth Authentication Controller.
 *
 * Flow:
 * 1. GET /api/kite/login → redirects user to Kite login page
 * 2. User logs in → Kite redirects to GET /api/kite/callback?request_token=xxx&status=success
 * 3. Backend exchanges request_token for access_token
 * 4. access_token stored in memory for API calls
 */
@Controller('kite')
export class KiteAuthController {
  private readonly logger = new Logger(KiteAuthController.name);
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * GET /api/kite/login
   * Redirects the user to the Kite Connect login page.
   */
  @Get('login')
  login(@Res() res: Response) {
    const apiKey = this.configService.kiteApiKey;
    if (!apiKey) {
      return res.status(500).json({ error: 'KITE_API_KEY not configured' });
    }

    const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}`;
    this.logger.log(`Redirecting to Kite login: ${loginUrl}`);
    return res.redirect(loginUrl);
  }

  /**
   * GET /api/kite/callback
   * Handles the OAuth callback from Kite Connect.
   * Exchanges request_token for access_token.
   */
  @Get('callback')
  async callback(
    @Query('request_token') requestToken: string,
    @Query('status') status: string,
    @Res() res: Response,
  ) {
    if (status !== 'success' || !requestToken) {
      this.logger.error(`Kite callback failed: status=${status}, request_token=${requestToken}`);
      return res.status(400).json({
        error: 'Kite login failed',
        status,
        message: 'User denied access or login failed.',
      });
    }

    const apiKey = this.configService.kiteApiKey;
    const apiSecret = this.configService.kiteApiSecret;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'KITE_API_KEY or KITE_API_SECRET not configured' });
    }

    try {
      // Generate checksum: SHA-256 of (api_key + request_token + api_secret)
      const checksum = crypto
        .createHash('sha256')
        .update(apiKey + requestToken + apiSecret)
        .digest('hex');

      // Exchange request_token for access_token
      const response = await axios.post('https://api.kite.trade/session/token', null, {
        params: {
          api_key: apiKey,
          request_token: requestToken,
          checksum,
        },
        headers: {
          'X-Kite-Version': '3',
        },
      });

      const data = response.data;

      if (data.status === 'success' && data.data?.access_token) {
        this.accessToken = data.data.access_token;
        // Token valid until next trading day 6 AM
        this.tokenExpiresAt = new Date();
        this.tokenExpiresAt.setHours(30, 0, 0, 0); // Next day 6 AM approx

        this.logger.log(`Kite access token obtained successfully. User: ${data.data.user_id}`);

        // Redirect to frontend with success
        return res.redirect('http://localhost:3000/?kite=connected');
      } else {
        this.logger.error(`Kite token exchange failed: ${JSON.stringify(data)}`);
        return res.status(401).json({
          error: 'Token exchange failed',
          detail: data,
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data || error.message;
      this.logger.error(`Kite token exchange error: ${JSON.stringify(errorMsg)}`);
      return res.status(500).json({
        error: 'Failed to exchange token',
        detail: errorMsg,
      });
    }
  }

  /**
   * GET /api/kite/status
   * Returns the current Kite connection status.
   */
  @Get('status')
  getStatus() {
    const connected = !!this.accessToken;
    return {
      connected,
      expiresAt: this.tokenExpiresAt?.toISOString() || null,
      apiKey: this.configService.kiteApiKey ? '***configured***' : null,
    };
  }

  /**
   * GET /api/kite/logout
   * Invalidates the stored access token.
   */
  @Get('logout')
  logout() {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    this.logger.log('Kite session logged out');
    return { success: true, message: 'Kite session cleared' };
  }

  /**
   * Get the current access token (for use by other services).
   */
  getAccessToken(): string | null {
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }
    return null;
  }
}
