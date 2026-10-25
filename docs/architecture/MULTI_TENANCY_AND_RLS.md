# Multi-Tenancy y Modelo de Seguridad RLS

## 1. Modelo de Identidad y Membresías

Un usuario auténtico de Supabase Auth (`auth.users`) posee un registro correspondiente en `public.profiles`.

Un usuario puede participar en una o más organizaciones (`public.organizations`) mediante la tabla intermedia `public.organization_members`.

### Matriz de Roles y Alcance

| Rol en Organización | Permisos Clave | Restricciones de Seguridad |
|---|---|---|
| **platform_admin** | Superusuario de plataforma (SaaS global) | **No asignable** desde la interfaz de organizaciones. Gestionado exclusivamente por migrations o funciones internas. |
| **org_admin** | Administrador de la organización, torneos, clubes y miembros | Scoped a `organization_id`. No puede ver torneos de otras organizaciones. |
| **competition_manager** | Configuración de torneos, cronogramas, categorías y rotaciones | Scoped a torneos de su organización. |
| **head_judge** | Juez Árbitro / Juez Principal: aprueba notas, gestiona recursos y auditoría | Scoped a los torneos donde fue asignado. |
| **judge** | Juez de Aparato (Dificultad o Ejecución) | **Solo puede registrar puntuaciones** para las pruebas y aparatos asignados explícitamente. |
| **club_manager** | Delegado o encargado de club | Solo puede ver o gestionar datos e inscripciones de **su propio club**. |
| **coach** | Entrenador | Acceso de lectura a las notas y rotaciones de sus deportistas inscritos. |
| **viewer** | Miembro observador dentro de la organización | Acceso de solo lectura. |

---

## 2. Principios de Row Level Security (RLS)

1. **Deny by default**: Toda tabla creada tiene `ENABLE ROW LEVEL SECURITY` de inmediato.
2. **Funciones SECURITY DEFINER cacheadas**:
   - `auth.uid()` identifica al usuario conectado.
   - `is_platform_admin(auth.uid())` verifica si tiene privilegios de plataforma.
   - `current_user_has_org_role(org_id, required_roles)` evalúa membresía activa sin causar recursión infinita en las políticas RLS.
3. **Anti-Privilege Escalation**:
   - Un usuario con rol `org_admin` solo puede invitar o asignar roles organizacionales (`org_admin`, `competition_manager`, `judge`, etc.).
   - La columna `platform_role` en `profiles` no puede ser modificada por usuarios ordinarios (protegida por trigger / política `UPDATE`).
4. **Aislamiento de Clubes**:
   - Los datos privados de un club (documentación médica, seguros, datos de contacto) solo son accesibles por el `club_manager` de dicho club o por los administradores del campeonato organizador.
5. **Protección de Resultados No Publicados**:
   - Las puntuaciones en estado borrador (`draft`) o revisión interna solo son visibles para el panel de jueces y el `head_judge`.
   - Ni los clubes ni el público general pueden consultar notas no aprobadas ni suscribirse a sus canales de Supabase Realtime.
