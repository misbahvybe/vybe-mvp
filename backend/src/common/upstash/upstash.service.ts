import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';

/**
 * Upstash Redis (HTTP) — use for short-lived cache, rate-limit buckets, feed snapshots, etc.
 * If UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are unset, all methods no-op safely.
 */
@Injectable()
export class UpstashService implements OnModuleInit {
  private readonly log = new Logger(UpstashService.name);
  private client: Redis | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('UPSTASH_REDIS_REST_URL')?.trim();
    const token = this.config.get<string>('UPSTASH_REDIS_REST_TOKEN')?.trim();
    if (url && token) {
      this.client = new Redis({ url, token });
      this.log.log('Upstash Redis enabled');
    } else {
      this.log.warn('Upstash Redis not configured (cache calls are no-ops)');
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    const v = await this.client.get<string>(key);
    return v == null ? null : String(v);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /** TTL in seconds */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds != null && ttlSeconds > 0) {
      await this.client.set(key, value, { ex: ttlSeconds });
    } else {
      await this.client.set(key, value);
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }

  async delMany(keys: string[]): Promise<void> {
    if (!this.client || keys.length === 0) return;
    await this.client.del(...keys);
  }

  /**
   * Cache-aside helper: return cached JSON or compute, store, and return.
   */
  async wrapJson<T>(key: string, ttlSeconds: number, factory: () => Promise<T>): Promise<T> {
    const hit = await this.getJson<T>(key);
    if (hit != null) return hit;
    const fresh = await factory();
    await this.setJson(key, fresh, ttlSeconds);
    return fresh;
  }
}
