import { Role } from './roles.enum';

/**
 * Claims propagated from the existing gen-taxi-backend JWT (spec §1 Auth &
 * tenancy). The live token shape is { id, role, sessionId, jti }. We read `id`
 * (falling back to `sub` for forward-compat). The gateway NEVER trusts the
 * client-declared role for tool execution — it is re-checked server-side.
 */
export interface JwtPayload {
  /** GenXTaxi user id (gen-taxi-backend emits `id`). */
  id?: string;
  /** Standard subject claim — accepted as a fallback for `id`. */
  sub?: string;
  role: Role;
  /** Auth session id from gen-taxi-backend. */
  sessionId?: string;
  jti?: string;
  /** City / operating zone (may be absent until the core token adds it). */
  city_zone?: string;
  /** Preferred language persisted per user (spec §1 Multilingual). */
  preferred_lang?: 'fr' | 'ar' | 'en' | string;
  iat?: number;
  exp?: number;
}

/** Normalized principal attached to the request after auth. */
export interface AuthenticatedUser {
  userId: string;
  role: Role;
  cityZone?: string;
  preferredLang?: string;
}
