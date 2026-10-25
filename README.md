# Operix Gymnastics

Plataforma comercial SaaS multi-tenant para la creación y gestión integral de campeonatos de gimnasia (Artística Femenina y Masculina, Rítmica, Trampolín, Aeróbica y Acrobática).

## Stack Tecnológico

- **Frontend**: React 19, TypeScript, Vite.
- **Estilos**: Tailwind CSS v4, Lucide Icons.
- **Base de Datos & Auth**: Supabase PostgreSQL con Row Level Security (RLS), Supabase Auth y Realtime.
- **Testing**: Vitest + Testing Library (Unitarias), Playwright (End-to-End).

## Estructura Modular del Proyecto

- `src/core/`: Configuración de entorno con validación estricta, constantes y tipos de base de datos / dominio.
- `src/lib/`: Cliente Supabase seguro para el navegador (solo clave anónima pública) y utilidades de estilos.
- `src/features/`: Módulos verticales por dominio de negocio (Auth, Organizaciones, Campeonatos, Categorías, Delegaciones, Jurado, Puntuaciones, Clasificaciones, Premiación, Portal Público).
- `src/components/`: Componentes UI reutilizables y guardas de seguridad de rutas y tenant.
- `supabase/migrations/`: Migraciones versionadas SQL para PostgreSQL con RLS y triggers de integridad.
- `docs/architecture/`: Especificaciones formales de arquitectura, matriz de roles y registros de decisiones (ADRs).

## Comandos Disponibles

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Ejecutar suite de pruebas unitarias
npm test

# Verificación de tipos TypeScript
npm run typecheck

# Compilar para producción
npm run build
```

## Configuración de Entorno

1. Copiar `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```
2. Rellenar las variables con los datos de tu proyecto de Supabase:
   ```env
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
   ```
