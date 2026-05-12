import { NextResponse } from 'next/server';

/**
 * GET /api/health
 * Healthcheck simple para Docker/EasyPanel.
 * Solo verifica que el servidor HTTP responda.
 * La DB se verifica en runtime via fallback a dummy data.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
