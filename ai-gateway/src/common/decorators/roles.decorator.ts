import { SetMetadata } from '@nestjs/common';
import { Role } from '@genxtaxi/ai-shared';

export const ROLES_KEY = 'roles';
/** Restrict a route to one or more roles (spec §1: enforce role scoping server-side). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
