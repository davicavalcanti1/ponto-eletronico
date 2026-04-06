/**
 * Agente local — Leitor Biométrico TechMag
 *
 * CONFIGURAÇÃO:
 *   1. Ajuste SERVER_URL para o endereço do servidor (EasyPanel)
 *   2. Ajuste VENDOR_ID e PRODUCT_ID com os valores do seu leitor
 *      (veja no Gerenciador de Dispositivos > ID de Hardware)
 *   3. npm install && node index.js
 *
 * COMO FUNCIONA:
 *   - Modo normal: ao reconhecer uma digital, o leitor envia um ID via HID.
 *     O agente envia esse ID para POST /api/clock/event → ponto registrado.
 *
 *   - Modo cadastro: quando você clica em "Cadastrar digital" no sistema web,
 *     o agente detecta o pedido pendente e aguarda a próxima leitura do leitor.
 *     O ID capturado é enviado para POST /api/enrollment/complete e vinculado
 *     ao funcionário automaticamente.
 *
 * ADAPTAÇÃO DO PROTOCOLO:
 *   Edite a função parsePacket() para extrair o fingerprint_id corretamente
 *   conforme o datasheet do seu modelo TechMag.
 */

const HID   = require('node-hid');
const fetch = require('node-fetch');

// ======================== CONFIGURAÇÃO ========================
const SERVER_URL = process.env.SERVER_URL  || 'http://localhost';
const VENDOR_ID  = parseInt(process.env.VENDOR_ID  || '0x0000', 16);
const PRODUCT_ID = parseInt(process.env.PRODUCT_ID || '0x0000', 16);
const ENROLL_POLL_MS = 3000; // intervalo de polling para cadastro pendente
// ==============================================================

let device         = null;
let enrollMode     = null; // { employee_id, employee_name } quando em modo cadastro
let lastEventMs    = 0;
const DEBOUNCE_MS  = 2000; // evita duplo registro por uma mesma passada

// ─── Conexão com o leitor ─────────────────────────────────────────────────────

function connect() {
  try {
    const devices = HID.devices();
    console.log('\n[INFO] Dispositivos HID detectados:');
    devices.forEach(d =>
      console.log(`  VID=0x${d.vendorId.toString(16).padStart(4,'0')} PID=0x${d.productId.toString(16).padStart(4,'0')} — ${d.product || '(sem nome)'}`)
    );

    device = new HID.HID(VENDOR_ID, PRODUCT_ID);
    console.log(`\n[OK] Leitor conectado (VID:0x${VENDOR_ID.toString(16)} PID:0x${PRODUCT_ID.toString(16)})\n`);

    device.on('data', onData);
    device.on('error', (err) => {
      console.error('[ERRO] Leitor desconectado:', err.message);
      device = null;
      setTimeout(connect, 3000);
    });
  } catch (err) {
    console.error('[ERRO] Não conectou ao leitor:', err.message);
    console.log('[INFO] Verifique VENDOR_ID e PRODUCT_ID. Tentando novamente em 5s...\n');
    setTimeout(connect, 5000);
  }
}

// ─── Interpretação do pacote HID ─────────────────────────────────────────────

/**
 * Extrai o fingerprint_id do pacote de dados do leitor.
 * ADAPTE conforme o protocolo do seu modelo TechMag.
 *
 * Retorna um inteiro (ID do usuário no leitor) ou null se não reconhecido.
 */
function parsePacket(data) {
  if (!data || data.length === 0) return null;
  if (data.every(b => b === 0)) return null; // keep-alive / pacote vazio

  // --- Exemplos comuns (descomente o que se aplicar ao seu modelo): ---

  // Protocolo simples: byte 0 = ID do usuário
  // return data[0] > 0 ? data[0] : null;

  // Protocolo com header: 0xAA + 0x55 nos bytes 0-1, ID nos bytes 2-3 (uint16 BE)
  // if (data[0] === 0xAA && data[1] === 0x55) return (data[2] << 8) | data[3];

  // Fallback genérico: usa primeiro byte não-zero
  const id = data.find(b => b > 0);
  return id != null ? id : null;
}

// ─── Handler de dados recebidos do leitor ────────────────────────────────────

async function onData(data) {
  const now = Date.now();
  if (now - lastEventMs < DEBOUNCE_MS) return; // debounce

  const fingerprintId = parsePacket(data);
  if (fingerprintId === null) return;

  lastEventMs = now;

  if (enrollMode) {
    // Modo cadastro: vincula essa digital ao funcionário pendente
    console.log(`[CADASTRO] Digital capturada (ID=${fingerprintId}) → vinculando a ${enrollMode.employee_name}`);
    await completeEnrollment(enrollMode.employee_id, fingerprintId);
    enrollMode = null;
  } else {
    // Modo normal: registra ponto
    console.log(`[PONTO] Digital detectada — ID=${fingerprintId}`);
    await sendClockEvent(fingerprintId);
  }
}

// ─── Clock event ─────────────────────────────────────────────────────────────

async function sendClockEvent(fingerprintId) {
  try {
    const res  = await fetch(`${SERVER_URL}/api/clock/event`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fingerprint_id: fingerprintId }),
    });
    const json = await res.json();
    if (res.ok) {
      const label = json.type === 'entry' ? 'ENTRADA' : 'SAÍDA';
      console.log(`[OK] ${label} — ${json.employee}`);
    } else {
      console.warn(`[AVISO] ${json.error}`);
    }
  } catch (err) {
    console.error('[ERRO] Falha ao enviar ponto:', err.message);
  }
}

// ─── Enrollment ──────────────────────────────────────────────────────────────

async function pollEnrollment() {
  if (enrollMode) return; // já estamos em modo cadastro
  try {
    const res  = await fetch(`${SERVER_URL}/api/enrollment/pending`);
    const json = await res.json();
    if (json && json.employee_id) {
      enrollMode = { employee_id: json.employee_id, employee_name: json.employee_name };
      console.log(`\n[CADASTRO] Iniciando cadastro de digital para: ${json.employee_name}`);
      console.log('[CADASTRO] Peça para a pessoa colocar o dedo no leitor...\n');
    }
  } catch {
    // servidor indisponível — silencioso
  }
}

async function completeEnrollment(employeeId, fingerprintId) {
  try {
    const res  = await fetch(`${SERVER_URL}/api/enrollment/complete`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ employee_id: employeeId, fingerprint_id: fingerprintId }),
    });
    const json = await res.json();
    if (res.ok) {
      console.log(`[OK] Digital cadastrada — ${json.employee} (ID=${json.fingerprint_id})\n`);
    } else {
      console.error('[ERRO CADASTRO]', json.error);
      // Notifica o servidor que falhou para limpar o pending
      await fetch(`${SERVER_URL}/api/enrollment/failed`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ employee_id: employeeId }),
      });
    }
  } catch (err) {
    console.error('[ERRO] Falha ao completar cadastro:', err.message);
  }
}

// ─── Start ───────────────────────────────────────────────────────────────────

console.log('=== Agente de Ponto TechMag ===');
console.log(`Servidor: ${SERVER_URL}\n`);

connect();
setInterval(pollEnrollment, ENROLL_POLL_MS);
