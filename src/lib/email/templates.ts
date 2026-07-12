// ─── Plantillas de correo en español (equipo AllMedic + clientes corporativos) ───

const BASE_STYLE = `font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; color: #111111;`;
const HEADER_STYLE = `background: #111111; color: #fff; padding: 24px; text-align: center;`;
const BODY_STYLE = `padding: 24px; background: #fff;`;
const FOOTER_STYLE = `padding: 16px 24px; color: #999; font-size: 12px; text-align: center;`;

function wrap(title: string, bodyHtml: string): string {
  return `
    <div style="${BASE_STYLE}">
      <div style="${HEADER_STYLE}"><h1 style="margin:0;font-size:20px;">${title}</h1></div>
      <div style="${BODY_STYLE}">${bodyHtml}</div>
      <div style="${FOOTER_STYLE}">AllMedic Uniforms — Uniformes médicos de alta calidad</div>
    </div>
  `;
}

export function newQuoteRequestEmail(params: {
  code: string;
  razonSocial: string;
  contactName: string;
  totalSets: number;
  referenceTotal: number;
}): { subject: string; html: string } {
  const { code, razonSocial, contactName, totalSets, referenceTotal } = params;
  return {
    subject: `Nueva solicitud de cotización — ${code}`,
    html: wrap(
      'Nueva Solicitud de Cotización',
      `
        <p>Se recibió una nueva solicitud de cotización corporativa.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:4px 0;color:#666;">Código:</td><td style="padding:4px 0;font-weight:bold;">${code}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Empresa:</td><td style="padding:4px 0;">${razonSocial}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Contacto:</td><td style="padding:4px 0;">${contactName}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Sets totales:</td><td style="padding:4px 0;">${totalSets}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Total referencial:</td><td style="padding:4px 0;font-weight:bold;">$${referenceTotal.toFixed(2)}</td></tr>
        </table>
        <p>Revisa los detalles en el panel de administración.</p>
      `
    ),
  };
}

export function newRegistrationEmail(params: {
  razonSocial: string;
  contactName: string;
  ruc: string;
  email: string;
}): { subject: string; html: string } {
  const { razonSocial, contactName, ruc, email } = params;
  return {
    subject: `Nuevo registro corporativo pendiente de aprobación — ${razonSocial}`,
    html: wrap(
      'Nuevo Registro Corporativo',
      `
        <p>Una nueva empresa se registró y está pendiente de aprobación.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:4px 0;color:#666;">Razón Social:</td><td style="padding:4px 0;font-weight:bold;">${razonSocial}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">RUC:</td><td style="padding:4px 0;">${ruc}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Contacto:</td><td style="padding:4px 0;">${contactName}</td></tr>
          <tr><td style="padding:4px 0;color:#666;">Correo:</td><td style="padding:4px 0;">${email}</td></tr>
        </table>
        <p>Revisa y aprueba la cuenta en el panel de administración.</p>
      `
    ),
  };
}

export function accountApprovedEmail(params: { contactName: string; razonSocial: string }): {
  subject: string;
  html: string;
} {
  const { contactName, razonSocial } = params;
  return {
    subject: 'Tu cuenta corporativa fue aprobada — AllMedic Uniforms',
    html: wrap(
      '¡Cuenta Aprobada!',
      `
        <p>Hola ${contactName},</p>
        <p>Tu cuenta corporativa para <strong>${razonSocial}</strong> ha sido aprobada. Ya puedes iniciar sesión y acceder a tu portal de cliente para ver tus solicitudes de cotización.</p>
      `
    ),
  };
}

export function accountRejectedEmail(params: { contactName: string; razonSocial: string }): {
  subject: string;
  html: string;
} {
  const { contactName, razonSocial } = params;
  return {
    subject: 'Actualización sobre tu registro corporativo — AllMedic Uniforms',
    html: wrap(
      'Registro Corporativo',
      `
        <p>Hola ${contactName},</p>
        <p>Lamentablemente no pudimos aprobar el registro de <strong>${razonSocial}</strong> en este momento. Si crees que se trata de un error, contáctanos.</p>
      `
    ),
  };
}

const QUOTE_STATUS_MESSAGES: Record<string, string> = {
  IN_REVIEW: 'Tu solicitud está siendo revisada por nuestro equipo de ventas.',
  QUOTED: 'Ya tenemos una cotización lista para ti. Revisa los detalles en tu portal.',
  SENT: 'Te hemos enviado la cotización formal.',
  APPROVED: '¡Tu cotización fue aprobada! Nuestro equipo se pondrá en contacto para coordinar la entrega.',
  REJECTED: 'Tu solicitud de cotización no pudo ser procesada. Contáctanos para más detalles.',
  CLOSED: 'Tu solicitud ha sido cerrada.',
};

export function quoteStatusChangedEmail(params: { contactName: string; code: string; newStatus: string }): {
  subject: string;
  html: string;
} {
  const { contactName, code, newStatus } = params;
  return {
    subject: `Actualización de tu cotización ${code} — AllMedic Uniforms`,
    html: wrap(
      'Actualización de tu Cotización',
      `
        <p>Hola ${contactName},</p>
        <p>${QUOTE_STATUS_MESSAGES[newStatus] ?? 'El estado de tu solicitud cambió.'}</p>
        <p>Código de solicitud: <strong>${code}</strong></p>
      `
    ),
  };
}
