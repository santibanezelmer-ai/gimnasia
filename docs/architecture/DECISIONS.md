# Registro de Decisiones de Arquitectura (ADR)

## ADR-001: Estrategia Multi-Tenant con Row Level Security (RLS) Nativo de PostgreSQL

### Estado
Aceptado

### Contexto
Operix Gymnastics debe alojar múltiples organizaciones (federaciones, clubes, promotores) asegurando que ninguna organización pueda acceder a datos privados de otra, mientras se permite a jueces o entrenadores operar en más de una organización con diferentes permisos.

### Decisión
Utilizar una única base de datos PostgreSQL con discriminador `organization_id` en todas las tablas con datos del tenant, respaldada por RLS obligatorio en Supabase.
Las funciones de verificación de membresía se implementarán como funciones `SECURITY DEFINER` con `search_path` seguro para evitar recursión RLS y prevenir inyecciones.

### Consecuencias
- **Positivas**: Máxima simplicidad operativa, soporte directo de Supabase Auth y Realtime filtrado por RLS, menor costo de infraestructura.
- **Mitigaciones**: Es imprescindible contar con pruebas automatizadas que verifiquen el aislamiento entre organizaciones antes de publicar cada release.

---

## ADR-002: Control de Escalamiento de Privilegios y Roles de Plataforma

### Estado
Aceptado

### Contexto
Un administrador de organización (`org_admin`) no debe tener la capacidad de nombrarse `platform_admin` ni modificar datos de suscripción de la plataforma.

### Decisión
Separar el rol de plataforma (`profiles.platform_role`) de los roles de organización (`organization_members.role`). Prohibir mediante triggers y políticas RLS que cualquier usuario que no sea `platform_admin` actualice el campo `platform_role`.

---

## ADR-003: Motor de Puntuaciones Determinista y Sin Código Arbitrario

### Estado
Aceptado

### Contexto
Diferentes disciplinas y reglamentos (FIG, federaciones nacionales, ligas escolares) utilizan fórmulas de cálculo distintas. Permitir a los usuarios ingresar código ejecutable arbitrario acarrearía riesgos críticos de seguridad y vulnerabilidades XSS o RCE.

### Decisión
Definir un catálogo tipado de calculadores deterministas en TypeScript y PostgreSQL. Cada campeonato declara su `ruleset_version` y `scoring_schema_version`. El sistema selecciona el calculador oficial correspondiente sin interpretar expresiones no verificadas.

---

## ADR-004: Canal de Resultados en Vivo vs Publicación Oficial

### Estado
Aceptado

### Contexto
Durante el evento, los jueces registran notas parciales y borradores. Si se publica una nota en vivo antes de la firma del Juez Árbitro, pueden generarse reclamos o filtraciones indebidas.

### Decisión
Establecer un ciclo de vida formal para las puntuaciones:
`draft` -> `submitted` -> `provisional` (opcional si la política del evento permite visualización en vivo) -> `official_approved`.
Las clasificaciones definitivas y el portal público oficial solo leen notas `official_approved`.
