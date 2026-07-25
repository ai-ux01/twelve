import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * ThrottlerExceptionFilter - Custom exception filter for rate limiting
 *
 * This filter catches ThrottlerException (429 status) and adds:
 * - Retry-After header indicating when client can retry
 * - Structured error response
 *
 * The Retry-After header value is set to 60 seconds (the TTL window)
 * to indicate when the rate limit will reset.
 *
 * Requirements covered: 8.1, 20.1
 */
@Catch(HttpException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ThrottlerExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();

    // Only handle rate limit errors (429)
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      const retryAfterSeconds = 60; // Match the TTL window (60 seconds)

      this.logger.warn(
        `Rate limit exceeded for ${request.method} ${request.url} - ` +
          `Retry after ${retryAfterSeconds} seconds`
      );

      response.status(status).header('Retry-After', retryAfterSeconds.toString()).json({
        statusCode: status,
        message: 'Rate limit exceeded. Too many requests.',
        error: 'Too Many Requests',
        retryAfter: retryAfterSeconds,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    } else {
      // For non-rate-limit errors, use default behavior
      response.status(status).json({
        statusCode: status,
        message: exception.message,
        error: exception.name,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }
}
