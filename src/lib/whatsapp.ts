import type { CartItem } from './types';

export interface WhatsAppMessageData {
  items: CartItem[];
  customerName: string;
  customerCity: string;
  customerPhone?: string;
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
    message += `WhatsApp: ${customerPhone}`;
  }
  
  return message;
}

export function openWhatsApp(message: string): void {
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/13164695701?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
}

export async function registerLead(data: WhatsAppMessageData): Promise<void> {
  // Mock API call - en producción esto enviaría los datos al backend
  console.log('Registrando lead:', data);
  return new Promise(resolve => setTimeout(resolve, 500));
}
