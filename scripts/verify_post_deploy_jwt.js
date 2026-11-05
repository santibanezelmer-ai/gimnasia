/**
 * OPERIX GYMNASTICS — PROTOCOLO DE VALIDACIÓN DE SEGURIDAD POST-DESPLIEGUE (JWT)
 * Desarrollado por Comercial Hels SpA
 * Fecha: 5 de noviembre de 2026
 *
 * Este script está diseñado para ejecutarse inmediatamente después de que el
 * propietario del proyecto aplique el bundle canónico en el SQL Editor de Supabase.
 * Valida mediante PostgREST real el aislamiento multi-tenant y las políticas RLS.
 */

const https = require('https');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://wuifhlsygqdldtzoouln.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1aWZobHN5Z3FkbGR0em9vdWxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3Mzc2MzksImV4cCI6MjEwOTMxMzYzOX0.9zjrmpvnus8W1XV5bpEA6ZPRPbnGqFl62WjdasfkI5o';

// Matriz de Casos de Prueba de Seguridad Post-Despliegue
const SECURITY_TEST_CASES = [
  {
    name: '1. Anon no puede ver documentos técnicos reservados (official_minutes)',
    endpoint: '/rest/v1/championship_documents?document_type=eq.official_minutes',
    method: 'GET',
    role: 'anon',
    jwt: ANON_KEY,
    expectedStatus: 200,
    validate: (data) => Array.isArray(data) && data.length === 0
  },
  {
    name: '2. Anon no puede consultar reclamos técnicos privados (technical_inquiries)',
    endpoint: '/rest/v1/technical_inquiries?select=*',
    method: 'GET',
    role: 'anon',
    jwt: ANON_KEY,
    expectedStatus: 200,
    validate: (data) => Array.isArray(data) && data.length === 0
  },
  {
    name: '3. Anon no puede insertar horarios en competition_schedules',
    endpoint: '/rest/v1/competition_schedules',
    method: 'POST',
    role: 'anon',
    jwt: ANON_KEY,
    body: {
      championship_id: '00000000-0000-0000-0000-000000000000',
      name: 'Horario Ilegítimo',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString()
    },
    expectedStatus: 401 // o 42501 (bloqueado por RLS)
  },
  {
    name: '4. Anon no puede insertar ceremonias en championship_awards_ceremonies',
    endpoint: '/rest/v1/championship_awards_ceremonies',
    method: 'POST',
    role: 'anon',
    jwt: ANON_KEY,
    body: {
      championship_id: '00000000-0000-0000-0000-000000000000',
      ceremony_key: 'ceremony_hack',
      ceremony_type: 'all_around',
      title: 'Premiación Falsa'
    },
    expectedStatus: 401
  },
  {
    name: '5. Intento de UPDATE en score_audits (Debe ser bloqueado por RLS o Trigger)',
    endpoint: '/rest/v1/score_audits?id=neq.00000000-0000-0000-0000-000000000000',
    method: 'PATCH',
    role: 'anon',
    jwt: ANON_KEY,
    body: { reason: 'Manipulación maliciosa de auditoría' },
    expectedStatus: [200, 401, 400],
    validate: (data, statusCode) => statusCode === 401 || (Array.isArray(data) && data.length === 0)
  }
];

function executeRequest(test) {
  return new Promise((resolve) => {
    const postData = test.body ? JSON.stringify(test.body) : null;
    const url = new URL(SUPABASE_URL + test.endpoint);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: test.method,
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${test.jwt}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(responseBody);
        } catch (e) {
          parsed = responseBody;
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
          name: test.name,
          passed,
          statusCode: res.statusCode,
          response: parsed
        });
      });
    });

    req.on('error', (err) => {
      resolve({ name: test.name, passed: false, error: err.message });
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runPostDeployVerification() {
  console.log('================================================================');
  console.log('OPERIX GYMNASTICS — PROTOCOLO DE VALIDACIÓN RLS POST-DESPLIEGUE');
  console.log('Servidor Objetivo: ' + SUPABASE_URL);
  console.log('Fecha: ' + new Date().toISOString());
  console.log('================================================================\n');

  let passedCount = 0;
  for (const t of SECURITY_TEST_CASES) {
    const res = await executeRequest(t);
    const badge = res.passed ? '✅ [APROBADO]' : '❌ [FALLÓ]';
    console.log(`${badge} ${res.name}`);
    console.log(`   Status HTTP recibido: ${res.statusCode}`);
    if (!res.passed) {
      console.log(`   Detalle:`, JSON.stringify(res.response || res.error));
    }
    if (res.passed) passedCount++;
  }

  console.log('\n================================================================');
  console.log(`Resultado: ${passedCount}/${SECURITY_TEST_CASES.length} pruebas superadas.`);
  console.log('================================================================');
}

if (require.main === module) {
  runPostDeployVerification();
}

module.exports = { runPostDeployVerification, SECURITY_TEST_CASES };
