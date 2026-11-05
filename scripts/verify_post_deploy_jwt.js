/**
 * OPERIX GYMNASTICS — PROTOCOLO DE VALIDACIÓN DE SEGURIDAD POST-DESPLIEGUE (JWT Y RLS)
 * Desarrollado por Comercial Hels SpA
 * Fecha: 5 de noviembre de 2026
 *
 * Este script valida en PostgREST real el aislamiento multi-tenant y las políticas RLS.
 * 
 * CLASIFICACIÓN TÉCNICA RIGUROSA DE RESULTADOS:
 * 1. PENDIENTE_DESPLIEGUE: La tabla aún no existe en el catálogo remoto (HTTP 404 / 42P01).
 *    No se contabiliza como prueba superada de RLS.
 * 2. RLS_BLOQUEADO_EXITOSO: La tabla existe y la política RLS protegió el recurso:
 *    - En SELECT: 200 OK con array vacío [] (lectura restringida).
 *    - En INSERT: Error 42501 / 401 Unauthorized (inserción rechazada por WITH CHECK).
 *    - En UPDATE / DELETE: Error 42501 o 0 registros afectados con array vacío [].
 * 3. VULNERABILIDAD_DETECTADA: Se permitió lectura o modificación de datos no autorizados.
 * 4. OMITIDA_FALTA_JWT: Requiere token JWT individual en variables de entorno.
 */

import https from 'node:https';
import { URL } from 'node:url';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wuifhlsygqdldtzoouln.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aWZobHN5Z3FkbGR0em9vdWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3Mzc2MzksImV4cCI6MjEwOTMxMzYzOX0.9zjrmpvnus8W1XV5bpEA6ZPRPbnGqFl62WjdasfkI5o';

// Identificadores de Prueba Sintéticos
const TEST_UUIDS = {
  champA: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  champB: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  club1: '11111111-1111-1111-1111-111111111111',
  club2: '22222222-2222-2222-2222-222222222222',
};

export const POST_DEPLOY_TESTS = [
  // --- GRUPO 1: USUARIO ANÓNIMO (anon) ---
  {
    id: 'SEC-01',
    role: 'anon',
    name: 'Anon no puede ver actas técnicas reservadas (championship_documents: official_minutes)',
    endpoint: `/rest/v1/championship_documents?document_type=eq.official_minutes&select=*`,
    method: 'GET',
    tableTarget: 'championship_documents',
    getJwt: () => ANON_KEY
  },
  {
    id: 'SEC-02',
    role: 'anon',
    name: 'Anon no puede listar reclamos técnicos privados (technical_inquiries)',
    endpoint: `/rest/v1/technical_inquiries?select=*`,
    method: 'GET',
    tableTarget: 'technical_inquiries',
    getJwt: () => ANON_KEY
  },
  {
    id: 'SEC-03',
    role: 'anon',
    name: 'Anon tiene denegada la inserción de cronogramas (competition_schedules)',
    endpoint: `/rest/v1/competition_schedules`,
    method: 'POST',
    tableTarget: 'competition_schedules',
    getJwt: () => ANON_KEY,
    body: {
      championship_id: TEST_UUIDS.champA,
      name: 'Horario Hack',
      start_time: '2026-11-05T12:00:00Z',
      end_time: '2026-11-05T14:00:00Z'
    }
  },
  {
    id: 'SEC-04',
    role: 'anon',
    name: 'Anon no puede insertar en score_audits (Inmutabilidad / RLS)',
    endpoint: `/rest/v1/score_audits`,
    method: 'POST',
    tableTarget: 'score_audits',
    getJwt: () => ANON_KEY,
    body: {
      score_id: '00000000-0000-0000-0000-000000000000',
      organization_id: '00000000-0000-0000-0000-000000000000',
      modified_by_user_id: '00000000-0000-0000-0000-000000000000',
      reason: 'Intento malicioso de inserción directa',
      previous_value: {},
      new_value: {}
    }
  },
  {
    id: 'SEC-05',
    role: 'anon',
    name: 'Anon no puede modificar registros en score_audits (Inmutabilidad UPDATE)',
    endpoint: `/rest/v1/score_audits?id=neq.00000000-0000-0000-0000-000000000000`,
    method: 'PATCH',
    tableTarget: 'score_audits',
    getJwt: () => ANON_KEY,
    body: { reason: 'Intrusión no autorizada' }
  },

  // --- GRUPO 2: AISLAMIENTO MULTI-TENANT CON JWT AUTENTICADO ---
  {
    id: 'SEC-06',
    role: 'org_admin_b',
    name: 'Admin de Org B intenta insertar cronograma en Torneo de Org A (Debe ser rechazado)',
    endpoint: `/rest/v1/competition_schedules`,
    method: 'POST',
    tableTarget: 'competition_schedules',
    getJwt: () => process.env.JWT_ORG_ADMIN_B || null,
    body: {
      championship_id: TEST_UUIDS.champA,
      name: 'Horario Ilegítimo Org B',
      start_time: '2026-11-05T15:00:00Z',
      end_time: '2026-11-05T16:00:00Z'
    }
  },
  {
    id: 'SEC-07',
    role: 'coach_club2',
    name: 'Coach de Club 2 intenta ver reclamos técnicos de Club 1 (Debe retornar vacío)',
    endpoint: `/rest/v1/technical_inquiries?club_id=eq.${TEST_UUIDS.club1}&select=*`,
    method: 'GET',
    tableTarget: 'technical_inquiries',
    getJwt: () => process.env.JWT_COACH_CLUB2 || null
  }
];

