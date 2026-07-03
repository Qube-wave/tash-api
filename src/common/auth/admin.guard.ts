import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from './authenticated-user';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';
import { UserType } from '../../users/entities/user.entity';

interface AuthenticatedRequest {
  user?: AuthenticatedUser;
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.userTypes.includes(UserType.Admin) !== true) {
      throw new AppException(
        ErrorCode.AccountSuspended,
        'Admin access is required for this operation.',
        403,
      );
    }

    return true;
  }
}
