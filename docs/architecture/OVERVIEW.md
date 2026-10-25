# Operix Gymnastics: Arquitectura de Software

## 1. Visión y Alcance

Operix Gymnastics es una plataforma SaaS multi-tenant diseñada para federaciones, asociaciones y clubes organizadores de campeonatos de gimnasia (Artística Femenina/Masculina, Rítmica, Trampolín, Aeróbica y Acrobática).

El sistema resuelve la gestión integral de un evento deportivo:
1. **Administración de organizaciones y torneos** (públicos, privados, por invitación).
2. **Definición técnica**: categorías, subcategorías, edades, niveles, disciplinas y aparatos.
3. **Padrón de entidades**: deportistas, clubes, entrenadores y delegaciones.
4. **Inscripciones y acreditación**.
5. **Jurado**: asignación de jueces por aparato y rotación con control estricto de ámbito.
6. **Captura y validación de puntuaciones**: fórmulas oficiales deterministas por disciplina y reglamento (FIG, USAG, etc.).
7. **Motor de clasificaciones**: cómputo automático de All-Around, por aparato y por equipos.
8. **Publicación y directos**: separación estricta entre notas provisionales y resultados oficiales aprobados.

---

## 2. Principios de Diseño Arquitectónico

- **Separación de responsabilidades en 4 capas**:
  - *Presentación*: Componentes React organizados por dominio (`features/*`) y UI agnóstica (`components/ui/*`).
  - *Lógica de Dominio*: Motores puros de cálculo y validación de reglas técnicas, sin dependencias de infraestructura ni ejecución de código arbitrario.
  - *Acceso a Datos*: Cliente Supabase tipado con tipos generados desde el esquema de la base de datos.
  - *Seguridad y Autorización*: PostgreSQL Row Level Security (RLS) en el nivel más bajo, complementado por guardas en la interfaz.
- **Aislamiento Multi-Tenant**:
  - Cada organización posee aislamiento lógico garantizado por RLS mediante `organization_id`.
  - Los usuarios pueden pertenecer a múltiples organizaciones con roles independientes en cada una.
- **Inmutabilidad y Auditoría**:
  - Toda modificación de una nota deportiva genera un registro inmutable en `score_audits` con el motivo, usuario responsable, valores previos y nuevos.
- **Versionado de Reglamento**:
  - Los campeonatos congelan la versión de reglamento (`ruleset_version`) y esquema de puntuación (`scoring_schema_version`) en el momento de su creación.

---

## 3. Estructura del Código

```text
operix-gymnastics/
├── docs/                          # Documentación arquitectónica y ADRs
│   └── architecture/
│       ├── OVERVIEW.md
│       ├── MULTI_TENANCY_AND_RLS.md
│       ├── SPORTS_SCORING_AND_AUDIT.md
│       └── DECISIONS.md
├── supabase/                      # Migraciones e infraestructura PostgreSQL
│   └── migrations/
│       └── 20261025000001_core_tenancy_and_auth.sql
├── src/
│   ├── core/                      # Tipos globales, configuración y constantes
│   │   ├── config/                # Validación de variables de entorno y banderas
│   │   └── types/                 # Interfaces de base de datos, auth y campeonatos
│   ├── lib/                       # Utilidades externas y cliente Supabase
│   │   ├── supabase/              # Instancia de Supabase segura para el navegador
│   │   └── utils/                 # Helpers (clsx, twMerge)
│   ├── features/                  # Módulos verticales por dominio
│   │   ├── auth/                  # Inicio de sesión, perfil, recuperación
│   │   ├── organizations/         # Contexto de organización, cambio de tenant, miembros
│   │   ├── championships/         # Creación y configuración de campeonatos
│   │   ├── categories/            # Disciplinas, aparatos, niveles y edades
│   │   ├── delegations/           # Clubes, deportistas y delegaciones
│   │   ├── judging/               # Asignación de jueces y paneles por aparato
│   │   ├── scoring/               # Fórmulas de puntuación y auditoría de notas
│   │   ├── standings/             # Motor de clasificaciones individual y por equipos
│   │   ├── awards/                # Premiación, diplomas y medallas
│   │   └── public-portal/         # Portal de directos y resultados oficiales
│   ├── components/                # Componentes compartidos
│   │   ├── ui/                    # Botones, tarjetas, modales, tablas
│   │   ├── layout/                # Barra superior, barra lateral, selector de organización
│   │   └── guards/                # Guardas de ruta, rol y tenant activo
│   └── test/                      # Configuración de Vitest y pruebas unitarias
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```