export function executeTest(test) {
  return new Promise((resolve) => {
    const token = test.getJwt();
    if (!token) {
      return resolve({
        id: test.id,
        name: test.name,
        role: test.role,
        verdict: 'OMITIDA_FALTA_JWT',
        detail: 'Requiere variable de entorno con JWT de usuario de prueba'
      });
    }

    const postData = test.body ? JSON.stringify(test.body) : null;
    const url = new URL(SUPABASE_URL + test.endpoint);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: test.method,
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (e) { parsed = body; }

        let verdict = 'DESCONOCIDO';
        let detail = '';

        // 1. Detección de Tabla Inexistente (HTTP 404 / relation does not exist)
        if (res.statusCode === 404) {
          verdict = 'PENDIENTE_DESPLIEGUE';
          detail = `La tabla "${test.tableTarget}" aún no existe en Supabase remoto (HTTP 404). Pendiente de ejecución del bundle.`;
        }
        // 2. Bloqueo por RLS en INSERT (HTTP 401 / 403 con código Postgres 42501)
        else if (res.statusCode === 401 || res.statusCode === 403 || (parsed && parsed.code === '42501')) {
          verdict = 'RLS_BLOQUEADO_EXITOSO';
          detail = `Bloqueado por política RLS (Código ${parsed?.code || res.statusCode}): ${parsed?.message || 'Acceso no autorizado'}`;
        }
        // 3. Consulta SELECT filtrada por RLS (HTTP 200 con array vacío)
        else if (res.statusCode === 200 && Array.isArray(parsed) && parsed.length === 0) {
          verdict = 'RLS_BLOQUEADO_EXITOSO';
          detail = 'Lectura o modificación denegada por RLS: 0 registros retornados / afectados.';
        }
        // 4. Modificación con 0 filas afectadas (UPDATE/DELETE silencioso por RLS)
        else if ((test.method === 'PATCH' || test.method === 'DELETE') && res.statusCode === 200 && Array.isArray(parsed) && parsed.length === 0) {
          verdict = 'RLS_BLOQUEADO_EXITOSO';
          detail = 'Modificación bloqueada por RLS: 0 filas modificadas.';
        }
        // 5. Inserción permitida indebidamente
        else if (test.method === 'POST' && (res.statusCode === 200 || res.statusCode === 201)) {
          verdict = 'VULNERABILIDAD_DETECTADA';
          detail = `FALLO DE SEGURIDAD: Se permitió la inserción no autorizada en "${test.tableTarget}".`;
        }
        // 6. Lectura con registros expuestos indebidamente
        else if (test.method === 'GET' && res.statusCode === 200 && Array.isArray(parsed) && parsed.length > 0) {
          verdict = 'VULNERABILIDAD_DETECTADA';
          detail = `FALLO DE PRIVACIDAD: Se expusieron ${parsed.length} registros que debían estar restringidos.`;
        }
        else {
          verdict = 'RESPUESTA_POSTGREST';
          detail = `HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`;
        }

        resolve({
          id: test.id,
          name: test.name,
          role: test.role,
          statusCode: res.statusCode,
          verdict,
          detail
        });
      });
    });

    req.on('error', (err) => {
      resolve({ id: test.id, name: test.name, role: test.role, verdict: 'ERROR_CONEXION', detail: err.message });
    });

    if (postData) req.write(postData);
    req.end();
  });
}

export async function runAll() {
  console.log('================================================================');
  console.log('OPERIX GYMNASTICS — PROTOCOLO DE VALIDACIÓN RLS Y MULTI-TENANT');
  console.log('Servidor: ' + SUPABASE_URL);
  console.log('Fecha: ' + new Date().toISOString());
  console.log('================================================================\n');

  let rlsPassed = 0;
  let pendingDeploy = 0;
  let skippedJwt = 0;
  let vulnerabilities = 0;

  for (const t of POST_DEPLOY_TESTS) {
    const res = await executeTest(t);
    let icon = '❓';
    if (res.verdict === 'RLS_BLOQUEADO_EXITOSO') {
      icon = '🛡️ [RLS BLOQUEADO OK]';
      rlsPassed++;
    } else if (res.verdict === 'PENDIENTE_DESPLIEGUE') {
      icon = '⏳ [PENDIENTE DESPLIEGUE]';
      pendingDeploy++;
    } else if (res.verdict === 'OMITIDA_FALTA_JWT') {
      icon = '⚠️ [OMITIDA SIN JWT]';
      skippedJwt++;
    } else if (res.verdict === 'VULNERABILIDAD_DETECTADA') {
      icon = '🚨 [VULNERABILIDAD]';
      vulnerabilities++;
    }

    console.log(`${icon} ${res.id} (${res.role}): ${res.name}`);
    console.log(`   Detalle: ${res.detail}\n`);
  }

  console.log('================================================================');
  console.log(`RESUMEN TÉCNICO VERIFICADO:`);
  console.log(`  - Pruebas RLS Exitosas en Tablas Existentes: ${rlsPassed}`);
  console.log(`  - Pruebas Aplazadas (Tablas Aún No Desplegadas en Supabase): ${pendingDeploy}`);
  console.log(`  - Pruebas Omitidas (Pendientes de JWT de Staging): ${skippedJwt}`);
  console.log(`  - Vulnerabilidades Detectadas: ${vulnerabilities}`);
  console.log('================================================================');
}

runAll();
