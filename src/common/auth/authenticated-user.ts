import { UserStatus, UserType } from '../../users/entities/user.entity';

export interface AuthenticatedUser {
  id: number;
  uuid: string;
  email: string;
  status: UserStatus;
  userTypes: UserType[];
}

export interface JwtAccessTokenPayload {
  sub: string;
  email: string;
  typ: 'access';
}

export interface JwtRefreshTokenPayload {
  sub: string;
  email: string;
  jti: string;
  typ: 'refresh';
}
