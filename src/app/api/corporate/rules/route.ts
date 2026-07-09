import { NextResponse } from 'next/server';
import { getAllBusinessRules } from '@/lib/corporate-data-service';

/**
 * GET /api/corporate/rules
 * Reglas de negocio activas — público, usado por el cliente para previsualizar
 * validaciones del carrito corporativo. El servidor SIEMPRE re-valida al enviar
 * la solicitud; esto es solo para dar feedback inmediato en la UI.
 */
export async function GET() {
  try {
    const rules = await getAllBusinessRules();
    return NextResponse.json({ rules });
  } catch {
    return NextResponse.json({ rules: [] });
  }
}
