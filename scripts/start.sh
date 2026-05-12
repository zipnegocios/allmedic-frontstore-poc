#!/bin/sh
# =============================================================================
# AllMedic Frontstore — Entrypoint script
# Ejecuta migraciones de base de datos y luego inicia el servidor Next.js
# =============================================================================

set -e

echo "🔧 AllMedic Admin — Starting up..."

# Ejecutar migraciones de base de datos
# El script maneja internamente la conexión con DATABASE_URL o DB_* variables
echo "📦 Running database migrations..."
node scripts/migrate.js

# Iniciar el servidor Next.js
echo "🚀 Starting Next.js server..."
exec node server.js
