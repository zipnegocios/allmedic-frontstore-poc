// Re-export all schema modules
export * from "./auth";
export * from "./products";
export * from "./commerce";
export * from "./corporate";
export * from "./chats";
// NOTA TEMPORAL: rag.ts excluido de db:push porque el servidor Postgres
// no tiene disponible la extensión pgvector (CREATE EXTENSION vector falla).
// Ver .claude/scripts/enable-pgvector.mjs. Restaurar cuando el servidor
// tenga pgvector instalado.
// export * from "./rag";
