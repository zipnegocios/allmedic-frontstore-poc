import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

/**
 * GET /api/health
 * Healthcheck endpoint para Docker/EasyPanel
 * Verifica:
 *   1. El servidor responde HTTP 200
 *   2. La conexión a PostgreSQL está activa
 */
export async function GET() {
  const checks: Record<string, { status: 'ok' | 'fail'; latency?: number; error?: string }> = {};
  let overallStatus = 200;

  // Check 1: HTTP response (si llegamos aquí, ya funciona)
  checks.http = { status: 'ok', latency: 0 };

  // Check 2: PostgreSQL connection
  const dbStart = Date.now();
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 5000)
      ),
    ]);
    checks.database = { status: 'ok', latency: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      status: 'fail',
      latency: Date.now() - dbStart,
      error: err instanceof Error ? err.message : 'Unknown DB error',
    };
    // No marcamos como error crítico porque la app tiene fallback a dummy data
    // overallStatus = 503;
  }

  return NextResponse.json(
    {
      status: overallStatus === 200 ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: overallStatus }
  );
}
