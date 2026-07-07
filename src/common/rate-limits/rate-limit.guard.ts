import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';
import { selectRateLimitRule } from './rate-limit-policy';
import { SKIP_RATE_LIMIT_KEY } from './skip-rate-limit.decorator';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly records = new Map<string, RateLimitRecord>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skipRateLimit = this.reflector.getAllAndOverride<boolean>(
      SKIP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipRateLimit === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rule = selectRateLimitRule(
      request.method,
      request.originalUrl ?? request.url,
    );
    const now = Date.now();
    const key = `${rule.bucket}:${this.subjectFor(request)}`;
    const existing = this.records.get(key);

    if (existing === undefined || existing.resetAt <= now) {
      this.records.set(key, { count: 1, resetAt: now + rule.windowMs });
      this.cleanup(now);
      return true;
    }

    if (existing.count >= rule.limit) {
      throw new AppException(
        ErrorCode.RateLimitExceeded,
        'Too many requests. Please retry shortly.',
        429,
        {
          bucket: rule.bucket,
          retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
        },
      );
    }

    existing.count += 1;
    return true;
  }

  private subjectFor(request: AuthenticatedRequest): string {
    if (request.user !== undefined) {
      return `user:${request.user.id}`;
    }

    const merchantKey =
      request.header('x-tash-merchant-key') ?? request.header('authorization');
    if (merchantKey !== undefined && merchantKey.trim() !== '') {
      return `merchant:${this.stableKeySubject(merchantKey)}`;
    }

    return `ip:${request.ip ?? request.socket.remoteAddress ?? 'unknown'}`;
  }

  private stableKeySubject(value: string): string {
    return value.slice(0, 32);
  }

  private cleanup(now: number): void {
    if (this.records.size < 10_000) {
      return;
    }

    for (const [key, record] of this.records.entries()) {
      if (record.resetAt <= now) {
        this.records.delete(key);
      }
    }
  }
}
