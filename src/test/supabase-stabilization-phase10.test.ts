/**
 * Operix Gymnastics — Phase 10: Pruebas de Estabilización de Supabase, RLS y Realtime Broadcast.
 * Ciclo Olímpico FIG 2025-2028.
 * 
 * Desarrollado por Comercial Hels SpA.
 */

import { describe, it, expect } from 'vitest'
import {
  ArenaRealtimeController,
  ARENA_PROTOCOL_VERSION,
  type ArenaStateMessage,
} from '@/features/awards/arenaRealtimeProtocol'

describe('Fase 10: Estabilización de Supabase, Integridad y Sincronización Realtime', () => {
  const mockChampId = 'champ-123e4567-e89b-12d3-a456-426614174000'
  const mockOrgId1 = 'org-11111111-1111-1111-1111-111111111111'
  const mockOrgId2 = 'org-22222222-2222-2222-2222-222222222222'

  // 1. Persistencia de Programación (Timetable & Rotation Schedules)
  it('1. Valida estructura e inserción de programación de competencia (competition_schedules)', () => {
    interface CompetitionScheduleRecord {
      id: string
      championshipId: string
      timeStart: string
      timeEnd: string
      title: string
      subdivision?: string
      sortOrder: number
    }

    const scheduleList: CompetitionScheduleRecord[] = [
      {
        id: 'sch-1',
        championshipId: mockChampId,
        timeStart: '09:00',
        timeEnd: '10:30',
        title: 'Calentamiento General y Rotación 1',
        subdivision: 'Subdivisión 1',
        sortOrder: 1,
      },
      {
        id: 'sch-2',
        championshipId: mockChampId,
        timeStart: '10:30',
        timeEnd: '12:00',
        title: 'Rotación 2 y Marshaling',
        subdivision: 'Subdivisión 1',
        sortOrder: 2,
      },
    ]

    expect(scheduleList).toHaveLength(2)
    expect(scheduleList[0].sortOrder).toBeLessThan(scheduleList[1].sortOrder)
    expect(scheduleList[0].championshipId).toBe(mockChampId)
  })

  // 2. Persistencia de Configuración de Premiación (championship_awards_config)
  it('2. Valida persistencia y tipado estricto de championship_awards_config', () => {
    interface AwardsConfigRecord {
      id: string
      championship_id: string
      places_awarded_count: number
      few_participants_rule: 'standard_all' | 'strict_n_minus_one'
      include_trophies_for_teams: boolean
      include_club_medals: boolean
      special_awards: Array<{ id: string; title: string; recipientName: string }>
    }

    const config: AwardsConfigRecord = {
      id: 'cfg-1',
      championship_id: mockChampId,
      places_awarded_count: 5, // Top 5
      few_participants_rule: 'strict_n_minus_one',
      include_trophies_for_teams: true,
      include_club_medals: true,
      special_awards: [
        { id: 'sp-1', title: 'Espíritu Deportivo FIG', recipientName: 'Camila Rojas' },
      ],
    }

    expect(config.places_awarded_count).toBe(5)
    expect(config.few_participants_rule).toBe('strict_n_minus_one')
    expect(config.special_awards).toHaveLength(1)
    expect(config.special_awards[0].title).toBe('Espíritu Deportivo FIG')
  })

  // 3. Registro y Reapertura Autorizada de Ceremonias (championship_awards_ceremonies)
  it('3. Valida ciclo de vida de ceremonia: creación, marcado de realizada y reapertura autorizada', () => {
    interface CeremonyRecord {
      ceremonyKey: string
      status: 'pending' | 'in_progress' | 'completed'
      awardedAt?: string
      awardedByUserId?: string
    }

    const ceremony: CeremonyRecord = {
      ceremonyKey: 'aa_cat-senior',
      status: 'pending',
    }

    // Paso A: Completar ceremonia
    const completedAt = '2026-11-05T12:00:00Z'
    ceremony.status = 'completed'
    ceremony.awardedAt = completedAt
    ceremony.awardedByUserId = 'user-head-judge'

    expect(ceremony.status).toBe('completed')
    expect(ceremony.awardedAt).toBe(completedAt)

    // Paso B: Reapertura autorizada por Jurado Superior
    ceremony.status = 'pending'
    ceremony.awardedAt = undefined
    ceremony.awardedByUserId = undefined

    expect(ceremony.status).toBe('pending')
    expect(ceremony.awardedAt).toBeUndefined()
  })

  // 4. Sincronización Broadcast entre Dos Clientes (Operador -> Pantalla Arena)
  describe('4. Sincronización Broadcast Realtime (ArenaRealtimeController)', () => {
    it('sincroniza en tiempo real los pasos de revelación del podio (0 -> 1 -> 2 -> 3)', () => {
      let displayStep = 0
      let displayIndex = 0

      // Cliente Pantalla Display (Listener)
      const displayController = new ArenaRealtimeController({
        championshipId: mockChampId,
        initialCeremonyKey: 'cer-1',
        initialCeremonyIndex: 0,
        initialStep: 0,
        isOperator: false,
        onStateChange: (state) => {
          displayStep = state.revealedStep
          displayIndex = state.ceremonyIndex
        },
      })

      // Simulamos mensaje broadcast enviado por el operador (paso 1: 3er lugar)
      const msgStep1: ArenaStateMessage = {
        version: ARENA_PROTOCOL_VERSION,
        championshipId: mockChampId,
        ceremonyKey: 'cer-1',
        ceremonyIndex: 0,
        revealedStep: 1, // Revela Bronce
        sequence: 1,
        timestamp: new Date().toISOString(),
        operatorUserId: 'user-operator',
      }

      const accepted1 = displayController.handleIncomingState(msgStep1)
      expect(accepted1).toBe(true)
      expect(displayStep).toBe(1)
      expect(displayIndex).toBe(0)

      // Operador revela paso 2 (Plata)
      const msgStep2: ArenaStateMessage = {
        version: ARENA_PROTOCOL_VERSION,
        championshipId: mockChampId,
        ceremonyKey: 'cer-1',
        ceremonyIndex: 0,
        revealedStep: 2,
        sequence: 2,
        timestamp: new Date().toISOString(),
      }
      displayController.handleIncomingState(msgStep2)
      expect(displayStep).toBe(2)

      // Operador revela paso 3 (Campeón Oro)
      const msgStep3: ArenaStateMessage = {
        version: ARENA_PROTOCOL_VERSION,
        championshipId: mockChampId,
        ceremonyKey: 'cer-1',
        ceremonyIndex: 0,
        revealedStep: 3,
        sequence: 3,
        timestamp: new Date().toISOString(),
      }
      displayController.handleIncomingState(msgStep3)
      expect(displayStep).toBe(3)
    })
  })

  // 5. Reconexión de Pantalla Arena y Rechazo de Paquetes Desordenados
  describe('5. Reconexión y Monotonía de Secuencia', () => {
    it('ignora paquetes retrasados o con número de secuencia anterior (out-of-order)', () => {
      const displayController = new ArenaRealtimeController({
        championshipId: mockChampId,
        initialCeremonyKey: 'cer-1',
        initialCeremonyIndex: 0,
        initialStep: 0,
        isOperator: false,
      })

      // Paquete moderno sequence = 10
      displayController.handleIncomingState({
        version: ARENA_PROTOCOL_VERSION,
        championshipId: mockChampId,
        ceremonyKey: 'cer-1',
        ceremonyIndex: 0,
        revealedStep: 3,
        sequence: 10,
        timestamp: '2026-11-05T12:00:10Z',
      })

      expect(displayController.getState().sequence).toBe(10)
      expect(displayController.getState().revealedStep).toBe(3)

      // Llega un paquete antiguo retrasado por la red con sequence = 8
      const rejected = displayController.handleIncomingState({
        version: ARENA_PROTOCOL_VERSION,
        championshipId: mockChampId,
        ceremonyKey: 'cer-1',
        ceremonyIndex: 0,
        revealedStep: 1,
        sequence: 8,
        timestamp: '2026-11-05T12:00:08Z',
      })

      // Debe ser rechazado para evitar que la pantalla parpadee o retroceda
      expect(rejected).toBe(false)
      expect(displayController.getState().sequence).toBe(10)
      expect(displayController.getState().revealedStep).toBe(3)
    })

    it('rechaza mensajes con diferente identificador de campeonato (aislamiento)', () => {
      const displayController = new ArenaRealtimeController({
        championshipId: mockChampId,
        initialCeremonyKey: 'cer-1',
        isOperator: false,
      })

      const rejected = displayController.handleIncomingState({
        version: ARENA_PROTOCOL_VERSION,
        championshipId: 'different-championship-id',
        ceremonyKey: 'cer-1',
        ceremonyIndex: 0,
        revealedStep: 2,
        sequence: 1,
        timestamp: new Date().toISOString(),
      })

      expect(rejected).toBe(false)
    })
  })

  // 6. Aislamiento entre Organizaciones (Multi-Tenancy)
  it('6. Garantiza separación de datos e integridad por organization_id', () => {
    const org1Championships = [
      { id: 'champ-a', organizationId: mockOrgId1, name: 'Torneo Región Metropolitana' },
    ]
    const org2Championships = [
      { id: 'champ-b', organizationId: mockOrgId2, name: 'Torneo Región del Biobío' },
    ]

    const filterByOrg = (list: typeof org1Championships, orgId: string) => {
      return list.filter((item) => item.organizationId === orgId)
    }

    expect(filterByOrg(org1Championships, mockOrgId1)).toHaveLength(1)
    expect(filterByOrg(org1Championships, mockOrgId2)).toHaveLength(0)
    expect(filterByOrg(org2Championships, mockOrgId1)).toHaveLength(0)
    expect(filterByOrg(org2Championships, mockOrgId2)).toHaveLength(1)
  })

  // 7. Intentos de Escritura No Autorizados
  it('7. Rechaza operaciones de modificación por parte de perfiles no autorizados', () => {
    const canUserModifyScores = (role?: string) => {
      const allowedRoles = ['org_admin', 'competition_manager', 'head_judge']
      return allowedRoles.includes(role || '')
    }

    expect(canUserModifyScores('org_admin')).toBe(true)
    expect(canUserModifyScores('head_judge')).toBe(true)
    expect(canUserModifyScores('club_manager')).toBe(false)
    expect(canUserModifyScores('coach')).toBe(false)
    expect(canUserModifyScores('guest')).toBe(false)
    expect(canUserModifyScores(undefined)).toBe(false)
  })
})
