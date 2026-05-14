import type { CartItem } from './types';

export interface WhatsAppMessageData {
  items: CartItem[];
  customerName: string;
  customerCity: string;
  customerPhone?: string;
  totalItems?: number;
  subtotal?: number;
  discountPct?: number;
  discountAmount?: number;
  total?: number;
}

export interface LeadRegistrationResult {
  success: boolean;
  leadId: string;
  totals: {
    totalItems: number;
    subtotal: number;
    discountPct: number;
    discountAmount: number;
    total: number;
  };
}

export function generateWhatsAppMessage(data: WhatsAppMessageData): string {
  const { items, customerName, customerCity, customerPhone } = data;
  
  let message = 'Hola AllMedic 👋, quiero cotizar:\n\n';
  
  items.forEach((item, index) => {
    message += `${index + 1}. *${item.name} (${item.sku})*\n`;
    message += `   Color: ${item.color.name} | Talla: ${item.size}${item.fit ? ` (${item.fit})` : ''} | Cantidad: ${item.quantity}\n\n`;
  });
  
  message += `*Mis datos:*\n`;
  message += `Nombre: ${customerName}\n`;
  message += `Ciudad: ${customerCity}\n`;
  if (customerPhone) {
    message += `WhatsApp: ${customerPhone}\n`;
  }

  if (data.total !== undefined) {
    message += `\n*Resumen:*\n`;
    message += `Items: ${data.totalItems ?? items.reduce((sum, item) => sum + item.quantity, 0)}\n`;
    if (data.subtotal !== undefined) {
      message += `Subtotal: $${data.subtotal.toFixed(2)}\n`;
    }
    if (data.discountPct && data.discountAmount !== undefined) {
      message += `Descuento (${data.discountPct}%): -$${data.discountAmount.toFixed(2)}\n`;
    }
    message += `Total estimado: $${data.total.toFixed(2)}`;
  }
  
  return message;
}

export function openWhatsApp(message: string): void {
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/13164695701?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
}

export async function registerLead(data: WhatsAppMessageData): Promise<LeadRegistrationResult> {
  const response = await fetch('/api/leads', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerName: data.customerName,
      customerCity: data.customerCity,
      customerPhone: data.customerPhone,
      items: data.items,
      totalItems: data.totalItems,
      subtotal: data.subtotal,
      discountPct: data.discountPct,
      discountAmount: data.discountAmount,
      total: data.total,
    }),
  });

  if (!response.ok) {
    let errorMessage = 'No pudimos registrar tu cotización. Inténtalo nuevamente.';
    try {
      const payload = await response.json() as { error?: string };
      if (payload.error) errorMessage = payload.error;
    } catch {
      // Si la respuesta no es JSON, mantenemos el mensaje genérico para el cliente.
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<LeadRegistrationResult>;
}
