/**
 * Validación estructural de RUC de Ecuador (13 dígitos).
 * Verifica: longitud, solo dígitos, código de provincia (01-24 o 30 para exterior),
 * tercer dígito válido según tipo de contribuyente, y código de establecimiento >= 001.
 * No implementa el algoritmo módulo 11 completo — es una validación de formato,
 * suficiente para el registro corporativo (la verificación fiscal real la hace ventas).
 */
export function isValidEcuadorRUC(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) return false;

  const province = parseInt(ruc.slice(0, 2), 10);
  if (!((province >= 1 && province <= 24) || province === 30)) return false;

  const thirdDigit = parseInt(ruc[2], 10);
  // 0-5: persona natural | 6: entidad pública | 9: sociedad privada/extranjera
  const validThirdDigit = thirdDigit <= 6 || thirdDigit === 9;
  if (!validThirdDigit) return false;

  const establishment = parseInt(ruc.slice(10, 13), 10);
  if (establishment < 1) return false;

  return true;
}
