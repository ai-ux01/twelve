import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * RateLimitLoggerInterceptor - Logs all rate limit violations
 *
 * This interceptor catches ThrottlerException errors (429 status codes)
 * and logs them for monitoring and security analysis.
 *
 * Requirements covered: 8.1, 20.1
 */
@Injectable()
export class RateLimitLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RateLimitLoggerInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // Check if this is a rate limit violation (429 status)
        if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
          const request = context.switchToHttp().getRequest();
          const ip = request.ip || request.connection.remoteAddress;
          const userId = request.user?.id || 'anonymous';
          const endpoint = `${request.method} ${request.url}`;

          // Log the rate limit violation
          this.logger.warn(
            `Rate limit violation - User: ${userId}, IP: ${ip}, Endpoint: ${endpoint}, ` +
              `Time: ${new Date().toISOString()}`
          );
        }

        // Re-throw the error to be handled by exception filters
        return throwError(() => error);
      })
    );
  }
}
