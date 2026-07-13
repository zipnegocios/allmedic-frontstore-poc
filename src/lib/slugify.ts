/**
 * Genera un slug simple (minúsculas, separado por guiones) a partir de un
 * texto libre. Se usa para autogenerar el slug de un registro (grupo de
 * sets, marca) a partir de su nombre mientras el usuario no lo haya editado
 * manualmente.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
