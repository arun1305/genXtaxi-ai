import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser, JwtPayload, Role } from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';

/** Validates the shared gen-taxi-backend JWT ({ id, role, ... }; no issuer). */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<AppEnv, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: [config.get('JWT_ALGORITHM', { infer: true })],
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    const userId = payload?.id ?? payload?.sub;
    if (!userId || !Object.values(Role).includes(payload.role)) {
      throw new UnauthorizedException('Invalid token');
    }
    return {
      userId,
      role: payload.role,
      cityZone: payload.city_zone,
      preferredLang: payload.preferred_lang,
    };
  }
}
