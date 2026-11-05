/**
 * OPERIX GYMNASTICS — PROTOCOLO DE VALIDACIÓN DE SEGURIDAD POST-DESPLIEGUE (JWT Y RLS)
 * Desarrollado por Comercial Hels SpA
 * Fecha: 5 de noviembre de 2026
 *
 * Este script valida en PostgREST real el aislamiento multi-tenant y las políticas RLS.
 * Admite tanto tokens anónimos como JWTs individuales de usuarios de prueba.
 * 
 * Configuración requerida de variables de entorno para pruebas completas:
 * - VITE_SUPABASE_URL: URL del proyecto Supabase.
 * - VITE_SUPABASE_ANON_KEY: Clave anon pública.
 * - JWT_ORG_ADMIN_B: Token de admin de Organización B (Tenant ajeno).
 * - JWT_COACH_CLUB2: Token de entrenador de Club 2 en Torneo A.
 * - JWT_VIEWER_A: Token de solo lectura en Organización A.
 */

import https from 'node:https';
import { URL } from 'node:url';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wuifhlsygqdldtzoouln.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aWZobHN5Z3FkbGR0em9vdWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3Mzc2MzksImV4cCI6MjEwOTMxMzYzOX0.9zjrmpvnus8W1XV5bpEA6ZPRPbnGqFl62WjdasfkI5o';

// Identificadores de Prueba Sintéticos (UUIDs aislados para no tocar datos reales)
const TEST_UUIDS = {
  champA: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  champB: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  club1: '11111111-1111-1111-1111-111111111111',
  club2: '22222222-2222-2222-2222-222222222222',
};

// Matriz de Casos de Prueba de Seguridad
export const POST_DEPLOY_TESTS = [
  // --- GRUPO 1: USUARIO ANÓNIMO (anon) ---
  {
    id: 'SEC-01',
    role: 'anon',
    name: 'Anon no puede ver actas técnicas reservadas (document_type = official_minutes)',
    endpoint: `/rest/v1/championship_documents?document_type=eq.official_minutes&select=*`,
    method: 'GET',
    getJwt: () => ANON_KEY,
    expectedStatus: [200, 404],
    validate: (res, code) => code === 404 || (Array.isArray(res) && res.length === 0)
  },
  {
    id: 'SEC-02',
    role: 'anon',
    name: 'Anon no puede listar reclamos técnicos privados (technical_inquiries)',
    endpoint: `/rest/v1/technical_inquiries?select=*`,
    method: 'GET',
    getJwt: () => ANON_KEY,
    expectedStatus: [200, 404],
    validate: (res, code) => code === 404 || (Array.isArray(res) && res.length === 0)
  },
  {
    id: 'SEC-03',
    role: 'anon',
    name: 'Anon tiene denegada la inserción de cronogramas en competition_schedules',
    endpoint: `/rest/v1/competition_schedules`,
    method: 'POST',
    getJwt: () => ANON_KEY,
    body: {
      championship_id: TEST_UUIDS.champA,
      name: 'Horario Hack',
      start_time: '2026-11-05T12:00:00Z',
      end_time: '2026-11-05T14:00:00Z'
    },
    expectedStatus: [401, 403, 404]
  },
  {
    id: 'SEC-04',
    role: 'anon',
    name: 'Anon no puede modificar ni borrar registros en score_audits (Inmutabilidad)',
    endpoint: `/rest/v1/score_audits?id=neq.00000000-0000-0000-0000-000000000000`,
    method: 'DELETE',
    getJwt: () => ANON_KEY,
    expectedStatus: [200, 204, 401, 403, 404],
    validate: (res, code) => (Array.isArray(res) && res.length === 0) || code === 401 || code === 403
  },

  // --- GRUPO 2: AISLAMIENTO MULTI-TENANT CON JWT AUTENTICADO ---
  {
    id: 'SEC-05',
    role: 'org_admin_b',
    name: 'Admin de Org B intenta insertar cronograma en Campeonato de Org A (Debe fallar)',
    endpoint: `/rest/v1/competition_schedules`,
    method: 'POST',
    getJwt: () => process.env.JWT_ORG_ADMIN_B || null,
    body: {
      championship_id: TEST_UUIDS.champA,
      name: 'Intrusión Org B',
      start_time: '2026-11-05T15:00:00Z',
      end_time: '2026-11-05T16:00:00Z'
    },
    expectedStatus: [401, 403, 404]
  },
  {
    id: 'SEC-06',
    role: 'coach_club2',
    name: 'Coach de Club 2 intenta ver reclamos técnicos de Club 1 (Debe retornar vacío)',
    endpoint: `/rest/v1/technical_inquiries?club_id=eq.${TEST_UUIDS.club1}&select=*`,
    method: 'GET',
    getJwt: () => process.env.JWT_COACH_CLUB2 || null,
    expectedStatus: [200, 401, 404],
    validate: (res) => Array.isArray(res) ? res.length === 0 : true
  },
  {
    id: 'SEC-07',
    role: 'viewer',
    name: 'Usuario Viewer intenta actualizar podio en championship_awards_ceremonies (Debe fallar)',
    endpoint: `/rest/v1/championship_awards_ceremonies?championship_id=eq.${TEST_UUIDS.champA}`,
    method: 'PATCH',
    getJwt: () => process.env.JWT_VIEWER_A || null,
    body: { status: 'completed' },
    expectedStatus: [401, 403, 404]
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
        status: 'OMITIDA (JWT no provisto en variables de entorno)',
        passed: null
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
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = body;
        }

        let passed = false;
        if (Array.isArray(test.expectedStatus)) {
          passed = test.expectedStatus.includes(res.statusCode);
        } else {
          passed = res.statusCode === test.expectedStatus;
        }

        if (passed && test.validate) {
          passed = test.validate(parsed, res.statusCode);
        }

        resolve({
          id: test.id,
          name: test.name,
          role: test.role,
          statusCode: res.statusCode,
          passed,
          status: passed ? 'APROBADA' : 'FALLÓ'
        });
      });
    });

    req.on('error', (err) => {
      resolve({ id: test.id, name: test.name, role: test.role, passed: false, error: err.message, status: 'ERROR' });
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

  let executed = 0;
  let passed = 0;
  let skipped = 0;

  for (const t of POST_DEPLOY_TESTS) {
    const res = await executeTest(t);
    if (res.passed === null) {
      skipped++;
      console.log(`[?] ${res.id} (${res.role}): ${res.name} -> ${res.status}`);
    } else if (res.passed) {
      executed++;
      passed++;
      console.log(`[PASS] ${res.id} (${res.role}): ${res.name} (HTTP ${res.statusCode})`);
    } else {
      executed++;
      console.log(`[FAIL] ${res.id} (${res.role}): ${res.name} (HTTP ${res.statusCode})`);
    }
  }

  console.log('\n================================================================');
  console.log(`RESUMEN: ${passed}/${executed} pruebas ejecutadas aprobadas (${skipped} omitidas por falta de JWT individual).`);
  console.log('================================================================');
}

runAll();
