/// <reference types="astro/client" />

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
  all<T>(): Promise<{ results: T[] }>;
};

type D1Database = {
  prepare(query: string): D1Statement;
  batch<T = unknown>(statements: D1Statement[]): Promise<T[]>;
};
type KVNamespace = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

type Env = {
  DB: D1Database;
  RATE_LIMIT?: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_WEBHOOK_ID: string;
  PAYPAL_ENVIRONMENT: 'sandbox' | 'live';
  SESSION_SECRET: string;
  TOKEN_ENCRYPTION_KEY: string;
  APP_URL: string;
};

declare namespace App {
  interface Locals {
    runtime: { env: Env };
    user?: { id: string; email: string; role: 'user' | 'admin' };
  }
}
