#!/usr/bin/env node
/**
 * WhatsApp Service Keep-Alive Monitor
 * 
 * Uso:
 *   node scripts/whatsapp-keep-alive.js
 * 
 * Este script monitorea el healthcheck del servicio de WhatsApp Web
 * y envía alertas si el servicio está caído o desconectado.
 * 
 * También puede ejecutarse como healthcheck dentro del contenedor Docker.
 */

const http = require('http');

const WA_SERVICE_HOST = process.env.WA_SERVICE_HOST || 'localhost';
const WA_SERVICE_PORT = process.env.WA_SERVICE_PORT || '8080';
const HEALTH_PATH = process.env.WA_HEALTH_PATH || '/health';
const CHECK_INTERVAL_MS = parseInt(process.env.WA_CHECK_INTERVAL || '30000', 10);
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK_URL; // Opcional: URL para alertas

let consecutiveFailures = 0;
const MAX_FAILURES = 3;

function log(level, msg) {
  console.log(`[${new Date().toISOString()}] [${level}] ${msg}`);
}

function checkHealth() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: WA_SERVICE_HOST,
      port: WA_SERVICE_PORT,
      path: HEALTH_PATH,
      method: 'GET',
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch {
            resolve({ status: 'unknown', raw: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

async function sendAlert(message) {
  log('ALERT', message);

  if (ALERT_WEBHOOK) {
    try {
      const payload = JSON.stringify({
        text: `🚨 *Allmedic WhatsApp Alert*\n${message}`,
        timestamp: new Date().toISOString(),
        service: 'whatsapp-web',
      });

      await new Promise((resolve, reject) => {
        const url = new URL(ALERT_WEBHOOK);
        const req = http.request({
          hostname: url.hostname,
          port: url.port || (url.protocol === 'https:' ? 443 : 80),
          path: url.pathname + url.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
          timeout: 10000,
        }, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`Webhook responded ${res.statusCode}`));
          }
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
      });

      log('ALERT', 'Notificación enviada exitosamente.');
    } catch (err) {
      log('ERROR', `No se pudo enviar alerta: ${err.message}`);
    }
  }
}

async function monitor() {
  try {
    const health = await checkHealth();
    log('INFO', `Estado: ${health.state || health.status} | QR: ${health.hasQr ? 'SÍ' : 'NO'}`);

    if (health.state === 'ready' || health.status === 'healthy') {
      consecutiveFailures = 0;
    } else if (health.state === 'disconnected' || health.state === 'qr_ready') {
      // Estado degradado pero no crítico
      log('WARN', `Servicio degradado: ${health.state}`);
    }
  } catch (err) {
    consecutiveFailures++;
    log('ERROR', `Healthcheck falló (${consecutiveFailures}/${MAX_FAILURES}): ${err.message}`);

    if (consecutiveFailures >= MAX_FAILURES) {
      await sendAlert(
        `El servicio de WhatsApp Web no responde después de ${MAX_FAILURES} intentos. ` +
        `Último error: ${err.message}`
      );
      consecutiveFailures = 0; // Reset para no spammear
    }
  }
}

// ─── Main ───
if (require.main === module) {
  log('INIT', `Monitoreando WhatsApp Service en ${WA_SERVICE_HOST}:${WA_SERVICE_PORT}${HEALTH_PATH}`);
  log('INIT', `Intervalo: ${CHECK_INTERVAL_MS}ms`);

  // Primera ejecución inmediata
  monitor();

  // Loop periódico
  setInterval(monitor, CHECK_INTERVAL_MS);
}

module.exports = { checkHealth, sendAlert };
