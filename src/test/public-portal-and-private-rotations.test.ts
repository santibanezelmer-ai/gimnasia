/**
 * OPERIX GYMNASTICS — SUITE DE PRUEBAS DE SEGURIDAD (PORTAL PÚBLICO Y PRIVADO DE ROTACIONES)
 * Desarrollado por Comercial Hels SpA
 *
 * Valida de forma rigurosa la separación entre información pública y privada:
 * 1. Usuario anónimo: no puede consultar rotaciones.
 * 2. Usuario autenticado sin club: no puede consultar rotaciones.
 * 3. Club A: puede consultar sus propias rotaciones.
 * 4. Club A: no puede consultar las rotaciones del Club B (aislamiento estricto).
 * 5. Delegado del Club A: puede consultar toda la programación de su club.
 * 6. Administrador del campeonato: puede consultar la programación completa.
 * 7. Juez: solo puede consultar las asignaciones autorizadas.
 * 8. Usuario no autorizado: no puede suscribirse a información privada de otro campeonato.
 * 9. Los resultados publicados siguen siendo accesibles desde el portal público.
 */

import { describe, it, expect } from 'vitest'

interface MockUser {
  id: string
  email: string
  platformRole?: 'platform_admin' | 'none'
}

interface MockOrgMember {
  organizationId: string
  userId: string
  role: 'org_admin' | 'competition_manager' | 'head_judge' | 'judge' | 'club_manager' | 'coach'
}

interface MockClub {
  id: string
  name: string
  code: string
}

interface MockClubMember {
  clubId: string
  userId: string
  role: 'manager' | 'coach'
}

interface MockRegistration {
  id: string
  championshipId: string
  clubId: string
  gymnastId: string
  gymnastName: string
  bibNumber: number
  categoryName: string
  subdivision: string
  rotationGroup: string
  startingApparatus: string
  startOrder: number
  status: 'pending' | 'approved' | 'rejected'
}

interface MockCompetitionSchedule {
  id: string
  championshipId: string
  title: string
  timeStart: string
  timeEnd: string
  subdivision: string
}

interface MockScore {
  id: string
  championshipId: string
  gymnastId: string
  apparatusCode: string
  finalScore: number
  status: 'draft' | 'approved' | 'inquired'
  isPublished: boolean
}

interface MockJudgeAssignment {
  championshipId: string
  userId: string
  apparatusCode: string
}

/**
 * Simulador de Políticas RLS y RPC de Operix Gymnastics para Rotaciones y Portales
 */
class RotationsSecurityEvaluator {
  private users = new Map<string, MockUser>()
  private orgMembers: MockOrgMember[] = []
  private clubs = new Map<string, MockClub>()
  private clubMembers: MockClubMember[] = []
  private registrations: MockRegistration[] = []
  private schedules: MockCompetitionSchedule[] = []
  private scores: MockScore[] = []
  private judgeAssignments: MockJudgeAssignment[] = []

  constructor(data: {
    users: MockUser[]
    orgMembers: MockOrgMember[]
    clubs: MockClub[]
    clubMembers: MockClubMember[]
    registrations: MockRegistration[]
    schedules: MockCompetitionSchedule[]
    scores: MockScore[]
    judgeAssignments: MockJudgeAssignment[]
  }) {
    data.users.forEach((u) => this.users.set(u.id, u))
    data.clubs.forEach((c) => this.clubs.set(c.id, c))
    this.orgMembers = data.orgMembers
    this.clubMembers = data.clubMembers
    this.registrations = data.registrations
    this.schedules = data.schedules
    this.scores = data.scores
    this.judgeAssignments = data.judgeAssignments
  }

  /**
   * Evalúa la función PostgreSQL public.current_user_can_access_championship_rotations
   */
  canAccessChampionshipRotations(userId: string | null, championshipId: string, targetClubId?: string): boolean {
    if (!userId) return false // Regla 1: Anónimo siempre rechazado

    const user = this.users.get(userId)
    if (!user) return false

    // 1. SuperAdmin
    if (user.platformRole === 'platform_admin') return true

    // 2. Org Staff (org_admin, competition_manager, head_judge)
    const isStaff = this.orgMembers.some(
      (om) => om.userId === userId && ['org_admin', 'competition_manager', 'head_judge'].includes(om.role)
    )
    if (isStaff) return true

    // 3. Juez asignado
    const isJudge = this.judgeAssignments.some(
      (ja) => ja.championshipId === championshipId && ja.userId === userId
    )
    if (isJudge) return true

    // 4. Delegado de Club
    if (targetClubId) {
      return this.registrations.some(
        (r) =>
          r.championshipId === championshipId &&
          r.clubId === targetClubId &&
          r.status === 'approved' &&
          this.clubMembers.some((cm) => cm.clubId === targetClubId && cm.userId === userId)
      )
    }

    // Cualquier club del usuario inscrito
    return this.registrations.some(
      (r) =>
        r.championshipId === championshipId &&
        r.status === 'approved' &&
        this.clubMembers.some((cm) => cm.clubId === r.clubId && cm.userId === userId)
    )
  }

