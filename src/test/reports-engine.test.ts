import { describe, it, expect } from 'vitest'
import {
  filterApprovedScores,
  computeClubMedalTally,
  generateDiplomaAwardItems,
  exportAllAroundToCsv,
  exportApparatusToCsv,
  compileOfficialMinutes,
} from '../features/reports/reportsEngine'
import type { GymnastScoreEntry, AllAroundStanding, ApparatusStanding, TeamStanding } from '../features/standings/standingsEngine'
import type { MarshalingAthlete } from '../features/schedule/rotationEngine'
import type { Championship } from '../core/types/championship'

describe('Operix Reports Engine — Phase 8 Official Documentation', () => {
  describe('Rule of Integrity: Score Approval Filtering', () => {
    const rawScores: GymnastScoreEntry[] = [
      {
        gymnastId: 'g1',
        gymnastName: 'Atleta 1',
        clubId: 'c1',
        clubName: 'Club 1',
        apparatusCode: 'VT',
        dScore: 5.0,
        eScoreAvg: 8.5,
        finalScore: 13.5,
        status: 'official_approved',
      },
      {
        gymnastId: 'g2',
        gymnastName: 'Atleta 2 (Provisional)',
        clubId: 'c1',
        clubName: 'Club 1',
        apparatusCode: 'VT',
        dScore: 4.8,
        eScoreAvg: 8.2,
        finalScore: 13.0,
        status: 'provisional',
      },
      {
        gymnastId: 'g3',
        gymnastName: 'Atleta 3 (Borrador)',
        clubId: 'c2',
        clubName: 'Club 2',
        apparatusCode: 'VT',
        dScore: 5.2,
        eScoreAvg: 8.1,
        finalScore: 13.3,
        status: 'draft',
      },
      {
        gymnastId: 'g4',
        gymnastName: 'Atleta 4 (Enviado sin visar)',
        clubId: 'c2',
        clubName: 'Club 2',
        apparatusCode: 'VT',
        dScore: 5.1,
        eScoreAvg: 8.0,
        finalScore: 13.1,
        status: 'submitted',
      },
    ]

    it('strictly excludes non-approved scores in official documentation', () => {
      const approvedOnly = filterApprovedScores(rawScores, false)
      expect(approvedOnly).toHaveLength(1)
      expect(approvedOnly[0].gymnastId).toBe('g1')
      expect(approvedOnly[0].status).toBe('official_approved')
    })

    it('allows provisional scores only when explicitly requested with flag', () => {
      const withProvisional = filterApprovedScores(rawScores, true)
      expect(withProvisional).toHaveLength(2)
      expect(withProvisional.map((s) => s.status)).toEqual(['official_approved', 'provisional'])
    })
  })

  describe('Club Medal Tally (Medallero Olímpico)', () => {
    const mockAA: AllAroundStanding[] = [
      {
        rank: 1,
        gymnastId: 'g1',
        gymnastName: 'Gimnasta Oro AA',
        clubId: 'club-a',
        clubName: 'Club Alfa',
        apparatusScores: { VT: 14.0 },
        totalScore: 54.0,
        totalEScore: 34.0,
        medal: 'gold',
      },
      {
        rank: 2,
        gymnastId: 'g2',
        gymnastName: 'Gimnasta Plata AA',
        clubId: 'club-b',
        clubName: 'Club Beta',
        apparatusScores: { VT: 13.8 },
        totalScore: 53.5,
        totalEScore: 33.5,
        medal: 'silver',
      },
    ]

    const mockApparatusLists: ApparatusStanding[][] = [
      // Salto VT
      [
        {
          rank: 1,
          apparatusCode: 'VT',
          gymnastId: 'g2',
          gymnastName: 'Gimnasta Oro VT',
          clubId: 'club-b',
          clubName: 'Club Beta',
          dScore: 5.2,
          eScoreAvg: 9.0,
          finalScore: 14.2,
          medal: 'gold',
        },
        {
          rank: 2,
          apparatusCode: 'VT',
          gymnastId: 'g1',
          gymnastName: 'Gimnasta Plata VT',
          clubId: 'club-a',
          clubName: 'Club Alfa',
          dScore: 5.0,
          eScoreAvg: 8.8,
          finalScore: 13.8,
          medal: 'silver',
        },
      ],
      // Viga BB
      [
        {
          rank: 1,
          apparatusCode: 'BB',
          gymnastId: 'g1',
          gymnastName: 'Gimnasta Oro BB',
          clubId: 'club-a',
          clubName: 'Club Alfa',
          dScore: 5.4,
          eScoreAvg: 8.9,
          finalScore: 14.3,
          medal: 'gold',
        },
      ],
    ]

    it('computes medal counts and ranks clubs by Gold -> Silver -> Bronze', () => {
      const tally = computeClubMedalTally(mockAA, mockApparatusLists)

      expect(tally).toHaveLength(2)
      // Club Alfa: 2 Gold (1 AA + 1 BB) + 1 Silver (VT) = 3 medals
      expect(tally[0].clubId).toBe('club-a')
      expect(tally[0].gold).toBe(2)
      expect(tally[0].silver).toBe(1)
      expect(tally[0].total).toBe(3)
      expect(tally[0].rank).toBe(1)

      // Club Beta: 1 Gold (VT) + 1 Silver (AA) = 2 medals
      expect(tally[1].clubId).toBe('club-b')
      expect(tally[1].gold).toBe(1)
      expect(tally[1].silver).toBe(1)
      expect(tally[1].total).toBe(2)
      expect(tally[1].rank).toBe(2)
    })
  })

  describe('Deduplicated Diploma Batch Generation', () => {
    const mockAA: AllAroundStanding[] = [
      {
        rank: 1,
        gymnastId: 'g1',
        gymnastName: 'Sofia Campeona',
        clubId: 'c1',
        clubName: 'Estadio Italiano',
        categoryName: 'FIG Senior',
        apparatusScores: { VT: 14.0 },
        totalScore: 54.0,
        totalEScore: 34.0,
        medal: 'gold',
      },
    ]

    const mockApparatus = [
      {
        apparatusCode: 'VT',
        apparatusName: 'Salto',
        standings: [
          {
            rank: 1,
            apparatusCode: 'VT',
            gymnastId: 'g1',
            gymnastName: 'Sofia Campeona',
            clubId: 'c1',
            clubName: 'Estadio Italiano',
            categoryName: 'FIG Senior',
            dScore: 5.2,
            eScoreAvg: 8.9,
            finalScore: 14.1,
            medal: 'gold' as const,
          },
        ],
      },
    ]

    const mockTeams: TeamStanding[] = [
      {
        rank: 1,
        clubId: 'c1',
        clubName: 'Estadio Italiano',
        totalScore: 155.0,
        apparatusTotals: { VT: 40.0 },
        participatingGymnastsCount: 3,
        trophy: '1st',
      },
    ]

    const mockAthletes: MarshalingAthlete[] = [
      {
        registrationId: 'r1',
        gymnastId: 'g1',
        gymnastName: 'Sofia Campeona',
        clubId: 'c1',
        clubName: 'Estadio Italiano',
        bibNumber: 101,
        categoryName: 'FIG Senior',
        rotationGroup: 'Grupo A',
        startingApparatus: 'VT',
        startOrder: 1,
      },
      {
        registrationId: 'r2',
        gymnastId: 'g2',
        gymnastName: 'Isidora Participante',
        clubId: 'c1',
        clubName: 'Estadio Italiano',
        bibNumber: 102,
        categoryName: 'FIG Senior',
        rotationGroup: 'Grupo A',
        startingApparatus: 'VT',
        startOrder: 2,
      },
    ]

    it('generates diplomas for podiums and participation without duplicates', () => {
      const diplomas = generateDiplomaAwardItems({
        allAroundStandings: mockAA,
        apparatusStandingsList: mockApparatus,
        teamStandings: mockTeams,
        allAthletes: mockAthletes,
        includeParticipation: true,
        includePodiums: true,
      })

      // Sofia gets:
      // 1. All-Around Gold
      // 2. Vault Gold
      // 3. Team Champion
      // 4. Participation diploma
      // Isidora gets:
      // 1. Team Champion
      // 2. Participation diploma
      expect(diplomas.length).toBe(6)

      const sofiaDiplomas = diplomas.filter((d) => d.gymnastId === 'g1')
      expect(sofiaDiplomas).toHaveLength(4)
      expect(sofiaDiplomas.map((d) => d.awardType)).toEqual([
        'gold',
        'gold',
        'team_champion',
        'participation',
      ])

      // Ensure no duplicate IDs exist
      const idSet = new Set(diplomas.map((d) => d.id))
      expect(idSet.size).toBe(diplomas.length)
    })
  })

  describe('Excel / CSV Export formatting', () => {
    it('prepends UTF-8 BOM and formats CSV correctly', () => {
      const mockStandings: AllAroundStanding[] = [
        {
          rank: 1,
          gymnastId: 'g1',
          gymnastName: 'Renata Gómez',
          clubId: 'c1',
          clubName: 'Club Viña del Mar',
          categoryName: 'Nivel 4',
          apparatusScores: { VT: 13.5, UB: 12.8, BB: 13.0, FX: 13.7 },
          totalScore: 53.0,
          totalEScore: 33.0,
          medal: 'gold',
        },
      ]

      const csv = exportAllAroundToCsv(mockStandings, ['VT', 'UB', 'BB', 'FX'])

      // Must start with UTF-8 BOM
      expect(csv.startsWith('\uFEFF')).toBe(true)
      // Must contain gymnast and club names quoted
      expect(csv).toContain('"Renata Gómez"')
      expect(csv).toContain('"Club Viña del Mar"')
      expect(csv).toContain('53.000')
    })

    it('formats apparatus CSV correctly', () => {
      const mockAppStandings: ApparatusStanding[] = [
        {
          rank: 1,
          apparatusCode: 'VT',
          gymnastId: 'g1',
          gymnastName: 'Renata Gómez',
          clubId: 'c1',
          clubName: 'Club Viña del Mar',
          categoryName: 'Nivel 4',
          dScore: 5.0,
          eScoreAvg: 8.5,
          finalScore: 13.5,
          medal: 'gold',
        },
      ]

      const csv = exportApparatusToCsv(mockAppStandings, 'VT', 'Salto')
      expect(csv.startsWith('\uFEFF')).toBe(true)
      expect(csv).toContain('13.500')
      expect(csv).toContain('"Salto (VT)"')
    })
  })

  describe('Official Minutes Compilation', () => {
    const mockChamp: Championship = {
      id: 'champ-1',
      organizationId: 'org-1',
      name: 'Campeonato Nacional de Gimnasia 2026',
      slug: 'campeonato-nacional-2026',
      startDate: '2026-11-20',
      endDate: '2026-11-22',
      venueName: 'Arena Santiago',
      location: 'Santiago, Chile',
      visibility: 'public',
      status: 'completed',
      rulesetVersion: 'FIG_2025_2028',
      scoringSchemaVersion: '1.0',
      createdAt: '2026-11-01',
      updatedAt: '2026-11-05',
    }

    it('compiles valid official minutes data with statistics and signees', () => {
      const minutes = compileOfficialMinutes(
        mockChamp,
        {
          totalGymnasts: 120,
          totalClubs: 8,
          totalScores: 480,
          inquiriesCount: 3,
          inquiriesResolvedCount: 3,
        },
        ['Competencia finalizada sin incidentes de seguridad.']
      )

      expect(minutes.championshipName).toBe('Campeonato Nacional de Gimnasia 2026')
      expect(minutes.totalGymnasts).toBe(120)
      expect(minutes.totalClubs).toBe(8)
      expect(minutes.inquiriesCount).toBe(3)
      expect(minutes.observations).toHaveLength(1)
      expect(minutes.headJudgeName).toBe('Juez Árbitro General FIG')
    })
  })
})
