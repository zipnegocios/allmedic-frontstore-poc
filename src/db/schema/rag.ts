import { pgTable, text, integer, timestamp, vector, index, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { uuid } from "@/lib/uuid";
import { products } from "./products";

export const productDocuments = pgTable("product_documents", {
  id: text("id").primaryKey().$defaultFn(() => uuid()),
  productId: text("product_id").references(() => products.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  content: text("content"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const productDocumentsRelations = relations(productDocuments, ({ one, many }) => ({
  product: one(products, { fields: [productDocuments.productId], references: [products.id] }),
  embeddings: many(productEmbeddings),
}));

export const productEmbeddings = pgTable("product_embeddings", {
  id: text("id").primaryKey().$defaultFn(() => uuid()),
  documentId: text("document_id").notNull().references(() => productDocuments.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
}, (table) => [
  index("idx_embeddings_document").on(table.documentId),
  index("idx_embeddings_vector").using("hnsw", table.embedding.op("vector_cosine_ops")),
]);

export const productEmbeddingsRelations = relations(productEmbeddings, ({ one }) => ({
  document: one(productDocuments, { fields: [productEmbeddings.documentId], references: [productDocuments.id] }),
}));
