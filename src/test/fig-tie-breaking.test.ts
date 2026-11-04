import { describe, it, expect } from 'vitest'
import {
  computeAllAroundStandings,
  computeApparatusStandings,
  computeTeamStandings,
  type GymnastScoreEntry,
} from '@/features/standings/standingsEngine'

describe('FIG 2025-2028 Technical Regulations: Advanced Tie-Breaking Rules', () => {
  it('FIG All-Around Step 1: breaks tie by highest sum of 3 highest apparatus scores', () => {
    // Both score 52.000 total across 4 apparatuses
    // Gymnast A: VT=14.0, UB=13.0, BB=13.0, FX=12.0 -> Top 3 = 14.0 + 13.0 + 13.0 = 40.0
    // Gymnast B: VT=13.0, UB=13.0, BB=13.0, FX=13.0 -> Top 3 = 13.0 + 13.0 + 13.0 = 39.0
    const scores: GymnastScoreEntry[] = [
      { gymnastId: 'gA', gymnastName: 'Atleta A', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'VT', dScore: 5.0, eScoreAvg: 9.0, finalScore: 14.0, status: 'official_approved' },
      { gymnastId: 'gA', gymnastName: 'Atleta A', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'UB', dScore: 5.0, eScoreAvg: 8.0, finalScore: 13.0, status: 'official_approved' },
      { gymnastId: 'gA', gymnastName: 'Atleta A', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'BB', dScore: 5.0, eScoreAvg: 8.0, finalScore: 13.0, status: 'official_approved' },
      { gymnastId: 'gA', gymnastName: 'Atleta A', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'FX', dScore: 4.0, eScoreAvg: 8.0, finalScore: 12.0, status: 'official_approved' },

      { gymnastId: 'gB', gymnastName: 'Atleta B', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'VT', dScore: 5.0, eScoreAvg: 8.0, finalScore: 13.0, status: 'official_approved' },
      { gymnastId: 'gB', gymnastName: 'Atleta B', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'UB', dScore: 5.0, eScoreAvg: 8.0, finalScore: 13.0, status: 'official_approved' },
      { gymnastId: 'gB', gymnastName: 'Atleta B', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'BB', dScore: 5.0, eScoreAvg: 8.0, finalScore: 13.0, status: 'official_approved' },
      { gymnastId: 'gB', gymnastName: 'Atleta B', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'FX', dScore: 5.0, eScoreAvg: 8.0, finalScore: 13.0, status: 'official_approved' },
    ]

    const standings = computeAllAroundStandings(scores)

    expect(standings).toHaveLength(2)
    expect(standings[0].gymnastId).toBe('gA')
    expect(standings[0].rank).toBe(1)
    expect(standings[0].medal).toBe('gold')
    expect(standings[1].gymnastId).toBe('gB')
    expect(standings[1].rank).toBe(2)
    expect(standings[1].medal).toBe('silver')
    expect(standings[1].tieBreakInfo).toContain('Suma 3 mejores aparatos')
  })

  it('FIG All-Around Step 2: breaks tie by highest sum of 2 highest apparatus scores when top 3 are equal', () => {
    // Both total = 50.000. Top 3 are equal (39.000)
    // Gymnast A: 14.0, 13.0, 12.0, 11.0 -> Top 3 = 39.0, Top 2 = 14 + 13 = 27.0
    // Gymnast B: 13.5, 13.0, 12.5, 11.0 -> Top 3 = 39.0, Top 2 = 13.5 + 13 = 26.5
    const scores: GymnastScoreEntry[] = [
      { gymnastId: 'gA', gymnastName: 'Atleta A', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'VT', dScore: 5.0, eScoreAvg: 9.0, finalScore: 14.0, status: 'official_approved' },
      { gymnastId: 'gA', gymnastName: 'Atleta A', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'UB', dScore: 5.0, eScoreAvg: 8.0, finalScore: 13.0, status: 'official_approved' },
      { gymnastId: 'gA', gymnastName: 'Atleta A', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'BB', dScore: 4.0, eScoreAvg: 8.0, finalScore: 12.0, status: 'official_approved' },
      { gymnastId: 'gA', gymnastName: 'Atleta A', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'FX', dScore: 3.0, eScoreAvg: 8.0, finalScore: 11.0, status: 'official_approved' },

      { gymnastId: 'gB', gymnastName: 'Atleta B', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'VT', dScore: 5.0, eScoreAvg: 8.5, finalScore: 13.5, status: 'official_approved' },
      { gymnastId: 'gB', gymnastName: 'Atleta B', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'UB', dScore: 5.0, eScoreAvg: 8.0, finalScore: 13.0, status: 'official_approved' },
      { gymnastId: 'gB', gymnastName: 'Atleta B', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'BB', dScore: 4.5, eScoreAvg: 8.0, finalScore: 12.5, status: 'official_approved' },
      { gymnastId: 'gB', gymnastName: 'Atleta B', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'FX', dScore: 3.0, eScoreAvg: 8.0, finalScore: 11.0, status: 'official_approved' },
    ]

    const standings = computeAllAroundStandings(scores)

    expect(standings[0].gymnastId).toBe('gA')
    expect(standings[0].rank).toBe(1)
    expect(standings[1].gymnastId).toBe('gB')
    expect(standings[1].rank).toBe(2)
    expect(standings[1].tieBreakInfo).toContain('Suma 2 mejores aparatos')
  })

  it('FIG All-Around Step 4: breaks tie by highest total E-score when apparatus scores are permutations', () => {
    // Both score exactly 13.0 on VT and 12.0 on UB (Total = 25.0)
    // Gymnast A: VT (D=4.0, E=9.0, Final=13.0), UB (D=4.0, E=8.0, Final=12.0) -> Total E = 17.0
    // Gymnast B: VT (D=5.0, E=8.0, Final=13.0), UB (D=5.0, E=7.0, Final=12.0) -> Total E = 15.0
    const scores: GymnastScoreEntry[] = [
      { gymnastId: 'gA', gymnastName: 'Atleta A (higher E)', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'VT', dScore: 4.0, eScoreAvg: 9.0, finalScore: 13.0, status: 'official_approved' },
      { gymnastId: 'gA', gymnastName: 'Atleta A (higher E)', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'UB', dScore: 4.0, eScoreAvg: 8.0, finalScore: 12.0, status: 'official_approved' },

      { gymnastId: 'gB', gymnastName: 'Atleta B (higher D)', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'VT', dScore: 5.0, eScoreAvg: 8.0, finalScore: 13.0, status: 'official_approved' },
      { gymnastId: 'gB', gymnastName: 'Atleta B (higher D)', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'UB', dScore: 5.0, eScoreAvg: 7.0, finalScore: 12.0, status: 'official_approved' },
    ]

    const standings = computeAllAroundStandings(scores)

    expect(standings[0].gymnastId).toBe('gA')
    expect(standings[0].rank).toBe(1)
    expect(standings[0].medal).toBe('gold')
    expect(standings[1].gymnastId).toBe('gB')
    expect(standings[1].rank).toBe(2)
    expect(standings[1].medal).toBe('silver')
    expect(standings[1].tieBreakInfo).toContain('Ejecución E')
  })

  it('FIG All-Around Unbroken Tie: assigns shared rank and medals (e.g. dual Gold, next is Bronze)', () => {
    // Exactly identical scores on all apparatuses and E-scores
    const scores: GymnastScoreEntry[] = [
      // Gymnast 1: 52.000
      { gymnastId: 'g1', gymnastName: 'Atleta 1', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'VT', dScore: 5.0, eScoreAvg: 8.5, finalScore: 13.5, status: 'official_approved' },
      { gymnastId: 'g1', gymnastName: 'Atleta 1', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'UB', dScore: 5.0, eScoreAvg: 8.5, finalScore: 13.5, status: 'official_approved' },

      // Gymnast 2: 52.000 (Identical)
      { gymnastId: 'g2', gymnastName: 'Atleta 2', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'VT', dScore: 5.0, eScoreAvg: 8.5, finalScore: 13.5, status: 'official_approved' },
      { gymnastId: 'g2', gymnastName: 'Atleta 2', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'UB', dScore: 5.0, eScoreAvg: 8.5, finalScore: 13.5, status: 'official_approved' },

      // Gymnast 3: 50.000 (Next rank should be 3rd place, skipping 2nd)
      { gymnastId: 'g3', gymnastName: 'Atleta 3', clubId: 'c3', clubName: 'Club 3', apparatusCode: 'VT', dScore: 4.5, eScoreAvg: 8.0, finalScore: 12.5, status: 'official_approved' },
      { gymnastId: 'g3', gymnastName: 'Atleta 3', clubId: 'c3', clubName: 'Club 3', apparatusCode: 'UB', dScore: 4.5, eScoreAvg: 8.0, finalScore: 12.5, status: 'official_approved' },
    ]

    const standings = computeAllAroundStandings(scores)

    expect(standings).toHaveLength(3)
    // Dual Gold
    expect(standings[0].rank).toBe(1)
    expect(standings[0].medal).toBe('gold')
    expect(standings[1].rank).toBe(1)
    expect(standings[1].medal).toBe('gold')
    expect(standings[1].tieBreakInfo).toContain('Empate compartido')

    // 3rd place receives Bronze (2nd place is skipped because there were two Golds)
    expect(standings[2].rank).toBe(3)
    expect(standings[2].medal).toBe('bronze')
  })

  it('FIG Apparatus Finals: ties broken by higher E-score, then D-score, then single vault, or shared rank', () => {
    // Both score 14.000 in VT average, identical E-score (8.5), identical D-score (5.5)
    // But Gymnast A has a higher best single vault: Attempt 1 = 14.2, Attempt 2 = 13.8 (Mean = 14.0)
    // Gymnast B has two identical vaults: Attempt 1 = 14.0, Attempt 2 = 14.0 (Mean = 14.0)
    const scores: GymnastScoreEntry[] = [
      { gymnastId: 'gA', gymnastName: 'Atleta A (14.2 best)', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'VT', attemptNumber: 1, dScore: 5.6, eScoreAvg: 8.6, finalScore: 14.2, status: 'official_approved' },
      { gymnastId: 'gA', gymnastName: 'Atleta A (14.2 best)', clubId: 'c1', clubName: 'Club 1', apparatusCode: 'VT', attemptNumber: 2, dScore: 5.4, eScoreAvg: 8.4, finalScore: 13.8, status: 'official_approved' },

      { gymnastId: 'gB', gymnastName: 'Atleta B (14.0 best)', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'VT', attemptNumber: 1, dScore: 5.5, eScoreAvg: 8.5, finalScore: 14.0, status: 'official_approved' },
      { gymnastId: 'gB', gymnastName: 'Atleta B (14.0 best)', clubId: 'c2', clubName: 'Club 2', apparatusCode: 'VT', attemptNumber: 2, dScore: 5.5, eScoreAvg: 8.5, finalScore: 14.0, status: 'official_approved' },
    ]

    const standings = computeApparatusStandings(scores, 'VT')

    expect(standings).toHaveLength(2)
    expect(standings[0].gymnastId).toBe('gA')
    expect(standings[0].rank).toBe(1)
    expect(standings[0].medal).toBe('gold')
    expect(standings[1].gymnastId).toBe('gB')
    expect(standings[1].rank).toBe(2)
    expect(standings[1].medal).toBe('silver')
    expect(standings[1].tieBreakInfo).toContain('Mejor salto individual')
  })

  it('FIG Team Standings: ties broken by highest sum of top 3 apparatuses', () => {
    // Club A and Club B both total 75.000
    // Club A has VT=26.0, UB=25.0, BB=24.0 -> Top 3 = 75.0
    // Club B has VT=25.0, UB=25.0, BB=25.0 -> Top 3 = 75.0, but Club A has higher single apparatus (26.0 vs 25.0)
    const scores: GymnastScoreEntry[] = [
      // Club A: VT=26.0, UB=25.0, BB=24.0 (Total=75)
      { gymnastId: 'gA1', gymnastName: 'A1', clubId: 'cA', clubName: 'Club A', apparatusCode: 'VT', dScore: 5.0, eScoreAvg: 8.0, finalScore: 26.0, status: 'official_approved' },
      { gymnastId: 'gA2', gymnastName: 'A2', clubId: 'cA', clubName: 'Club A', apparatusCode: 'UB', dScore: 5.0, eScoreAvg: 8.0, finalScore: 25.0, status: 'official_approved' },
      { gymnastId: 'gA3', gymnastName: 'A3', clubId: 'cA', clubName: 'Club A', apparatusCode: 'BB', dScore: 5.0, eScoreAvg: 8.0, finalScore: 24.0, status: 'official_approved' },

      // Club B: VT=25.0, UB=25.0, BB=25.0 (Total=75)
      { gymnastId: 'gB1', gymnastName: 'B1', clubId: 'cB', clubName: 'Club B', apparatusCode: 'VT', dScore: 5.0, eScoreAvg: 8.0, finalScore: 25.0, status: 'official_approved' },
      { gymnastId: 'gB2', gymnastName: 'B2', clubId: 'cB', clubName: 'Club B', apparatusCode: 'UB', dScore: 5.0, eScoreAvg: 8.0, finalScore: 25.0, status: 'official_approved' },
      { gymnastId: 'gB3', gymnastName: 'B3', clubId: 'cB', clubName: 'Club B', apparatusCode: 'BB', dScore: 5.0, eScoreAvg: 8.0, finalScore: 25.0, status: 'official_approved' },
    ]

    const standings = computeTeamStandings(scores)

    expect(standings).toHaveLength(2)
    expect(standings[0].clubId).toBe('cA')
    expect(standings[0].rank).toBe(1)
    expect(standings[0].trophy).toBe('1st')
    expect(standings[1].clubId).toBe('cB')
    expect(standings[1].rank).toBe(2)
    expect(standings[1].trophy).toBe('2nd')
    expect(standings[1].tieBreakInfo).toContain('Mayor total en un solo aparato')
  })
})
