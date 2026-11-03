/**
 * FIG (Fédération Internationale de Gymnastique) Official Scoring Engine.
 * 
 * Rules:
 * 1. Final Score = D-Score + E-Score Average - Neutral Deductions (ND).
 * 2. E-Score Calculation:
 *    - If 1, 2, or 3 E-judges: Arithmetic mean of all scores.
 *    - If 4, 5, or 6 E-judges: Discard the highest score and the lowest score,
 *      then calculate the arithmetic mean of the remaining intermediate scores.
 * 3. Rounding: Official FIG rules require rounding to 3 decimal places (e.g. 13.433).
 * 4. Deterministic and Pure: No side effects, no eval(), no arbitrary user formulas.
 */

export interface ScoreInput {
  dScore: number
  eScores: number[]
  neutralDeductions?: number
}

export interface ScoreCalculationResult {
  dScore: number
  eScoresRaw: number[]
  eScoresUsed: number[]
  eScoreDiscardedHigh?: number
  eScoreDiscardedLow?: number
  eScoreAverage: number
  neutralDeductions: number
  finalScore: number
}

/**
 * Rounds a number to exactly decimalPlaces using official mathematical rounding.
 */
export function roundScore(value: number, decimalPlaces = 3): number {
  const factor = Math.pow(10, decimalPlaces)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function calculateFigScore(input: ScoreInput): ScoreCalculationResult {
  const { dScore, eScores, neutralDeductions = 0 } = input

  if (!eScores || eScores.length === 0) {
    throw new Error('At least one Execution (E) score is required.')
  }

  // Validate values
  if (dScore < 0) {
    throw new Error('D-score cannot be negative.')
  }
  if (neutralDeductions < 0) {
    throw new Error('Neutral deductions cannot be negative.')
  }
  for (const score of eScores) {
    if (score < 0 || score > 10) {
      throw new Error(`Invalid E-score: ${score}. Must be between 0.000 and 10.000.`)
    }
  }

  let usedScores: number[]
  let discardedHigh: number | undefined
  let discardedLow: number | undefined

  if (eScores.length >= 4) {
    // Sort ascending
    const sorted = [...eScores].sort((a, b) => a - b)
    // Discard lowest (index 0) and highest (last index)
    discardedLow = sorted[0]
    discardedHigh = sorted[sorted.length - 1]
    usedScores = sorted.slice(1, sorted.length - 1)
  } else {
    // 1 to 3 judges: average all of them
    usedScores = [...eScores]
  }

  // Compute arithmetic average of used E-scores
  const sum = usedScores.reduce((acc, curr) => acc + curr, 0)
  const eScoreAverage = roundScore(sum / usedScores.length, 3)

  // Final score = D + E - ND
  const rawFinal = dScore + eScoreAverage - neutralDeductions
  const finalScore = roundScore(Math.max(0, rawFinal), 3)

  return {
    dScore: roundScore(dScore, 3),
    eScoresRaw: eScores,
    eScoresUsed: usedScores,
    eScoreDiscardedHigh: discardedHigh,
    eScoreDiscardedLow: discardedLow,
    eScoreAverage,
    neutralDeductions: roundScore(neutralDeductions, 3),
    finalScore,
  }
}
