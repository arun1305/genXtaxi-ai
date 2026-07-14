import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Standard JWT guard for admin-only mutations. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
