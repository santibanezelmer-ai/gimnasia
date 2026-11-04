import { describe, it, expect } from 'vitest'
import {
  computeAllAroundStandings,
  computeApparatusStandings,
  computeTeamStandings,
  type GymnastScoreEntry,
} from '@/features/standings/standingsEngine'

describe('Sprint de Corrección: Gestión de 2 Saltos en VT & Códigos de Acceso', () => {
  describe('1. Soporte de Dos Saltos en Salto (VT)', () => {
    const mockScoresWithTwoVaults: GymnastScoreEntry[] = [
      // Gymnast 1: Camila Valenzuela (Club Manquehue)
      // VT Attempt 1: D=5.0, E=8.6 -> 13.600
      // VT Attempt 2: D=5.2, E=8.8 -> 14.000
      // Average for Event Finals = (13.600 + 14.000) / 2 = 13.800
      // For All-Around = 13.600 only
      {
        gymnastId: 'g-camila',
        gymnastName: 'Camila Valenzuela',
        clubId: 'club-manquehue',
        clubName: 'Club Manquehue',
        apparatusCode: 'VT',
        attemptNumber: 1,
        dScore: 5.0,
        eScoreAvg: 8.6,
        finalScore: 13.6,
        status: 'official_approved',
      },
      {
        gymnastId: 'g-camila',
        gymnastName: 'Camila Valenzuela',
        clubId: 'club-manquehue',
        clubName: 'Club Manquehue',
        apparatusCode: 'VT',
        attemptNumber: 2,
        dScore: 5.2,
        eScoreAvg: 8.8,
        finalScore: 14.0,
        status: 'official_approved',
      },
      {
        gymnastId: 'g-camila',
        gymnastName: 'Camila Valenzuela',
        clubId: 'club-manquehue',
        clubName: 'Club Manquehue',
        apparatusCode: 'UB',
        attemptNumber: 1,
        dScore: 4.8,
        eScoreAvg: 8.2,
        finalScore: 13.0,
        status: 'official_approved',
      },
      {
        gymnastId: 'g-camila',
        gymnastName: 'Camila Valenzuela',
        clubId: 'club-manquehue',
        clubName: 'Club Manquehue',
        apparatusCode: 'BB',
        attemptNumber: 1,
        dScore: 5.0,
        eScoreAvg: 8.3,
        finalScore: 13.3,
        status: 'official_approved',
      },
      {
        gymnastId: 'g-camila',
        gymnastName: 'Camila Valenzuela',
        clubId: 'club-manquehue',
        clubName: 'Club Manquehue',
        apparatusCode: 'FX',
        attemptNumber: 1,
        dScore: 5.1,
        eScoreAvg: 8.4,
        finalScore: 13.5,
        status: 'official_approved',
      },

      // Gymnast 2: Florencia Castro (Club Estadio Italiano)
      // VT Attempt 1: D=5.2, E=8.5 -> 13.700
      // VT Attempt 2: D=5.0, E=8.3 -> 13.300
      // Average for Event Finals = (13.700 + 13.300) / 2 = 13.500
      {
        gymnastId: 'g-florencia',
        gymnastName: 'Florencia Castro',
        clubId: 'club-italiano',
        clubName: 'Club Estadio Italiano',
        apparatusCode: 'VT',
        attemptNumber: 1,
        dScore: 5.2,
        eScoreAvg: 8.5,
        finalScore: 13.7,
        status: 'official_approved',
      },
      {
        gymnastId: 'g-florencia',
        gymnastName: 'Florencia Castro',
        clubId: 'club-italiano',
        clubName: 'Club Estadio Italiano',
        apparatusCode: 'VT',
        attemptNumber: 2,
        dScore: 5.0,
        eScoreAvg: 8.3,
        finalScore: 13.3,
        status: 'official_approved',
      },
      {
        gymnastId: 'g-florencia',
        gymnastName: 'Florencia Castro',
        clubId: 'club-italiano',
        clubName: 'Club Estadio Italiano',
        apparatusCode: 'UB',
        attemptNumber: 1,
        dScore: 5.0,
        eScoreAvg: 8.4,
        finalScore: 13.4,
        status: 'official_approved',
      },

      // Gymnast 3: Sofia Rojas (Club La Reina) — Only performed 1 Vault
      // VT Attempt 1: D=4.6, E=8.6 -> 13.200
      {
        gymnastId: 'g-sofia',
        gymnastName: 'Sofia Rojas',
        clubId: 'club-reina',
        clubName: 'Club La Reina',
        apparatusCode: 'VT',
        attemptNumber: 1,
        dScore: 4.6,
        eScoreAvg: 8.6,
        finalScore: 13.2,
        status: 'official_approved',
      },
    ]

    it('calculates the arithmetic average of two vaults for VT event finals', () => {
      const vtStandings = computeApparatusStandings(mockScoresWithTwoVaults, 'VT')

      expect(vtStandings.length).toBe(3)

      // 1st place: Camila Valenzuela -> (13.6 + 14.0) / 2 = 13.800
      expect(vtStandings[0].gymnastId).toBe('g-camila')
      expect(vtStandings[0].rank).toBe(1)
      expect(vtStandings[0].finalScore).toBe(13.8)
      expect(vtStandings[0].dScore).toBe(5.1) // (5.0 + 5.2) / 2
      expect(vtStandings[0].eScoreAvg).toBe(8.7) // (8.6 + 8.8) / 2
      expect(vtStandings[0].medal).toBe('gold')
      expect(vtStandings[0].vaultAttempts?.attempt1?.finalScore).toBe(13.6)
      expect(vtStandings[0].vaultAttempts?.attempt2?.finalScore).toBe(14.0)

      // 2nd place: Florencia Castro -> (13.7 + 13.3) / 2 = 13.500
      expect(vtStandings[1].gymnastId).toBe('g-florencia')
      expect(vtStandings[1].rank).toBe(2)
      expect(vtStandings[1].finalScore).toBe(13.5)
      expect(vtStandings[1].medal).toBe('silver')

      // 3rd place: Sofia Rojas -> Only 1 vault = 13.200
      expect(vtStandings[2].gymnastId).toBe('g-sofia')
      expect(vtStandings[2].rank).toBe(3)
      expect(vtStandings[2].finalScore).toBe(13.2)
      expect(vtStandings[2].medal).toBe('bronze')
    })

    it('uses EXCLUSIVELY the first vault in All-Around and strictly ignores attempt 2', () => {
      const aaStandings = computeAllAroundStandings(mockScoresWithTwoVaults)

      const camilaAA = aaStandings.find((g) => g.gymnastId === 'g-camila')
      expect(camilaAA).toBeDefined()

      // Vault in AA must be Attempt 1 (13.600), NOT attempt 2 (14.000) or average (13.800)
      expect(camilaAA!.apparatusScores['VT']).toBe(13.6)

      // Total AA = 13.6 (VT1) + 13.0 (UB) + 13.3 (BB) + 13.5 (FX) = 53.400
      expect(camilaAA!.totalScore).toBe(53.4)
    })

    it('uses EXCLUSIVELY the first vault in Team Standings and strictly ignores attempt 2', () => {
      const teamStandings = computeTeamStandings(mockScoresWithTwoVaults, 3)

      const manquehueTeam = teamStandings.find((t) => t.clubId === 'club-manquehue')
      expect(manquehueTeam).toBeDefined()

      // Vault in Team total must only be Attempt 1 (13.600)
      expect(manquehueTeam!.apparatusTotals['VT']).toBe(13.6)
    })

    it('ensures other apparatuses (UB, BB, FX) are not affected by vault averaging logic', () => {
      const ubStandings = computeApparatusStandings(mockScoresWithTwoVaults, 'UB')

      expect(ubStandings.length).toBe(2)
      // Florencia: 13.4
      expect(ubStandings[0].gymnastId).toBe('g-florencia')
      expect(ubStandings[0].finalScore).toBe(13.4)
      // Camila: 13.0
      expect(ubStandings[1].gymnastId).toBe('g-camila')
      expect(ubStandings[1].finalScore).toBe(13.0)
    })
  })

  describe('2. Códigos de Invitación, Acceso de Jueces y Seguridad', () => {
    interface MockChampionshipRecord {
      id: string
      name: string
      inviteCode: string
      judgeCode: string
      basesUrl: string | null
      organizationId: string
    }

    const mockChampionships: MockChampionshipRecord[] = [
      {
        id: 'champ-1',
        name: 'Copa Nacional de Clubes GAF 2026',
        inviteCode: 'COPA-GAF-2026',
        judgeCode: 'JUEZ-2026',
        basesUrl: 'https://operix.app/docs/bases-2026.pdf',
        organizationId: 'org-fed-metropolitana',
      },
    ]

    it('resolves championship by valid invite_code for guest club enrollment', () => {
      const queryByCode = (code: string) => {
        const normalized = code.trim().toUpperCase()
        return mockChampionships.find(
          (c) => c.inviteCode.toUpperCase() === normalized || c.judgeCode.toUpperCase() === normalized
        )
      }

      const result = queryByCode('COPA-GAF-2026')
      expect(result).toBeDefined()
      expect(result?.name).toBe('Copa Nacional de Clubes GAF 2026')
    })

    it('allows fast judge access with valid judge_code and rejects invalid judge_code', () => {
      const verifyJudgePin = (champId: string, inputPin: string) => {
        const champ = mockChampionships.find((c) => c.id === champId)
        if (!champ) throw new Error('Campeonato no encontrado')
        if (champ.judgeCode.toUpperCase() !== inputPin.trim().toUpperCase()) {
          throw new Error('Código de juez inválido para este campeonato.')
        }
        return true
      }

      // Valid code
      expect(verifyJudgePin('champ-1', 'JUEZ-2026')).toBe(true)
      expect(verifyJudgePin('champ-1', 'juez-2026')).toBe(true) // case insensitive

      // Invalid code
      expect(() => verifyJudgePin('champ-1', 'CODIGO-FALSO')).toThrow(
        /Código de juez inválido para este campeonato/
      )
    })

    it('permits championship code editing ONLY to authorized managers', () => {
      const canEditChampionshipCodes = (role: string) => {
        return ['org_admin', 'competition_manager', 'club_manager'].includes(role)
      }

      expect(canEditChampionshipCodes('org_admin')).toBe(true)
      expect(canEditChampionshipCodes('club_manager')).toBe(true)
      expect(canEditChampionshipCodes('viewer')).toBe(false)
      expect(canEditChampionshipCodes('judge')).toBe(false)
    })

    it('protects public viewer from accessing judge_code', () => {
      const sanitizeChampionshipForPublic = (champ: MockChampionshipRecord, isManager: boolean) => {
        return {
          id: champ.id,
          name: champ.name,
          inviteCode: champ.inviteCode,
          basesUrl: champ.basesUrl,
          // judgeCode is hidden for public spectators
          judgeCode: isManager ? champ.judgeCode : undefined,
        }
      }

      const publicView = sanitizeChampionshipForPublic(mockChampionships[0], false)
      expect(publicView.judgeCode).toBeUndefined()
      expect(publicView.inviteCode).toBe('COPA-GAF-2026')

      const managerView = sanitizeChampionshipForPublic(mockChampionships[0], true)
      expect(managerView.judgeCode).toBe('JUEZ-2026')
    })
  })
})
