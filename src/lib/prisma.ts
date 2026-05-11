import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

// Función para construir la URL de forma segura
const getDatabaseUrl = () => {
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const database = process.env.DB_NAME;

  // Construcción manual del string de conexión
  return `mysql://${user}:${password}@${host}:${port}/${database}`;
};

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    datasources: { db: { url: getDatabaseUrl() } },
  });
} else {
  const globalForPrisma = global as unknown as { prisma: PrismaClient };
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasources: { db: { url: getDatabaseUrl() } },
    });
  }
  prisma = globalForPrisma.prisma;
}

export { prisma };