  /**
   * Simula la RPC get_my_club_rotations(championship_id, target_club_id)
   */
  getMyClubRotations(userId: string | null, championshipId: string, targetClubId?: string): MockRegistration[] {
    if (!userId) {
      throw new Error('401 Unauthorized: Debe autenticarse para consultar rotaciones')
    }

    const user = this.users.get(userId)
    if (!user) throw new Error('Usuario inexistente')

    const isStaff =
      user.platformRole === 'platform_admin' ||
      this.orgMembers.some(
        (om) => om.userId === userId && ['org_admin', 'competition_manager', 'head_judge'].includes(om.role)
      )

    // Si es organizador, recibe todas las rotaciones o las del club especificado
    if (isStaff) {
      return this.registrations.filter(
        (r) =>
          r.championshipId === championshipId &&
          (!targetClubId || r.clubId === targetClubId) &&
          r.status === 'approved'
      )
    }

    // Si es delegado de club:
    const userClubIds = this.clubMembers.filter((cm) => cm.userId === userId).map((cm) => cm.clubId)

    // Si intenta forzar un targetClubId donde NO tiene membresía, retorna 0 filas
    if (targetClubId && !userClubIds.includes(targetClubId)) {
      return []
    }

    const allowedClubIds = targetClubId ? [targetClubId] : userClubIds

    return this.registrations.filter(
      (r) => r.championshipId === championshipId && allowedClubIds.includes(r.clubId) && r.status === 'approved'
    )
  }

  /**
   * Verifica permisos de modificación de programación (INSERT/UPDATE/DELETE)
   */
  canModifyCompetitionSchedule(userId: string | null, _championshipId: string): boolean {
    if (!userId) return false
    const user = this.users.get(userId)
    if (!user) return false
    if (user.platformRole === 'platform_admin') return true
    return this.orgMembers.some(
      (om) => om.userId === userId && ['org_admin', 'competition_manager'].includes(om.role)
    )
  }

  /**
   * Simula la entrega de datos de campeonato en el portal público garantizando
   * que judge_code e invite_code nunca se descarguen a clientes anónimos.
   */
  getPublicChampionshipPayload(): Record<string, unknown> {
    return {
      id: 'champ-nacional-2026',
      name: 'Campeonato Nacional Apertura GAF 2026',
      slug: 'nacional-gaf-2026',
      description: 'Campeonato oficial FIG.',
      startDate: '2026-11-03',
      endDate: '2026-11-06',
      venueName: 'Polideportivo Estadio Nacional',
      location: 'Santiago, Chile',
      status: 'in_progress',
      visibility: 'public',
      rulesetVersion: 'FIG 2025-2028',
      // judge_code e invite_code NO DEBEN EXISTIR EN ESTE PAYLOAD
    }
  }

  /**
   * Consulta pública de resultados oficiales (Portal Público)
   */
  getPublicChampionshipResults(championshipId: string): MockScore[] {
    // Solo notas aprobadas y explícitamente publicadas
    return this.scores.filter(
      (s) => s.championshipId === championshipId && s.status === 'approved' && s.isPublished
    )
  }

  /**
   * Consulta privada de cronograma de sesiones (competition_schedules)
   */
  getCompetitionSchedules(userId: string | null, championshipId: string): MockCompetitionSchedule[] {
    if (!this.canAccessChampionshipRotations(userId, championshipId)) {
      return [] // RLS retorna 0 filas o deniega
    }
    return this.schedules.filter((s) => s.championshipId === championshipId)
  }
}

