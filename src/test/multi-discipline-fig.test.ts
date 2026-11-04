import { describe, it, expect } from 'vitest'
import {
  calculateRhythmicScore,
  calculateAerobicScore,
  calculateAcrobaticScore,
  calculateTrampolineScore,
  calculateParkourSpeedScore,
  calculateParkourFreestyleScore,
  calculateDisciplineScore,
} from '../features/scoring/scoringEngine'
import {
  computeApparatusStandings,
  type GymnastScoreEntry,
} from '../features/standings/standingsEngine'

describe('FIG Multi-Discipline Scoring & Regulations Engine (2025-2028)', () => {
  describe('Gimnasia Rítmica (GR)', () => {
    it('computes rhythmic score accurately with D + A + E - ND', () => {
      // D = 6.200, A = 8.400, E = [8.2, 8.5, 8.6, 8.8] -> E used = [8.5, 8.6] -> avg = 8.550, ND = 0.300
      // Final = 6.200 + 8.400 + 8.550 - 0.300 = 22.850
      const res = calculateRhythmicScore({
        dScore: 6.2,
        aScore: 8.4,
        eScores: [8.2, 8.5, 8.6, 8.8],
        neutralDeductions: 0.3,
      })

      expect(res.dScore).toBe(6.2)
      expect(res.aScore).toBe(8.4)
      expect(res.eScoreAverage).toBe(8.55)
      expect(res.neutralDeductions).toBe(0.3)
      expect(res.finalScore).toBe(22.85)
      expect(res.unit).toBe('pts')
    })

    it('rejects negative D-score or out-of-bounds A-score in rhythmic', () => {
      expect(() =>
        calculateRhythmicScore({
          dScore: -1.0,
          aScore: 8.0,
          eScores: [8.5],
        })
      ).toThrow()

      expect(() =>
        calculateRhythmicScore({
          dScore: 5.0,
          aScore: 11.5, // Max 10.0
          eScores: [8.5],
        })
      ).toThrow()
    })
  })

  describe('Gimnasia Aeróbica (AER) & Acrobática (ACRO)', () => {
    it('computes aerobic score D + A + E - ND', () => {
      const res = calculateAerobicScore({
        dScore: 3.5,
        aScore: 8.8,
        eScores: [8.6, 8.7, 8.9],
        neutralDeductions: 0.2,
      })

      // E avg = (8.6 + 8.7 + 8.9) / 3 = 8.7333 -> 8.733
      // Final = 3.500 + 8.800 + 8.733 - 0.200 = 20.833
      expect(res.finalScore).toBe(20.833)
      expect(res.scoringType).toBe('aerobic_fig')
    })

    it('computes acrobatic routine score D + A + E - ND', () => {
      const res = calculateAcrobaticScore({
        dScore: 2.1,
        aScore: 8.9,
        eScores: [9.0, 9.1],
        neutralDeductions: 0.0,
      })

      // E avg = 9.050
      // Final = 2.100 + 8.900 + 9.050 = 20.050
      expect(res.finalScore).toBe(20.05)
      expect(res.scoringType).toBe('acrobatic_fig')
    })
  })

  describe('Gimnasia Trampolín (TRA)', () => {
    it('computes Individual Trampoline with ToF and HD: D + E + ToF + HD - ND', () => {
      // D = 14.200, E avg = 8.400, ToF = 15.650, HD = 9.400, ND = 0.000
      // Final = 14.200 + 8.400 + 15.650 + 9.400 = 47.650
      const res = calculateTrampolineScore(
        {
          dScore: 14.2,
          eScores: [8.4, 8.4],
          tofScore: 15.65,
          hdScore: 9.4,
          neutralDeductions: 0.0,
        },
        'TRA'
      )

      expect(res.finalScore).toBe(47.65)
      expect(res.tofScore).toBe(15.65)
      expect(res.hdScore).toBe(9.4)
    })

    it('computes Double Mini-tramp (DMT) without ToF/HD: D + E - ND', () => {
      const res = calculateTrampolineScore(
        {
          dScore: 6.8,
          eScores: [8.9, 9.1],
          tofScore: 15.0, // Should be ignored in DMT
          hdScore: 9.0,
          neutralDeductions: 0.3,
        },
        'DMT'
      )

      // E avg = 9.000
      // Final = 6.800 + 9.000 - 0.300 = 15.500
      expect(res.finalScore).toBe(15.5)
      expect(res.tofScore).toBeUndefined()
    })
  })

  describe('Parkour FIG (PK) Speed & Freestyle', () => {
    it('computes Parkour Speed time + penalty seconds', () => {
      const res = calculateParkourSpeedScore({
        timeSeconds: 22.45,
        penaltySeconds: 1.0,
      })

      expect(res.finalScore).toBe(23.45)
      expect(res.unit).toBe('s')
      expect(res.scoringType).toBe('parkour_speed')
    })

    it('computes Parkour Freestyle routine with D + E - ND', () => {
      const res = calculateParkourFreestyleScore({
        dScore: 7.5,
        eScores: [8.2, 8.4, 8.6, 8.8],
        neutralDeductions: 0.2,
      })

      // E used = [8.4, 8.6] -> avg = 8.500
      // Final = 7.500 + 8.500 - 0.200 = 15.800
      expect(res.finalScore).toBe(15.8)
      expect(res.unit).toBe('pts')
    })

    it('ranks Parkour Speed athletes with least time winning (1st place = fastest)', () => {
      const parkourScores: GymnastScoreEntry[] = [
        {
          gymnastId: 'pk-1',
          gymnastName: 'Felipe Parkour',
          clubId: 'c1',
          clubName: 'Club PK Stgo',
          apparatusCode: 'SPD',
          dScore: 0,
          eScoreAvg: 0,
          timeSeconds: 24.12,
          penaltySeconds: 0,
          finalScore: 24.12,
          status: 'official_approved',
        },
        {
          gymnastId: 'pk-2',
          gymnastName: 'Ignacio Speed',
          clubId: 'c2',
          clubName: 'Valpo Parkour',
          apparatusCode: 'SPD',
          dScore: 0,
          eScoreAvg: 0,
          timeSeconds: 21.85,
          penaltySeconds: 0,
          finalScore: 21.85,
          status: 'official_approved',
        },
        {
          gymnastId: 'pk-3',
          gymnastName: 'Matias Runner',
          clubId: 'c1',
          clubName: 'Club PK Stgo',
          apparatusCode: 'SPD',
          dScore: 0,
          eScoreAvg: 0,
          timeSeconds: 22.5,
          penaltySeconds: 1.0,
          finalScore: 23.5,
          status: 'official_approved',
        },
      ]

      const standings = computeApparatusStandings(parkourScores, 'SPD')

      expect(standings).toHaveLength(3)
      // Rank 1: Ignacio Speed with 21.850s
      expect(standings[0].rank).toBe(1)
      expect(standings[0].gymnastId).toBe('pk-2')
      expect(standings[0].medal).toBe('gold')
      expect(standings[0].finalScore).toBe(21.85)
      expect(standings[0].isTimeBased).toBe(true)

      // Rank 2: Matias Runner with 23.500s
      expect(standings[1].rank).toBe(2)
      expect(standings[1].gymnastId).toBe('pk-3')
      expect(standings[1].medal).toBe('silver')

      // Rank 3: Felipe Parkour with 24.120s
      expect(standings[2].rank).toBe(3)
      expect(standings[2].gymnastId).toBe('pk-1')
      expect(standings[2].medal).toBe('bronze')
    })

    it('breaks Parkour Speed ties favoring fewer penalty seconds', () => {
      const tiedScores: GymnastScoreEntry[] = [
        {
          gymnastId: 'pk-clean',
          gymnastName: 'Corredor Limpio',
          clubId: 'c1',
          clubName: 'Club PK',
          apparatusCode: 'SPD',
          dScore: 0,
          eScoreAvg: 0,
          timeSeconds: 25.0,
          penaltySeconds: 0,
          finalScore: 25.0,
          status: 'official_approved',
        },
        {
          gymnastId: 'pk-fault',
          gymnastName: 'Corredor con Penalización',
          clubId: 'c2',
          clubName: 'Club PK B',
          apparatusCode: 'SPD',
          dScore: 0,
          eScoreAvg: 0,
          timeSeconds: 24.0,
          penaltySeconds: 1.0,
          finalScore: 25.0, // Same final time: 25.0s
          status: 'official_approved',
        },
      ]

      const standings = computeApparatusStandings(tiedScores, 'SPD')
      expect(standings[0].gymnastId).toBe('pk-clean')
      expect(standings[0].rank).toBe(1)
      expect(standings[1].gymnastId).toBe('pk-fault')
      expect(standings[1].rank).toBe(2)
      expect(standings[1].tieBreakInfo).toContain('Menos segundos de penalización')
    })
  })

  describe('Unified Discipline Dispatcher', () => {
    it('dispatches GAF correctly', () => {
      const res = calculateDisciplineScore('GAF', 'VT', {
        dScore: 5.0,
        eScores: [9.0],
      })
      expect(res.finalScore).toBe(14.0)
    })

    it('dispatches Parkour SPD correctly', () => {
      const res = calculateDisciplineScore('PK', 'SPD', {
        dScore: 0,
        eScores: [],
        timeSeconds: 19.82,
        penaltySeconds: 0,
      })
      expect(res.finalScore).toBe(19.82)
      expect(res.unit).toBe('s')
    })
  })
})
