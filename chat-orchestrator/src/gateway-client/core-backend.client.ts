import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppEnv } from '../config/env.validation';

export interface CoreResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Client for the live gen-taxi-backend (Express). Forwards the CALLER's JWT so
 * the backend's existing owner/role checks apply unchanged (spec §1) — the
 * orchestrator introduces no new trust boundary for owner-scoped tools.
 */
@Injectable()
export class CoreBackendClient {
  private readonly logger = new Logger(CoreBackendClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService<AppEnv, true>) {
    this.baseUrl = config.get('GEN_TAXI_BACKEND_URL', { infer: true });
  }

  async request<T = unknown>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    token: string,
    body?: unknown,
  ): Promise<CoreResult<T>> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => undefined);
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: (json as { message?: string })?.message ?? `HTTP ${res.status}`,
        };
      }
      // gen-taxi-backend wraps payloads as { success, data, message }
      const data = (json as { data?: T })?.data ?? (json as T);
      return { ok: true, status: res.status, data };
    } catch (err) {
      this.logger.error(`core call ${method} ${path} failed: ${(err as Error).message}`);
      return { ok: false, status: 503, error: 'core backend unavailable' };
    }
  }
}
