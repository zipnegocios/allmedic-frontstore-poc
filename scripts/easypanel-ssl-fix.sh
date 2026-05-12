#!/bin/bash
# =============================================================================
# Script de diagnóstico y fix para SSL en EasyPanel
# Ejecutar en el servidor via SSH
# =============================================================================

echo "=== EasyPanel SSL Diagnostic ==="
echo ""

# 1. Verificar que el contenedor está corriendo
echo "1. Contenedores activos:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(allmedic|frontstore|nginx)"
echo ""

# 2. Verificar logs del contenedor
echo "2. Logs recientes del contenedor:"
docker logs --tail 20 allmedic-frontstore 2>/dev/null || echo "Contenedor no encontrado"
echo ""

# 3. Verificar que el servicio responde internamente
echo "3. Test interno al contenedor (puerto 3000):"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/api/health 2>/dev/null || echo "No responde en :3000"
echo ""

# 4. Verificar configuración de Nginx (EasyPanel proxy)
echo "4. Configuración de Nginx para el dominio:"
NGINX_CONF="/etc/easypanel/nginx/conf.d/frontstore.allmedicuniforms.com.conf"
if [ -f "$NGINX_CONF" ]; then
    echo "✓ Configuración encontrada:"
    grep -E "(server_name|listen|proxy_pass|ssl_certificate)" "$NGINX_CONF" | head -10
else
    echo "✗ No se encontró configuración de Nginx"
    echo "Buscando archivos relacionados:"
    find /etc/easypanel/nginx -name "*allmedic*" -o -name "*frontstore*" 2>/dev/null
fi
echo ""

# 5. Verificar certificados SSL
echo "5. Certificados SSL:"
CERT_DIR="/etc/easypanel/nginx/certs"
if [ -d "$CERT_DIR" ]; then
    ls -la "$CERT_DIR" | grep -E "(allmedic|frontstore)" || echo "No hay certificados para el dominio"
else
    echo "Directorio de certificados no encontrado"
fi
echo ""

# 6. Verificar que el dominio resuelve correctamente
echo "6. Resolución DNS:"
dig +short frontstore.allmedicuniforms.com 2>/dev/null || nslookup frontstore.allmedicuniforms.com 2>/dev/null | grep -A2 "Name:" || echo "No se pudo resolver el dominio"
echo ""

echo "=== Fin del diagnóstico ==="
echo ""
echo "Si el certificado SSL no existe, ejecuta en EasyPanel:"
echo "  Services → allmedic-frontstore → Domains → Add Domain"
echo "  Ingresa: frontstore.allmedicuniforms.com"
echo "  Marca: SSL (Let's Encrypt)"
echo ""
echo "Si el certificado existe pero no funciona, prueba reiniciar Nginx:"
echo "  docker restart easypanel-nginx 2>/dev/null || systemctl restart nginx 2>/dev/null"
