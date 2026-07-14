import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser, JwtPayload, Role } from '@genxtaxi/ai-shared';
import { AppEnv } from '../config/env.validation';

/**
 * Validates the SAME gen-taxi-backend JWT (payload shape { id, role, sessionId,
 * jti }; no issuer). We also stash the raw bearer token so tools can forward it
 * downstream for owner-scoped calls (spec §1 Auth & tenancy).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService<AppEnv, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: [config.get('JWT_ALGORITHM', { infer: true })],
      passReqToCallback: true,
    });
  }

  validate(req: { headers: Record<string, string> }, payload: JwtPayload): AuthenticatedUser & { token: string } {
    const userId = payload?.id ?? payload?.sub;
    if (!userId || !Object.values(Role).includes(payload.role)) {
      throw new UnauthorizedException('Invalid token');
    }
    const token = (req.headers['authorization'] ?? '').replace(/^Bearer\s+/i, '');
    return {
      userId,
      role: payload.role,
      cityZone: payload.city_zone,
      preferredLang: payload.preferred_lang,
      token,
    };
  }
}
