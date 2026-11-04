/**
 * FIG (Fédération Internationale de Gymnastique) Official Scoring Engine.
 * Ciclo Olímpico 2025-2028.
 * 
 * Soporte Multi-Disciplina:
 * - GAF (Artística Femenina): D + E - ND
 * - GAM (Artística Masculina): D + E - ND
 * - GR (Gimnasia Rítmica): D + A + E - ND
 * - TRA (Gimnasia Trampolín): D + E + ToF + HD - ND (o D + E - ND en DMT/TUM)
 * - AER (Gimnasia Aeróbica): D + A + E - ND
 * - ACRO (Gimnasia Acrobática): D + A + E - ND
 * - PK (Parkour FIG): Speed (tiempo cronometrado + penalizaciones) y Freestyle (D + E - ND)
 * 
 * Desarrollado por Comercial Hels SpA.
 */

import type { GymnasticsDiscipline } from '@/core/types/championship'

export interface ScoreInput {
  dScore: number
  eScores: number[]
  neutralDeductions?: number
  isObligatory?: boolean          // Si es rutina obligatoria / no libre
  fixedDScore?: number            // Nota D prefijada (ej. 10.000)
}

export interface ScoreCalculationResult {
  dScore: number
  eScoresRaw: number[]
  eScoresUsed: number[]
  eScoreDiscardedHigh?: number
  eScoreDiscardedLow?: number
  eScoreAverage: number
  aScore?: number                 // Artística para GR, AER, ACRO
  tofScore?: number               // Time of Flight para TRA
  hdScore?: number                // Horizontal Displacement para TRA
  timeSeconds?: number            // Tiempo en segundos para Parkour Speed
  penaltySeconds?: number         // Penalizaciones en segundos para Parkour Speed
  neutralDeductions: number
  finalScore: number
  scoringType?: string
  unit?: string                   // 'pts' o 's'
}

export interface MultiDisciplineScoreInput extends ScoreInput {
  aScore?: number
  aScores?: number[]              // Evaluaciones de panel de jueces artísticos si aplica
  tofScore?: number               // Time of Flight (segundos)
  hdScore?: number                // Horizontal Displacement (puntos base 10.000)
  timeSeconds?: number            // Parkour Speed tiempo de carrera
  penaltySeconds?: number         // Parkour Speed faltas de obstáculos
}

/**
 * Rounds a number to exactly decimalPlaces using official mathematical rounding.
 */
