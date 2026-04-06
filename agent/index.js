/**
 * Agente local — Leitor Biométrico TechMag
 *
 * Este script roda no Windows, lê eventos do leitor USB TechMag
 * e envia para a API do sistema de ponto.
 *
 * CONFIGURACAO:
 *   1. Ajuste SERVER_URL abaixo para o endereço do servidor EasyPanel
 *   2. Ajuste VENDOR_ID e PRODUCT_ID conforme o Device Manager do Windows
 *      (Gerenciador de Dispositivos → ID de hardware do leitor)
 *   3. npm install && node index.js
 *
 * COMO FUNCIONA:
 *   - O leitor TechMag, ao reconhecer uma digital, envia via USB/HID
 *     um pacote com o ID do funcionário cadastrado no leitor.
 *   - O agente lê esse ID (fingerprint_id) e envia para POST /api/clock/event.
 *   - O servidor mapeia o fingerprint_id para o funcionário e registra o ponto.
 *
 * CADASTRO DE DIGITAIS:
 *   - Use o software próprio da TechMag para cadastrar as digitais no leitor,
 *     atribuindo IDs numéricos (1, 2, 3...).
 *   - No sistema web, cadastre cada funcionário com o mesmo ID (campo "ID da digital").
 */

const HID  = require('node-hid');
const fetch = require('node-fetch');

// ===================== CONFIGURACAO =====================
const SERVER_URL  = process.env.SERVER_URL  || 'http://localhost';   // URL do servidor
const VENDOR_ID   = parseInt(process.env.VENDOR_ID  || '0x0000', 16); // VID do leitor (ver Device Manager)
const PRODUCT_ID  = parseInt(process.env.PRODUCT_ID || '0x0000', 16); // PID do leitor
const POLL_MS     = 50; // intervalo de leitura em ms
// ========================================================

let device;

function connect() {
  try {
    // Lista dispositivos HID disponíveis para debug
    const devices = HID.devices();
    console.log('[INFO] Dispositivos HID detectados:');
    devices.forEach(d => console.log(`  VID=${d.vendorId.toString(16).padStart(4,'0')} PID=${d.productId.toString(16).padStart(4,'0')} - ${d.product || 'sem nome'}`));

    device = new HID.HID(VENDOR_ID, PRODUCT_ID);
    console.log(`[OK] Leitor TechMag conectado (VID:${VENDOR_ID.toString(16)} PID:${PRODUCT_ID.toString(16)})`);

    device.on('data', async (data) => {
      // ---------------------------------------------------------------
      // ADAPTE AQUI: interprete o pacote de dados do seu modelo TechMag.
      // Exemplo genérico: primeiro byte é o fingerprint_id.
      // Consulte o datasheet/SDK da TechMag para o formato exato.
      // ---------------------------------------------------------------
      const fingerprintId = parsePacket(data);
      if (fingerprintId === null) return;

      console.log(`[EVENTO] Digital detectada — fingerprint_id=${fingerprintId}`);
      await sendEvent(fingerprintId);
    });

    device.on('error', (err) => {
      console.error('[ERRO] Leitor desconectado:', err.message);
      device = null;
      setTimeout(connect, 3000); // reconecta após 3s
    });
  } catch (err) {
    console.error('[ERRO] Não foi possível conectar ao leitor:', err.message);
    console.log('[INFO] Verifique VENDOR_ID e PRODUCT_ID no topo do arquivo.');
    setTimeout(connect, 5000);
  }
}

/**
 * Interpreta o pacote HID e retorna o fingerprint_id (int) ou null se inválido.
 * ADAPTE esta função conforme o protocolo do seu modelo TechMag.
 */
function parsePacket(data) {
  // Ignorar pacotes vazios ou de keep-alive
  if (!data || data.length === 0) return null;
  if (data.every(b => b === 0)) return null; // pacote zerado

  // Exemplo: pacote começa com 0xAA e o ID está no byte 2
  // if (data[0] === 0xAA) return data[2];

  // Implementação genérica: primeiro byte não-zero como ID
  const id = data[0];
  return id > 0 ? id : null;
}

async function sendEvent(fingerprintId) {
  try {
    const res = await fetch(`${SERVER_URL}/api/clock/event`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fingerprint_id: fingerprintId }),
    });
    const json = await res.json();
    if (res.ok) {
      console.log(`[OK] ${json.type === 'entry' ? 'ENTRADA' : 'SAIDA'} registrada — ${json.employee}`);
    } else {
      console.error('[ERRO API]', json.error);
    }
  } catch (err) {
    console.error('[ERRO] Falha ao enviar para o servidor:', err.message);
  }
}

console.log('=== Agente de Ponto TechMag iniciado ===');
console.log(`Servidor: ${SERVER_URL}`);
connect();
