import { describe, it, expect } from 'vitest'
import {
  computeAllAroundStandings,
  computeApparatusStandings,
  computeTeamStandings,
  type GymnastScoreEntry,
} from '@/features/standings/standingsEngine'

describe('Gymnastics Standings Engine (Phase 10 & 11)', () => {
  const mockScores: GymnastScoreEntry[] = [
    // Gymnast 1 (Camila - Club A): Total = 13.5 + 12.8 + 13.0 + 13.2 = 52.5
    {
      gymnastId: 'g1',
      gymnastName: 'Camila Valenzuela',
      clubId: 'club-a',
      clubName: 'Club Manquehue',
      apparatusCode: 'VT',
      dScore: 5.0,
      eScoreAvg: 8.5,
      finalScore: 13.5,
      status: 'official_approved',
    },
    {
      gymnastId: 'g1',
      gymnastName: 'Camila Valenzuela',
      clubId: 'club-a',
      clubName: 'Club Manquehue',
      apparatusCode: 'UB',
      dScore: 4.8,
      eScoreAvg: 8.0,
      finalScore: 12.8,
      status: 'official_approved',
    },
    {
      gymnastId: 'g1',
      gymnastName: 'Camila Valenzuela',
      clubId: 'club-a',
      clubName: 'Club Manquehue',
      apparatusCode: 'BB',
      dScore: 4.9,
      eScoreAvg: 8.1,
      finalScore: 13.0,
      status: 'official_approved',
    },
    {
      gymnastId: 'g1',
      gymnastName: 'Camila Valenzuela',
      clubId: 'club-a',
      clubName: 'Club Manquehue',
      apparatusCode: 'FX',
      dScore: 5.2,
      eScoreAvg: 8.0,
      finalScore: 13.2,
      status: 'official_approved',
    },

    // Gymnast 2 (Florencia - Club B): Total = 13.8 + 12.5 + 13.1 + 13.3 = 52.7 (1st place)
    {
      gymnastId: 'g2',
      gymnastName: 'Florencia Castro',
      clubId: 'club-b',
      clubName: 'Club Estadio Italiano',
      apparatusCode: 'VT',
      dScore: 5.2,
      eScoreAvg: 8.6,
      finalScore: 13.8,
      status: 'official_approved',
    },
    {
      gymnastId: 'g2',
      gymnastName: 'Florencia Castro',
      clubId: 'club-b',
      clubName: 'Club Estadio Italiano',
      apparatusCode: 'UB',
      dScore: 4.5,
      eScoreAvg: 8.0,
      finalScore: 12.5,
      status: 'official_approved',
    },
    {
      gymnastId: 'g2',
      gymnastName: 'Florencia Castro',
      clubId: 'club-b',
      clubName: 'Club Estadio Italiano',
      apparatusCode: 'BB',
      dScore: 5.0,
      eScoreAvg: 8.1,
      finalScore: 13.1,
      status: 'official_approved',
    },
    {
      gymnastId: 'g2',
      gymnastName: 'Florencia Castro',
      clubId: 'club-b',
      clubName: 'Club Estadio Italiano',
      apparatusCode: 'FX',
      dScore: 5.1,
      eScoreAvg: 8.2,
      finalScore: 13.3,
      status: 'official_approved',
    },

    // Draft score (Should be ignored by standings engine)
    {
      gymnastId: 'g3',
      gymnastName: 'Sofia draft',
      clubId: 'club-a',
      clubName: 'Club Manquehue',
      apparatusCode: 'VT',
      dScore: 6.0,
      eScoreAvg: 9.0,
      finalScore: 15.0,
      status: 'draft',
    },
  ]

  it('computes All-Around standings and assigns Gold/Silver medals correctly', () => {
    const aa = computeAllAroundStandings(mockScores)

    expect(aa).toHaveLength(2) // g3 is draft, ignored

    // Rank 1: Florencia Castro (52.700)
    expect(aa[0].rank).toBe(1)
    expect(aa[0].gymnastName).toBe('Florencia Castro')
    expect(aa[0].totalScore).toBe(52.7)
    expect(aa[0].medal).toBe('gold')

    // Rank 2: Camila Valenzuela (52.500)
    expect(aa[1].rank).toBe(2)
    expect(aa[1].gymnastName).toBe('Camila Valenzuela')
    expect(aa[1].totalScore).toBe(52.5)
    expect(aa[1].medal).toBe('silver')
  })

  it('computes Apparatus Final standings with E-score tiebreaking', () => {
    // Both score 13.8 on VT
    const tiedScores: GymnastScoreEntry[] = [
      {
        gymnastId: 'gA',
        gymnastName: 'Atleta A (higher E)',
        clubId: 'c1',
        clubName: 'Club 1',
        apparatusCode: 'VT',
        dScore: 5.0,
        eScoreAvg: 8.8,
        finalScore: 13.8,
        status: 'official_approved',
      },
      {
        gymnastId: 'gB',
        gymnastName: 'Atleta B (higher D)',
        clubId: 'c2',
        clubName: 'Club 2',
        apparatusCode: 'VT',
        dScore: 5.2,
        eScoreAvg: 8.6,
        finalScore: 13.8,
        status: 'official_approved',
      },
    ]

    const vtStandings = computeApparatusStandings(tiedScores, 'VT')

    expect(vtStandings[0].gymnastName).toBe('Atleta A (higher E)')
    expect(vtStandings[0].rank).toBe(1)
    expect(vtStandings[0].medal).toBe('gold')

    expect(vtStandings[1].gymnastName).toBe('Atleta B (higher D)')
    expect(vtStandings[1].rank).toBe(2)
    expect(vtStandings[1].medal).toBe('silver')
  })

  it('computes Team Standings based on club scores sum', () => {
    const teams = computeTeamStandings(mockScores)

    expect(teams).toHaveLength(2)
    // Club Estadio Italiano: 52.7
    // Club Manquehue: 52.5
    expect(teams[0].clubName).toBe('Club Estadio Italiano')
    expect(teams[0].trophy).toBe('1st')
    expect(teams[0].totalScore).toBe(52.7)

    expect(teams[1].clubName).toBe('Club Manquehue')
    expect(teams[1].trophy).toBe('2nd')
    expect(teams[1].totalScore).toBe(52.5)
  })
})
