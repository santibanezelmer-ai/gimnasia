# Motor Deportivo: Puntuaciones, Fórmulas y Auditoría

## 1. Composición de Puntuaciones en Gimnasia

Según el Código de Puntuación de la Federación Internacional de Gimnasia (FIG) y adaptaciones de niveles:

$$\text{Nota Final} = \text{Nota D} + \text{Nota E} - \text{Penalizaciones Neutras (ND)}$$

- **Nota D (Dificultad / Requisitos / Enlaces)**:
  - Calculada a partir de los elementos acreditados, bonificaciones de enlace y cumplimiento de requisitos del grupo de elementos.
- **Nota E (Ejecución y Arte)**:
  - Comienza en 10.000 puntos y se restan las faltas de ejecución técnica y composición artística.
  - Para jurados de múltiples jueces (por ejemplo 4 jueces E), se eliminan la nota más alta y la más baja, promediando las intermedias.
- **Deducciones Neutras (ND / Line / Time violations)**:
  - Faltas de línea de suelo, rebasamiento de tiempo o faltas reglamentarias de indumentaria.

---

## 2. Inmutabilidad de Fórmulas y Prevención de Código Arbitrario

- **Regla fundamental**: No se permite evaluar código JavaScript o SQL arbitrario provisto por usuarios (`eval()`, `new Function()`, etc.).
- Las fórmulas se implementan como **estrategias funcionales deterministas y versionadas**:
  - `fig_wag_2025_v1`: Reglas FIG Gimnasia Artística Femenina 2025-2028.
  - `fig_mag_2025_v1`: Reglas FIG Gimnasia Artística Masculina 2025-2028.
  - `fig_rg_2025_v1`: Reglas FIG Gimnasia Rítmica 2025-2028.
  - `usag_development_v1`: Programa USAG niveles 1 al 10.
- Cada campeonato guarda en su registro el identificador de la estrategia de cálculo (`scoring_schema_version`).

---

## 3. Pista de Auditoría (`score_audits`)

Cualquier alteración a una nota después de su registro inicial requiere:
1. Identificador del juez árbitro o administrador que autoriza el cambio (`modified_by_user_id`).
2. Motivo documentado (`reason`): por ejemplo, apelación de dificultad aceptada, error de transcripción o fallo técnico de cronometraje.
3. Fotografía JSON de la nota previa (`previous_value`) y de la nota corregida (`new_value`).
4. Marca temporal (`created_at`).

---

## 4. Clasificaciones Automáticas

Las clasificaciones se calculan exclusivamente a partir de notas con estado `official_approved`:
1. **General Individual (All-Around)**: Suma de las notas finales de todos los aparatos de la categoría.
2. **Por Aparato**: Orden descendente de notas finales en un aparato específico, aplicando criterios oficiales de desempate (ej. mayor nota E).
3. **Por Equipos**: Suma de las $N$ mejores notas del equipo por aparato según las bases de la competición (ej. formato 5-4-3: 5 inscritas, 4 compiten, 3 mejores notas puntúan).
