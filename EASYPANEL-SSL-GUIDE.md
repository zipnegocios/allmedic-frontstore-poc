# Guía: Solucionar Error SSL en EasyPanel

## Error: `ERR_CERT_AUTHORITY_INVALID`

Este error aparece cuando el navegador no confía en el certificado SSL del sitio. En EasyPanel, esto suele ocurrir cuando:

1. **No se generó el certificado Let's Encrypt**
2. **EasyPanel sirve un certificado self-signed por defecto**
3. **El dominio personalizado no está configurado en EasyPanel**

---

## Solución Paso a Paso

### Paso 1: Verificar que el dominio apunta al servidor

En tu proveedor de dominio (donde compraste `allmedicuniforms.com`), verifica el DNS:

```
Tipo: A
Nombre: frontstore
Valor: 31.220.56.1   ← IP de tu servidor EasyPanel
TTL: 3600
```

**Para verificar:**
```bash
# Desde tu computadora
nslookup frontstore.allmedicuniforms.com
# Debería devolver: 31.220.56.1
```

---

### Paso 2: Configurar el dominio en EasyPanel

1. Ve a **EasyPanel → Services → allmedic-frontstore**
2. Click en la pestaña **Domains**
3. Click en **Add Domain**
4. Completa:
   - **Domain:** `frontstore.allmedicuniforms.com`
   - **SSL:** ✅ Activar (Let's Encrypt)
   - **Force HTTPS:** ✅ Recomendado
5. Click **Save**

> **⚠️ Importante:** EasyPanel necesita que el dominio resuelva correctamente (Paso 1) para poder generar el certificado Let's Encrypt.

---

### Paso 3: Esperar la generación del certificado

Let's Encrypt tarda entre 30 segundos y 2 minutos en generar el certificado.

**Para verificar el estado:**
1. En EasyPanel → **Domains**, debería aparecer un ✅ verde junto al dominio
2. Si aparece ❌ rojo, click en **Renew Certificate**

---

### Paso 4: Verificar que el contenedor está healthy

En EasyPanel → **allmedic-frontstore**:
- El estado debe decir **Running** (verde)
- Si dice **Restarting** o **Unhealthy**, hay un problema con el healthcheck

**Para diagnosticar desde SSH:**
```bash
# Conectarte al servidor
ssh root@31.220.56.1

# Ver logs del contenedor
docker logs --tail 50 allmedic-frontstore

# Verificar que responde internamente
curl http://localhost:3000/api/health
```

---

### Paso 5: Reiniciar el proxy de Nginx (si el certificado existe pero no funciona)

```bash
# Desde SSH en el servidor
# Reiniciar el contenedor de Nginx de EasyPanel
docker restart easypanel-nginx 2>/dev/null || docker restart nginx 2>/dev/null

# O reiniciar el servicio de systemd
systemctl restart nginx 2>/dev/null
```

---

## Diagnóstico Rápido

Copia y pega este comando en la terminal SSH de tu servidor:

```bash
curl -s https://raw.githubusercontent.com/TU_USUARIO/allmedic-frontstore/main/scripts/easypanel-ssl-fix.sh | bash
```

O ejecuta manualmente:

```bash
# 1. Verificar contenedor
docker ps | grep allmedic

# 2. Verificar respuesta interna
curl -I http://localhost:3000/api/health

# 3. Verificar certificado
echo | openssl s_client -servername frontstore.allmedicuniforms.com -connect frontstore.allmedicuniforms.com:443 2>/dev/null | openssl x509 -noout -dates -subject
```

---

## Casos Comunes

### Caso A: EasyPanel generó certificado self-signed

**Síntoma:** El certificado dice "Issued by: EasyPanel" o "Kubernetes Ingress Controller Fake Certificate"

**Solución:**
1. Elimina el dominio de EasyPanel
2. Vuelve a añadirlo con **SSL: Let's Encrypt**
3. Espera 2 minutos y refresca

### Caso B: Let's Encrypt rate limit

**Síntoma:** Error "too many certificates already issued"

**Solución:** Espera 1 hora y vuelve a intentar. Let's Encrypt tiene límites de 50 certificados por dominio por semana.

### Caso C: El dominio no resuelve al servidor

**Síntoma:** `nslookup frontstore.allmedicuniforms.com` no devuelve la IP

**Solución:**
1. Verifica el DNS en tu proveedor de dominio
2. Espera a que propague (puede tardar hasta 24 horas, usualmente 5 minutos)
3. Usa `dig frontstore.allmedicuniforms.com` para verificar

---

## Configuración Final Recomendada

En EasyPanel, tu servicio debería verse así:

```
Service: allmedic-frontstore
  Status: Running ✅
  Port: 3000 (container) → 80/443 (host via Nginx proxy)
  
Domains:
  frontstore.allmedicuniforms.com ✅ SSL Active
  
Environment:
  NODE_ENV=production
  PORT=3000
  HOSTNAME=0.0.0.0
  DB_HOST=postgres
  DB_PORT=5432
  ... (resto de variables)
```

---

## Si Nada Funciona: Bypass Temporal

Mientras solucionas el SSL, puedes acceder al sitio:

1. **Usar HTTP en lugar de HTTPS:**
   ```
   http://frontstore.allmedicuniforms.com
   ```
   (EasyPanel debería redirigir automáticamente, pero si el certificado está roto, puede fallar)

2. **Usar la IP directamente (sin dominio):**
   ```
   http://31.220.56.1:3000
   ```
   Nota: Esto puede no funcionar si EasyPanel bloquea el acceso directo por IP.

3. **Aceptar el certificado self-signed (solo para testing):**
   - En Chrome: Click en "Advanced" → "Proceed to frontstore.allmedicuniforms.com (unsafe)"
   - **NO usar en producción**