export function roundScore(value: number, decimalPlaces = 3): number {
  const factor = Math.pow(10, decimalPlaces)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Computes average of judge scores using standard FIG trimming (if >= 4 judges, discard highest & lowest).
 */
export function computeJudgesAverage(scores: number[], panelName = 'Execution'): {
  raw: number[]
  used: number[]
  discardedHigh?: number
  discardedLow?: number
  average: number
} {
  if (!scores || scores.length === 0) {
    throw new Error(`At least one ${panelName} score is required.`)
  }

  for (const score of scores) {
    if (score < 0 || score > 10) {
      throw new Error(`Invalid ${panelName} score: ${score}. Must be between 0.000 and 10.000.`)
    }
  }

  let used: number[]
  let discardedHigh: number | undefined
  let discardedLow: number | undefined

  if (scores.length >= 4) {
    const sorted = [...scores].sort((a, b) => a - b)
    discardedLow = sorted[0]
    discardedHigh = sorted[sorted.length - 1]
    used = sorted.slice(1, sorted.length - 1)
  } else {
    used = [...scores]
  }

  const sum = used.reduce((acc, curr) => acc + curr, 0)
  const average = roundScore(sum / used.length, 3)

  return {
    raw: scores,
    used,
    discardedHigh,
    discardedLow,
    average,
  }
}

/**
 * Official Artistic Gymnastics (GAF & GAM) FIG scoring.
 * Formula: Final = D-Score + E-Score Average - Neutral Deductions.
 */
export function calculateFigScore(input: ScoreInput): ScoreCalculationResult {
  const { eScores, neutralDeductions = 0, isObligatory = false, fixedDScore = 10.0 } = input
  const effectiveDScore = isObligatory ? fixedDScore : input.dScore
  const sanitizedND = Math.abs(neutralDeductions)

  if (effectiveDScore < 0) {
    throw new Error('D-score cannot be negative.')
  }

  const eResult = computeJudgesAverage(eScores, 'Execution (E)')
  const rawFinal = effectiveDScore + eResult.average - sanitizedND
  const finalScore = roundScore(Math.max(0, rawFinal), 3)

  return {
    dScore: roundScore(effectiveDScore, 3),
    eScoresRaw: eResult.raw,
    eScoresUsed: eResult.used,
    eScoreDiscardedHigh: eResult.discardedHigh,
    eScoreDiscardedLow: eResult.discardedLow,
    eScoreAverage: eResult.average,
    neutralDeductions: roundScore(sanitizedND, 3),
    finalScore,
    scoringType: 'artistic_fig',
    unit: 'pts',
  }
}

/**
 * Official Rhythmic Gymnastics (GR) FIG Code of Points 2025-2028.
 * Formula: Final = D-Score (DB + DA) + A-Score (Artistic) + E-Score (Execution) - Neutral Deductions.
 */
export function calculateRhythmicScore(input: MultiDisciplineScoreInput): ScoreCalculationResult {
  const { dScore, eScores, aScore, aScores, neutralDeductions = 0 } = input
  const sanitizedND = Math.abs(neutralDeductions)

  if (dScore < 0) {
    throw new Error('Rhythmic D-score cannot be negative.')
  }

  // Calculate Artistic score either from single A-score or panel of A-judges
  let effectiveAScore = 0
  if (aScores && aScores.length > 0) {
    effectiveAScore = computeJudgesAverage(aScores, 'Artistic (A)').average
  } else if (aScore !== undefined) {
    if (aScore < 0 || aScore > 10) {
      throw new Error(`Invalid A-score: ${aScore}. Must be between 0.000 and 10.000.`)
    }
    effectiveAScore = roundScore(aScore, 3)
  }

  const eResult = computeJudgesAverage(eScores, 'Execution (E)')
  const rawFinal = dScore + effectiveAScore + eResult.average - sanitizedND
  const finalScore = roundScore(Math.max(0, rawFinal), 3)

  return {
    dScore: roundScore(dScore, 3),
    eScoresRaw: eResult.raw,
    eScoresUsed: eResult.used,
    eScoreDiscardedHigh: eResult.discardedHigh,
    eScoreDiscardedLow: eResult.discardedLow,
    eScoreAverage: eResult.average,
    aScore: effectiveAScore,
    neutralDeductions: roundScore(sanitizedND, 3),
    finalScore,
    scoringType: 'rhythmic_fig',
    unit: 'pts',
  }
}

/**
 * Official Aerobic Gymnastics (AER) FIG Code of Points 2025-2028.
 * Formula: Final = D-Score + A-Score + E-Score - Neutral Deductions.
 */
export function calculateAerobicScore(input: MultiDisciplineScoreInput): ScoreCalculationResult {
  const { dScore, eScores, aScore = 0, neutralDeductions = 0 } = input
  const sanitizedND = Math.abs(neutralDeductions)

  if (dScore < 0) throw new Error('Aerobic D-score cannot be negative.')
  if (aScore < 0 || aScore > 10) throw new Error(`Invalid Aerobic A-score: ${aScore}. Must be between 0 and 10.`)

  const eResult = computeJudgesAverage(eScores, 'Execution (E)')
  const rawFinal = dScore + aScore + eResult.average - sanitizedND
  const finalScore = roundScore(Math.max(0, rawFinal), 3)

  return {
    dScore: roundScore(dScore, 3),
    eScoresRaw: eResult.raw,
    eScoresUsed: eResult.used,
    eScoreDiscardedHigh: eResult.discardedHigh,
    eScoreDiscardedLow: eResult.discardedLow,
    eScoreAverage: eResult.average,
    aScore: roundScore(aScore, 3),
    neutralDeductions: roundScore(sanitizedND, 3),
    finalScore,
    scoringType: 'aerobic_fig',
    unit: 'pts',
  }
}

/**
 * Official Acrobatic Gymnastics (ACRO) FIG Code of Points 2025-2028.
 * Formula: Final = D-Score + A-Score + E-Score - Neutral Deductions.
 */
export function calculateAcrobaticScore(input: MultiDisciplineScoreInput): ScoreCalculationResult {
  const { dScore, eScores, aScore = 0, neutralDeductions = 0 } = input
  const sanitizedND = Math.abs(neutralDeductions)

  if (dScore < 0) throw new Error('Acrobatic D-score cannot be negative.')
  if (aScore < 0 || aScore > 10) throw new Error(`Invalid Acrobatic A-score: ${aScore}. Must be between 0 and 10.`)

  const eResult = computeJudgesAverage(eScores, 'Execution (E)')
  const rawFinal = dScore + aScore + eResult.average - sanitizedND
  const finalScore = roundScore(Math.max(0, rawFinal), 3)

  return {
    dScore: roundScore(dScore, 3),
    eScoresRaw: eResult.raw,
    eScoresUsed: eResult.used,
    eScoreDiscardedHigh: eResult.discardedHigh,
    eScoreDiscardedLow: eResult.discardedLow,
    eScoreAverage: eResult.average,
    aScore: roundScore(aScore, 3),
    neutralDeductions: roundScore(sanitizedND, 3),
    finalScore,
    scoringType: 'acrobatic_fig',
    unit: 'pts',
  }
}

/**
 * Official Trampoline Gymnastics (TRA) FIG Code of Points 2025-2028.
 * - Individual Trampoline & Synchro: D + E + ToF (Time of Flight) + HD (Horizontal Displacement) - ND
 * - Double Mini-tramp (DMT) & Tumbling (TUM): D + E - ND
 */
export function calculateTrampolineScore(
  input: MultiDisciplineScoreInput,
  apparatusCode = 'TRA'
): ScoreCalculationResult {
  const { dScore, eScores, tofScore = 0, hdScore = 0, neutralDeductions = 0 } = input
  const sanitizedND = Math.abs(neutralDeductions)

  if (dScore < 0) throw new Error('Trampoline D-score cannot be negative.')
  if (tofScore < 0) throw new Error('Time of Flight cannot be negative.')
  if (hdScore < 0 || hdScore > 10) throw new Error('Horizontal Displacement must be between 0 and 10.')

  const eResult = computeJudgesAverage(eScores, 'Execution (E)')

  let rawFinal = dScore + eResult.average - sanitizedND
  if (apparatusCode === 'TRA' || apparatusCode === 'SYN') {
    rawFinal += tofScore + hdScore
  }

  const finalScore = roundScore(Math.max(0, rawFinal), 3)

  return {
    dScore: roundScore(dScore, 3),
    eScoresRaw: eResult.raw,
    eScoresUsed: eResult.used,
    eScoreDiscardedHigh: eResult.discardedHigh,
    eScoreDiscardedLow: eResult.discardedLow,
    eScoreAverage: eResult.average,
    tofScore: apparatusCode === 'TRA' || apparatusCode === 'SYN' ? roundScore(tofScore, 3) : undefined,
    hdScore: apparatusCode === 'TRA' || apparatusCode === 'SYN' ? roundScore(hdScore, 3) : undefined,
    neutralDeductions: roundScore(sanitizedND, 3),
    finalScore,
    scoringType: 'trampoline_fig',
    unit: 'pts',
  }
}

/**
 * Official FIG Parkour Speed (PK-SPD) Rules.
 * Electronic or synchronized stopwatch timing.
 * Formula: Final = Time in seconds + Penalty seconds (e.g. 21.430 + 1.000 = 22.430s).
 * Ranking: Lower time is better (1st place = fastest).
 */
export function calculateParkourSpeedScore(input: {
  timeSeconds: number
  penaltySeconds?: number
}): ScoreCalculationResult {
  const { timeSeconds, penaltySeconds = 0 } = input

  if (timeSeconds <= 0) {
    throw new Error('Parkour Speed track time must be greater than zero.')
  }
  if (penaltySeconds < 0) {
    throw new Error('Penalties cannot be negative.')
  }

  const cleanTime = roundScore(timeSeconds, 3)
  const cleanPenalties = roundScore(penaltySeconds, 3)
  const finalTime = roundScore(cleanTime + cleanPenalties, 3)

  return {
    dScore: 0,
    eScoresRaw: [],
    eScoresUsed: [],
    eScoreAverage: 0,
    timeSeconds: cleanTime,
    penaltySeconds: cleanPenalties,
    neutralDeductions: cleanPenalties,
    finalScore: finalTime,
    scoringType: 'parkour_speed',
    unit: 's',
  }
}

/**
 * Official FIG Parkour Freestyle (PK-FR) Rules.
 * Evaluates acrobatic difficulty, continuous flow, mastery, and creativity.
 * Formula: Final = D-Score + E-Score - Neutral Deductions.
 */
export function calculateParkourFreestyleScore(input: ScoreInput): ScoreCalculationResult {
  const res = calculateFigScore(input)
  return {
    ...res,
    scoringType: 'parkour_freestyle',
    unit: 'pts',
  }
}

/**
 * Unified Dispatcher for all 7 FIG Gymnastics Disciplines.
 */
export function calculateDisciplineScore(
  discipline: GymnasticsDiscipline,
  apparatusCode: string,
  input: MultiDisciplineScoreInput
): ScoreCalculationResult {
  switch (discipline) {
    case 'GR':
      return calculateRhythmicScore(input)
    case 'AER':
      return calculateAerobicScore(input)
    case 'ACRO':
      return calculateAcrobaticScore(input)
    case 'TRA':
      return calculateTrampolineScore(input, apparatusCode)
    case 'PK':
      if (apparatusCode === 'SPD') {
        return calculateParkourSpeedScore({
          timeSeconds: input.timeSeconds ?? 0,
          penaltySeconds: input.penaltySeconds ?? 0,
        })
      }
      return calculateParkourFreestyleScore(input)
    case 'GAM':
    case 'GAF':
    default:
      return calculateFigScore(input)
  }
}
