import { describe, it, expect } from 'vitest'
import { calculateFigScore } from '@/features/scoring/scoringEngine'

describe('FIG Gymnastics Scoring Engine Tests (Phases 8 & 9)', () => {
  it('correctly calculates score with 4 E-judges discarding highest and lowest', () => {
    // Example: D-score = 5.400
    // E-scores: [8.6, 8.4, 8.9, 8.1] -> sorted: 8.1, 8.4, 8.6, 8.9
    // Discards: lowest (8.1), highest (8.9)
    // Used: 8.4 and 8.6 -> average = (8.4 + 8.6) / 2 = 8.500
    // ND = 0.1 (out of bounds)
    // Final = 5.400 + 8.500 - 0.100 = 13.800
    const result = calculateFigScore({
      dScore: 5.4,
      eScores: [8.6, 8.4, 8.9, 8.1],
      neutralDeductions: 0.1,
    })

    expect(result.dScore).toBe(5.4)
    expect(result.eScoreDiscardedLow).toBe(8.1)
    expect(result.eScoreDiscardedHigh).toBe(8.9)
    expect(result.eScoresUsed).toEqual([8.4, 8.6])
    expect(result.eScoreAverage).toBe(8.5)
    expect(result.neutralDeductions).toBe(0.1)
    expect(result.finalScore).toBe(13.8)
  })

  it('correctly rounds to 3 decimal places on periodic fractions', () => {
    // 3 judges: [8.1, 8.2, 8.4] -> sum = 24.7 -> avg = 8.23333333... -> 8.233
    const result = calculateFigScore({
      dScore: 4.8,
      eScores: [8.1, 8.2, 8.4],
      neutralDeductions: 0,
    })

    expect(result.eScoreAverage).toBe(8.233)
    expect(result.finalScore).toBe(13.033)
  })

  it('handles 6 E-judges correctly (Olympic standard)', () => {
    // 6 judges: [8.8, 8.5, 9.0, 8.7, 8.4, 8.6]
    // Sorted: 8.4, 8.5, 8.6, 8.7, 8.8, 9.0
    // Discarded: 8.4 (low), 9.0 (high)
    // Used: 8.5, 8.6, 8.7, 8.8 -> sum = 34.6 -> avg = 8.650
    const result = calculateFigScore({
      dScore: 6.2,
      eScores: [8.8, 8.5, 9.0, 8.7, 8.4, 8.6],
    })

    expect(result.eScoreDiscardedLow).toBe(8.4)
    expect(result.eScoreDiscardedHigh).toBe(9.0)
    expect(result.eScoreAverage).toBe(8.65)
    expect(result.finalScore).toBe(14.85)
  })

  it('rejects invalid inputs and negative numbers', () => {
    expect(() =>
      calculateFigScore({
        dScore: -1,
        eScores: [8.5],
      })
    ).toThrow(/D-score cannot be negative/)

    expect(() =>
      calculateFigScore({
        dScore: 5.0,
        eScores: [10.5],
      })
    ).toThrow(/Must be between 0.000 and 10.000/)

    expect(() =>
      calculateFigScore({
        dScore: 5.0,
        eScores: [],
      })
    ).toThrow(/At least one Execution \(E\) score is required/)
  })

  it('ensures final score cannot be negative even with extreme neutral deductions', () => {
    const result = calculateFigScore({
      dScore: 2.0,
      eScores: [5.0],
      neutralDeductions: 10.0,
    })

    expect(result.finalScore).toBe(0)
  })

  it('correctly calculates obligatory routine score where D is fixed and only E judges score', () => {
    // USAG Level 3 / Nivel Formativo Obligatorio: D fija = 10.000
    // Jueces E evalúan solo ejecución: [8.8, 8.6, 8.9, 8.7] -> promedio = 8.750
    // Final = 10.000 (D fija) + 8.750 - 0.000 = 18.750 (o sobre base 10)
    const result = calculateFigScore({
      dScore: 0, // Ignored because isObligatory is true
      isObligatory: true,
      fixedDScore: 10.0,
      eScores: [8.8, 8.6, 8.9, 8.7],
      neutralDeductions: 0.1,
    })

    expect(result.dScore).toBe(10.0)
    expect(result.eScoreAverage).toBe(8.75)
    expect(result.finalScore).toBe(18.65)
  })
})
