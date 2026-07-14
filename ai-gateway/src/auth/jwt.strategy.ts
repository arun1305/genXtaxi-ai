import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  AuthenticatedUser,
  JwtPayload,
  Role,
} from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';

/**
 * Validates the SAME JWT issued by gen-taxi-backend (spec §1 Auth & tenancy).
 * We only trust the signed claims; the role is re-verified server-side before
 * any tool execution (never trust client role claims).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<AppEnv, true>) {
    // gen-taxi-backend signs without an `issuer` claim, so we do not enforce one.
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: [config.get('JWT_ALGORITHM', { infer: true })],
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    const userId = payload?.id ?? payload?.sub;
    if (!userId || !payload?.role) {
      throw new UnauthorizedException('Malformed token: missing id/role');
    }
    if (!Object.values(Role).includes(payload.role)) {
      throw new UnauthorizedException(`Unknown role: ${payload.role}`);
    }
    return {
      userId,
      role: payload.role,
      cityZone: payload.city_zone,
      preferredLang: payload.preferred_lang,
    };
  }
}
