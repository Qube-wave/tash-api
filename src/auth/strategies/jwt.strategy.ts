import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  AuthenticatedUser,
  JwtAccessTokenPayload,
} from '../../common/auth/authenticated-user';
import { AuthConfiguration } from '../../config/auth.config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const auth = configService.getOrThrow<AuthConfiguration>('auth');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: auth.accessTokenSecret,
    });
  }

  validate(payload: JwtAccessTokenPayload): Promise<AuthenticatedUser> {
    return this.authService.validateAccessTokenUser(payload.sub);
  }
}