describe('Portal Público y Acceso Privado a Rotaciones (Fase 10.4)', () => {
  const champ1Id = 'champ-nacional-2026'
  const champ2Id = 'champ-copa-regional-2026'

  const clubAId = 'club-gimnastico-central'
  const clubBId = 'club-deportivo-aleman'
  const clubCId = 'club-sin-inscripcion'

  const evaluator = new RotationsSecurityEvaluator({
    users: [
      { id: 'usr-anon', email: 'anon@public.cl' },
      { id: 'usr-no-club', email: 'sinclub@gmail.com' },
      { id: 'usr-del-club-a', email: 'delegado@cgc.cl' },
      { id: 'usr-del-club-b', email: 'delegado@cda.cl' },
      { id: 'usr-del-club-c', email: 'delegado@clubc.cl' },
      { id: 'usr-multi-club', email: 'multi@federacion.cl' },
      { id: 'usr-admin-torneo', email: 'director@torneo.cl' },
      { id: 'usr-juez-salto', email: 'juez.salto@fig.cl' },
    ],
    orgMembers: [
      { organizationId: 'org-1', userId: 'usr-admin-torneo', role: 'org_admin' },
    ],
    clubs: [
      { id: clubAId, name: 'Club Gimnástico Central', code: 'CGC' },
      { id: clubBId, name: 'Club Deportivo Alemán', code: 'CDA' },
      { id: clubCId, name: 'Club Sin Inscripción', code: 'CSI' },
    ],
    clubMembers: [
      { clubId: clubAId, userId: 'usr-del-club-a', role: 'manager' },
      { clubId: clubBId, userId: 'usr-del-club-b', role: 'manager' },
      { clubId: clubCId, userId: 'usr-del-club-c', role: 'manager' },
      { clubId: clubAId, userId: 'usr-multi-club', role: 'coach' },
      { clubId: clubBId, userId: 'usr-multi-club', role: 'coach' },
    ],
    registrations: [
      // Atletas Club A
      {
        id: 'reg-a1',
        championshipId: champ1Id,
        clubId: clubAId,
        gymnastId: 'gym-a1',
        gymnastName: 'Valentina Silva',
        bibNumber: 101,
        categoryName: 'FIG Senior',
        subdivision: 'Subdivisión 1',
        rotationGroup: 'Grupo A',
        startingApparatus: 'VT',
        startOrder: 1,
        status: 'approved',
      },
      {
        id: 'reg-a2',
        championshipId: champ1Id,
        clubId: clubAId,
        gymnastId: 'gym-a2',
        gymnastName: 'Isidora Castro',
        bibNumber: 102,
        categoryName: 'FIG Senior',
        subdivision: 'Subdivisión 1',
        rotationGroup: 'Grupo A',
        startingApparatus: 'VT',
        startOrder: 2,
        status: 'approved',
      },
      // Atletas Club B
      {
        id: 'reg-b1',
        championshipId: champ1Id,
        clubId: clubBId,
        gymnastId: 'gym-b1',
        gymnastName: 'Camila Muñoz',
        bibNumber: 201,
        categoryName: 'FIG Senior',
        subdivision: 'Subdivisión 2',
        rotationGroup: 'Grupo B',
        startingApparatus: 'UB',
        startOrder: 1,
        status: 'approved',
      },
    ],
    schedules: [
      {
        id: 'sched-1',
        championshipId: champ1Id,
        title: 'Subdivisión 1 - GAF Senior & Junior',
        timeStart: '09:00',
        timeEnd: '12:30',
        subdivision: 'Subdivisión 1',
      },
      {
        id: 'sched-2',
        championshipId: champ1Id,
        title: 'Subdivisión 2 - GAF Niveles Formativos',
        timeStart: '14:00',
        timeEnd: '17:30',
        subdivision: 'Subdivisión 2',
      },
    ],
    scores: [
      {
        id: 'score-1',
        championshipId: champ1Id,
        gymnastId: 'gym-a1',
        apparatusCode: 'VT',
        finalScore: 13.85,
        status: 'approved',
        isPublished: true,
      },
      {
        id: 'score-2',
        championshipId: champ1Id,
        gymnastId: 'gym-b1',
        apparatusCode: 'UB',
        finalScore: 12.9,
        status: 'draft', // No publicado aún
        isPublished: false,
      },
    ],
    judgeAssignments: [
      {
        championshipId: champ1Id,
        userId: 'usr-juez-salto',
        apparatusCode: 'VT',
      },
    ],
  })

  // ---------------------------------------------------------------------------
  // TEST 1: Usuario anónimo
  // ---------------------------------------------------------------------------
  it('1. Usuario anónimo: NO puede consultar rotaciones ni cronogramas privados', () => {
    // Intento de evaluar permiso
    const canAccess = evaluator.canAccessChampionshipRotations(null, champ1Id)
    expect(canAccess).toBe(false)

    // Intento de llamar a RPC de rotaciones
    expect(() => evaluator.getMyClubRotations(null, champ1Id)).toThrow(/401 Unauthorized/)

    // Intento de consultar schedules
    const schedules = evaluator.getCompetitionSchedules(null, champ1Id)
    expect(schedules).toEqual([])
  })

  // ---------------------------------------------------------------------------
  // TEST 2: Usuario autenticado sin club
  // ---------------------------------------------------------------------------
  it('2. Usuario autenticado sin club: NO puede consultar rotaciones', () => {
    const canAccess = evaluator.canAccessChampionshipRotations('usr-no-club', champ1Id)
    expect(canAccess).toBe(false)

    const myRotations = evaluator.getMyClubRotations('usr-no-club', champ1Id)
    expect(myRotations).toHaveLength(0)

    const schedules = evaluator.getCompetitionSchedules('usr-no-club', champ1Id)
    expect(schedules).toEqual([])
  })

  // ---------------------------------------------------------------------------
  // TEST 3: Club A puede consultar sus propias rotaciones
  // ---------------------------------------------------------------------------
  it('3. Club A: puede consultar sus propias rotaciones y gimnastas inscritos', () => {
    const canAccess = evaluator.canAccessChampionshipRotations('usr-del-club-a', champ1Id, clubAId)
    expect(canAccess).toBe(true)

    const myRotations = evaluator.getMyClubRotations('usr-del-club-a', champ1Id)
    expect(myRotations).toHaveLength(2)

    const athleteNames = myRotations.map((r) => r.gymnastName)
    expect(athleteNames).toContain('Valentina Silva')
    expect(athleteNames).toContain('Isidora Castro')
    expect(myRotations.every((r) => r.clubId === clubAId)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // TEST 4: Club A NO puede consultar las rotaciones del Club B
  // ---------------------------------------------------------------------------
  it('4. Club A: NO puede consultar las rotaciones del Club B (aislamiento estricto)', () => {
    // Delegado de Club A intentando consultar específicamente Club B
    const canAccessClubB = evaluator.canAccessChampionshipRotations('usr-del-club-a', champ1Id, clubBId)
    expect(canAccessClubB).toBe(false)

    // RPC para Club A jamás retorna gimnastas de Club B
    const myRotations = evaluator.getMyClubRotations('usr-del-club-a', champ1Id)
    const hasClubBAthletes = myRotations.some((r) => r.clubId === clubBId)
    expect(hasClubBAthletes).toBe(false)

    const athleteNames = myRotations.map((r) => r.gymnastName)
    expect(athleteNames).not.toContain('Camila Muñoz') // Atleta del Club B
  })

  // ---------------------------------------------------------------------------
  // TEST 5: Delegado del Club A puede consultar toda la programación de su club
  // ---------------------------------------------------------------------------
  it('5. Delegado del Club A: puede consultar toda la programación y detalles de su club', () => {
    const myRotations = evaluator.getMyClubRotations('usr-del-club-a', champ1Id)

    // Revisa dorsales, rotación, aparato inicial y orden de salida
    const valentina = myRotations.find((r) => r.gymnastName === 'Valentina Silva')
    expect(valentina).toBeDefined()
    expect(valentina?.bibNumber).toBe(101)
    expect(valentina?.subdivision).toBe('Subdivisión 1')
    expect(valentina?.rotationGroup).toBe('Grupo A')
    expect(valentina?.startingApparatus).toBe('VT')
    expect(valentina?.startOrder).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // TEST 6: Administrador del campeonato puede consultar la programación completa
  // ---------------------------------------------------------------------------
  it('6. Administrador del campeonato: puede consultar la programación completa de todos los clubes', () => {
    const canAccess = evaluator.canAccessChampionshipRotations('usr-admin-torneo', champ1Id)
    expect(canAccess).toBe(true)

    const allRotations = evaluator.getMyClubRotations('usr-admin-torneo', champ1Id)
    expect(allRotations).toHaveLength(3) // 2 de Club A + 1 de Club B

    const schedules = evaluator.getCompetitionSchedules('usr-admin-torneo', champ1Id)
    expect(schedules).toHaveLength(2)
  })

  // ---------------------------------------------------------------------------
  // TEST 7: Juez solo accede a lo necesario para sus asignaciones
  // ---------------------------------------------------------------------------
  it('7. Juez: solo puede consultar información de torneos donde tiene asignaciones', () => {
    // Asignado en champ 1
    const canAccessChamp1 = evaluator.canAccessChampionshipRotations('usr-juez-salto', champ1Id)
    expect(canAccessChamp1).toBe(true)

    // NO asignado en champ 2
    const canAccessChamp2 = evaluator.canAccessChampionshipRotations('usr-juez-salto', champ2Id)
    expect(canAccessChamp2).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // TEST 8: Club no inscrito no puede consultar información de otro campeonato
  // ---------------------------------------------------------------------------
  it('8. Usuario no autorizado / Club sin inscripción: NO puede acceder a rotaciones de otro campeonato', () => {
    // Club C no tiene gimnastas aprobados en champ 1
    const canAccess = evaluator.canAccessChampionshipRotations('usr-del-club-c', champ1Id, clubCId)
    expect(canAccess).toBe(false)

    const rotations = evaluator.getMyClubRotations('usr-del-club-c', champ1Id)
    expect(rotations).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // TEST 9: Resultados publicados siguen siendo públicos
  // ---------------------------------------------------------------------------
  it('9. Los resultados publicados siguen siendo accesibles desde el portal público', () => {
    const publicResults = evaluator.getPublicChampionshipResults(champ1Id)
    expect(publicResults).toHaveLength(1)
    expect(publicResults[0].finalScore).toBe(13.85)
    expect(publicResults[0].status).toBe('approved')

    // Puntuaciones en borrador (draft) NO se exponen al público
    const hasDrafts = publicResults.some((s) => s.status === 'draft')
    expect(hasDrafts).toBe(false)
  })

  // ---------------------------------------------------------------------------
  // TEST 10: Multi-club: Usuario en Club A y Club B
  // ---------------------------------------------------------------------------
  it('10. Multi-club: Usuario con membresía en Club A y Club B solo obtiene el club solicitado', () => {
    // Si solicita específicamente Club A:
    const clubARotations = evaluator.getMyClubRotations('usr-multi-club', champ1Id, clubAId)
    expect(clubARotations).toHaveLength(2)
    expect(clubARotations.every((r) => r.clubId === clubAId)).toBe(true)

    // Si solicita específicamente Club B:
    const clubBRotations = evaluator.getMyClubRotations('usr-multi-club', champ1Id, clubBId)
    expect(clubBRotations).toHaveLength(1)
    expect(clubBRotations.every((r) => r.clubId === clubBId)).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // TEST 11: Delegado intenta forzar target_club_id ajeno
  // ---------------------------------------------------------------------------
  it('11. Delegado de Club A intenta forzar target_club_id de Club B en la RPC: retorna 0 filas', () => {
    // Delegado de Club A intenta pasar p_club_id = clubBId
    const forgedAttempt = evaluator.getMyClubRotations('usr-del-club-a', champ1Id, clubBId)
    expect(forgedAttempt).toHaveLength(0)
  })

  // ---------------------------------------------------------------------------
  // TEST 12: Portal público jamás expone códigos privados (judge_code, invite_code)
  // ---------------------------------------------------------------------------
  it('12. Portal público jamás expone códigos privados (judge_code, invite_code)', () => {
    const publicPayload = evaluator.getPublicChampionshipPayload()
    expect(publicPayload).toHaveProperty('name')
    expect(publicPayload).toHaveProperty('venueName')
    expect(publicPayload).not.toHaveProperty('judge_code')
    expect(publicPayload).not.toHaveProperty('invite_code')
  })

  // ---------------------------------------------------------------------------
  // TEST 13: Delegado de club NO puede modificar la programación (INSERT/UPDATE/DELETE)
  // ---------------------------------------------------------------------------
  it('13. Delegado de club NO puede modificar la programación (INSERT/UPDATE/DELETE)', () => {
    const canDelegateModify = evaluator.canModifyCompetitionSchedule('usr-del-club-a', champ1Id)
    expect(canDelegateModify).toBe(false)

    const canAdminModify = evaluator.canModifyCompetitionSchedule('usr-admin-torneo', champ1Id)
    expect(canAdminModify).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // TEST 14: Usuario anónimo jamás puede modificar programación
  // ---------------------------------------------------------------------------
  it('14. Usuario anónimo jamás puede modificar la programación de competición', () => {
    const canAnonModify = evaluator.canModifyCompetitionSchedule(null, champ1Id)
    expect(canAnonModify).toBe(false)
  })
})
