/**
 * Gymnastics Standings Engine (Official Deterministic Calculations).
 * 
 * Computes:
 * 1. All-Around Individual Standings (Total score across all apparatuses).
 * 2. Apparatus Finals Standings (Single apparatus rankings with E-score tiebreak).
 * 3. Team Standings (Configurable e.g. 5-4-3 format: top N scores per apparatus).
 * 4. Medal / Awards allocation (Gold, Silver, Bronze, Diplomas).
 */

export interface GymnastScoreEntry {
  gymnastId: string
  gymnastName: string
  clubId: string
  clubName: string
  categoryId?: string
  categoryName?: string
  discipline?: string
  scoringRegime?: 'free' | 'obligatory'
  apparatusCode: string
  attemptNumber?: number
  dScore: number
  eScoreAvg: number
  aScore?: number
  tofScore?: number
  hdScore?: number
  timeSeconds?: number
  penaltySeconds?: number
  finalScore: number
  status: 'draft' | 'submitted' | 'provisional' | 'official_approved'
}

export interface AllAroundStanding {
  rank: number
  gymnastId: string
  gymnastName: string
  clubId: string
  clubName: string
  categoryId?: string
  categoryName?: string
  apparatusScores: Record<string, number>
  totalScore: number
  totalEScore: number
  tieBreakInfo?: string
  medal?: 'gold' | 'silver' | 'bronze'
}

export interface ApparatusStanding {
  rank: number
  apparatusCode: string
  gymnastId: string
  gymnastName: string
  clubId: string
  clubName: string
  categoryId?: string
  categoryName?: string
  dScore: number
  eScoreAvg: number
  aScore?: number
  timeSeconds?: number
  penaltySeconds?: number
  finalScore: number
  isTimeBased?: boolean
  unit?: string
  tieBreakInfo?: string
  vaultAttempts?: {
    attempt1?: { dScore: number; eScoreAvg: number; finalScore: number }
    attempt2?: { dScore: number; eScoreAvg: number; finalScore: number }
  }
  medal?: 'gold' | 'silver' | 'bronze'
}

export interface TeamStanding {
  rank: number
  clubId: string
  clubName: string
  totalScore: number
  apparatusTotals: Record<string, number>
  participatingGymnastsCount: number
  tieBreakInfo?: string
  trophy?: '1st' | '2nd' | '3rd'
}

/**
 * Computes All-Around Individual Standings from approved/provisional scores.
 * Can be filtered by categoryId to prevent mixing Olympic/Free and Obligatory regimes.
 * 
 * FIG Official Rule 2025-2028 (Technical Regulations Section 2, Article 5.3):
 * 1. For All-Around, only Vault 1 (attempt 1) counts.
 * 2. Strict Tie-Breaking Cascade:
 *    - Step 1: Highest sum of the 3 highest apparatus scores (in GAF).
 *    - Step 2: Highest sum of the 2 highest apparatus scores.
 *    - Step 3: Highest single apparatus score.
 *    - Step 4: Highest total Execution score (E-Score sum).
 *    - Step 5: Highest single apparatus Execution score.
 *    - Unbroken Tie: Gymnasts share the rank and medal (e.g. dual Gold), next rank skipped.
 */
export function computeAllAroundStandings(
  scores: GymnastScoreEntry[],
  optionsOrRequiredCount?: number | { categoryId?: string; requiredApparatusCount?: number }
): AllAroundStanding[] {
  const categoryIdFilter =
    typeof optionsOrRequiredCount === 'object'
      ? optionsOrRequiredCount?.categoryId
      : undefined

  // Only include official approved or provisional scores, optionally filtered by category
  const validScores = scores.filter(
    (s) =>
      (s.status === 'official_approved' || s.status === 'provisional') &&
      (!categoryIdFilter || s.categoryId === categoryIdFilter)
  )

  const gymnastMap = new Map<
    string,
    {
      gymnastName: string
      clubId: string
      clubName: string
      categoryId?: string
      categoryName?: string
      apparatusScores: Record<string, number>
      apparatusEScores: Record<string, number>
      totalScore: number
      totalEScore: number
    }
  >()

  for (const s of validScores) {
    const attempt = s.attemptNumber ?? 1
    // FIG Rule: Only attempt 1 counts for All-Around (skip second vault)
    if (attempt !== 1) {
      continue
    }

    if (!gymnastMap.has(s.gymnastId)) {
      gymnastMap.set(s.gymnastId, {
        gymnastName: s.gymnastName,
        clubId: s.clubId,
        clubName: s.clubName,
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        apparatusScores: {},
        apparatusEScores: {},
        totalScore: 0,
        totalEScore: 0,
      })
    }

    const current = gymnastMap.get(s.gymnastId)!
    // Prevent duplicate attempt 1 records if any
    if (current.apparatusScores[s.apparatusCode] === undefined) {
      current.apparatusScores[s.apparatusCode] = s.finalScore
      current.apparatusEScores[s.apparatusCode] = s.eScoreAvg
      current.totalScore = Math.round((current.totalScore + s.finalScore) * 1000) / 1000
      current.totalEScore = Math.round((current.totalEScore + s.eScoreAvg) * 1000) / 1000
    }
  }

  // FIG Official Comparator with Tie-Breaking Cascade
  const compareAllAround = (
    a: {
      totalScore: number
      apparatusScores: Record<string, number>
      apparatusEScores: Record<string, number>
      totalEScore: number
    },
    b: {
      totalScore: number
      apparatusScores: Record<string, number>
      apparatusEScores: Record<string, number>
      totalEScore: number
    }
  ): { diff: number; reason?: string } => {
    // 0. Primary: Total Score
    if (Math.abs(b.totalScore - a.totalScore) > 0.0001) {
      return { diff: b.totalScore - a.totalScore }
    }

    // Step 1: Highest sum of the 3 highest apparatus scores
    const aVals = Object.values(a.apparatusScores).sort((x, y) => y - x)
    const bVals = Object.values(b.apparatusScores).sort((x, y) => y - x)
    const aTop3 = Math.round(aVals.slice(0, 3).reduce((acc, curr) => acc + curr, 0) * 1000) / 1000
    const bTop3 = Math.round(bVals.slice(0, 3).reduce((acc, curr) => acc + curr, 0) * 1000) / 1000
    if (Math.abs(bTop3 - aTop3) > 0.0001) {
      return {
        diff: bTop3 - aTop3,
        reason: `Desempate FIG: Suma 3 mejores aparatos (${Math.max(aTop3, bTop3).toFixed(3)} vs ${Math.min(aTop3, bTop3).toFixed(3)})`,
      }
    }

    // Step 2: Highest sum of the 2 highest apparatus scores
    const aTop2 = Math.round(aVals.slice(0, 2).reduce((acc, curr) => acc + curr, 0) * 1000) / 1000
    const bTop2 = Math.round(bVals.slice(0, 2).reduce((acc, curr) => acc + curr, 0) * 1000) / 1000
    if (Math.abs(bTop2 - aTop2) > 0.0001) {
      return {
        diff: bTop2 - aTop2,
        reason: `Desempate FIG: Suma 2 mejores aparatos (${Math.max(aTop2, bTop2).toFixed(3)} vs ${Math.min(aTop2, bTop2).toFixed(3)})`,
      }
    }

    // Step 3: Highest single apparatus score
    const aTop1 = aVals[0] ?? 0
    const bTop1 = bVals[0] ?? 0
    if (Math.abs(bTop1 - aTop1) > 0.0001) {
      return {
        diff: bTop1 - aTop1,
        reason: `Desempate FIG: Mayor nota en un solo aparato (${Math.max(aTop1, bTop1).toFixed(3)} vs ${Math.min(aTop1, bTop1).toFixed(3)})`,
      }
    }

    // Step 4: Highest total Execution score (E-Score sum)
    if (Math.abs(b.totalEScore - a.totalEScore) > 0.0001) {
      return {
        diff: b.totalEScore - a.totalEScore,
        reason: `Desempate FIG: Mayor nota total de Ejecución E (${Math.max(a.totalEScore, b.totalEScore).toFixed(3)} vs ${Math.min(a.totalEScore, b.totalEScore).toFixed(3)})`,
      }
    }

    // Step 5: Highest single apparatus Execution score
    const aEVals = Object.values(a.apparatusEScores).sort((x, y) => y - x)
    const bEVals = Object.values(b.apparatusEScores).sort((x, y) => y - x)
    const aTopE = aEVals[0] ?? 0
    const bTopE = bEVals[0] ?? 0
    if (Math.abs(bTopE - aTopE) > 0.0001) {
      return {
        diff: bTopE - aTopE,
        reason: `Desempate FIG: Mayor nota individual de Ejecución E (${Math.max(aTopE, bTopE).toFixed(3)} vs ${Math.min(aTopE, bTopE).toFixed(3)})`,
      }
    }

    return { diff: 0, reason: 'Empate oficial compartido (Criterios FIG idénticos)' }
  }

  const entries = Array.from(gymnastMap.entries()).map(([gymnastId, data]) => ({
    gymnastId,
    ...data,
  }))

  // Sort using the deterministic FIG cascade
  entries.sort((a, b) => compareAllAround(a, b).diff)

  // Assign Olympic FIG shared ranks (e.g. 1st, 1st, 3rd)
  const results: AllAroundStanding[] = []
  let previousRank = 1

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    let rank = i + 1
    let tieBreakInfo: string | undefined

    if (i > 0) {
      const prev = entries[i - 1]
      const comparison = compareAllAround(entry, prev)

      if (comparison.diff === 0) {
        // Complete tie: share previous rank
        rank = previousRank
        tieBreakInfo = 'Empate compartido (Reglamento FIG Art. 5.3)'
      } else {
        // Tie was broken between them if totalScore was equal
        if (Math.abs(entry.totalScore - prev.totalScore) < 0.0001) {
          tieBreakInfo = comparison.reason
        }
        previousRank = rank
      }
    } else {
      previousRank = 1
    }

    let medal: AllAroundStanding['medal']
    if (rank === 1) medal = 'gold'
    else if (rank === 2) medal = 'silver'
    else if (rank === 3) medal = 'bronze'

    results.push({
      rank,
      gymnastId: entry.gymnastId,
      gymnastName: entry.gymnastName,
      clubId: entry.clubId,
      clubName: entry.clubName,
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      apparatusScores: entry.apparatusScores,
      totalScore: entry.totalScore,
      totalEScore: entry.totalEScore,
      tieBreakInfo,
      medal,
    })
  }

  return results
}

/**
 * Computes Apparatus Standings for a single apparatus.
 * Can be filtered by categoryId.
 * 
 * FIG Rule for Vault (VT) Event Finals:
 * If a gymnast performs two vaults (attempt 1 and attempt 2), the final score
 * is the arithmetic average of both vaults: (V1 + V2) / 2.
 * Other apparatuses (UB, BB, FX) only use attempt 1.
 * 
 * FIG Official Tiebreaker Cascade for Apparatus:
 * 1. Higher E-score average (Ejecución).
 * 2. Higher D-score (Dificultad).
 * 3. In Vault (VT): Highest single vault final score.
 * 4. Unbroken tie: Shared rank and medal.
 */
export function computeApparatusStandings(
  scores: GymnastScoreEntry[],
  apparatusCode: string,
  categoryId?: string
): ApparatusStanding[] {
  const filtered = scores.filter(
    (s) =>
      s.apparatusCode === apparatusCode &&
      (s.status === 'official_approved' || s.status === 'provisional') &&
      (!categoryId || s.categoryId === categoryId)
  )

  let gymnastEntries: {
    gymnastId: string
    gymnastName: string
    clubId: string
    clubName: string
    categoryId?: string
    categoryName?: string
    dScore: number
    eScoreAvg: number
    aScore?: number
    timeSeconds?: number
    penaltySeconds?: number
    finalScore: number
    vaultAttempts?: {
      attempt1?: { dScore: number; eScoreAvg: number; finalScore: number }
      attempt2?: { dScore: number; eScoreAvg: number; finalScore: number }
    }
  }[] = []

  if (apparatusCode === 'VT') {
    // Group by gymnastId to handle 2 vault attempts for event finals
    const gymnastVaultMap = new Map<
      string,
      {
        gymnastName: string
        clubId: string
        clubName: string
        categoryId?: string
        categoryName?: string
        attempt1?: GymnastScoreEntry
        attempt2?: GymnastScoreEntry
      }
    >()

    for (const s of filtered) {
      if (!gymnastVaultMap.has(s.gymnastId)) {
        gymnastVaultMap.set(s.gymnastId, {
          gymnastName: s.gymnastName,
          clubId: s.clubId,
          clubName: s.clubName,
          categoryId: s.categoryId,
          categoryName: s.categoryName,
        })
      }
      const g = gymnastVaultMap.get(s.gymnastId)!
      const att = s.attemptNumber ?? 1
      if (att === 2) {
        g.attempt2 = s
      } else {
        g.attempt1 = s
      }
    }

    gymnastEntries = Array.from(gymnastVaultMap.entries()).map(([gymnastId, g]) => {
      let finalScore = 0
      let dScore = 0
      let eScoreAvg = 0

      if (g.attempt1 && g.attempt2) {
        // FIG Rule: Event Finals Vault score = arithmetic mean of Vault 1 and Vault 2
        finalScore = Math.round(((g.attempt1.finalScore + g.attempt2.finalScore) / 2) * 1000) / 1000
        dScore = Math.round(((g.attempt1.dScore + g.attempt2.dScore) / 2) * 1000) / 1000
        eScoreAvg = Math.round(((g.attempt1.eScoreAvg + g.attempt2.eScoreAvg) / 2) * 1000) / 1000
      } else if (g.attempt1) {
        finalScore = g.attempt1.finalScore
        dScore = g.attempt1.dScore
        eScoreAvg = g.attempt1.eScoreAvg
      } else if (g.attempt2) {
        finalScore = g.attempt2.finalScore
        dScore = g.attempt2.dScore
        eScoreAvg = g.attempt2.eScoreAvg
      }

      return {
        gymnastId,
        gymnastName: g.gymnastName,
        clubId: g.clubId,
        clubName: g.clubName,
        categoryId: g.categoryId,
        categoryName: g.categoryName,
        dScore,
        eScoreAvg,
        aScore: undefined as number | undefined,
        timeSeconds: undefined as number | undefined,
        penaltySeconds: undefined as number | undefined,
        finalScore,
        vaultAttempts: {
          attempt1: g.attempt1 ? { dScore: g.attempt1.dScore, eScoreAvg: g.attempt1.eScoreAvg, finalScore: g.attempt1.finalScore } : undefined,
          attempt2: g.attempt2 ? { dScore: g.attempt2.dScore, eScoreAvg: g.attempt2.eScoreAvg, finalScore: g.attempt2.finalScore } : undefined,
        },
      }
    })
  } else {
    // For other apparatuses (UB, BB, FX, GR, TRA, AER, ACRO, PK), attempt 1 is used
    gymnastEntries = filtered
      .filter((s) => (s.attemptNumber ?? 1) === 1)
      .map((entry) => ({
        gymnastId: entry.gymnastId,
        gymnastName: entry.gymnastName,
        clubId: entry.clubId,
        clubName: entry.clubName,
        categoryId: entry.categoryId,
        categoryName: entry.categoryName,
        dScore: entry.dScore,
        eScoreAvg: entry.eScoreAvg,
        aScore: entry.aScore,
        timeSeconds: entry.timeSeconds,
        penaltySeconds: entry.penaltySeconds,
        finalScore: entry.finalScore,
      }))
  }

  const isTimeBased = apparatusCode === 'SPD' || filtered.some((s) => s.timeSeconds !== undefined)

  // Apparatus FIG Comparator
  const compareApparatus = (
    a: (typeof gymnastEntries)[0],
    b: (typeof gymnastEntries)[0]
  ): { diff: number; reason?: string } => {
    // Specialized Parkour Speed Logic (Least Time Wins)
    if (isTimeBased) {
      if (Math.abs(a.finalScore - b.finalScore) > 0.0001) {
        return { diff: a.finalScore - b.finalScore }
      }
      // Tiebreak 1: Fewer penalty seconds
      const aPen = a.penaltySeconds ?? 0
      const bPen = b.penaltySeconds ?? 0
      if (Math.abs(aPen - bPen) > 0.0001) {
        return {
          diff: aPen - bPen,
          reason: `Desempate Parkour: Menos segundos de penalización (${Math.min(aPen, bPen).toFixed(3)}s vs ${Math.max(aPen, bPen).toFixed(3)}s)`,
        }
      }
      return { diff: 0, reason: 'Empate oficial compartido (Tiempos y penalizaciones idénticos)' }
    }

    // 0. Primary: Final Score (Highest Wins)
    if (Math.abs(b.finalScore - a.finalScore) > 0.0001) {
      return { diff: b.finalScore - a.finalScore }
    }

    // Step 1: Higher E-score average
    if (Math.abs(b.eScoreAvg - a.eScoreAvg) > 0.0001) {
      return {
        diff: b.eScoreAvg - a.eScoreAvg,
        reason: `Desempate FIG: Mayor nota de Ejecución E (${Math.max(a.eScoreAvg, b.eScoreAvg).toFixed(3)} vs ${Math.min(a.eScoreAvg, b.eScoreAvg).toFixed(3)})`,
      }
    }

    // Step 2: Higher D-score
    if (Math.abs(b.dScore - a.dScore) > 0.0001) {
      return {
        diff: b.dScore - a.dScore,
        reason: `Desempate FIG: Mayor nota de Dificultad D (${Math.max(a.dScore, b.dScore).toFixed(3)} vs ${Math.min(a.dScore, b.dScore).toFixed(3)})`,
      }
    }

    // Step 3 (Vault VT only): Highest single vault score
    if (apparatusCode === 'VT' && a.vaultAttempts && b.vaultAttempts) {
      const aBest = Math.max(a.vaultAttempts.attempt1?.finalScore ?? 0, a.vaultAttempts.attempt2?.finalScore ?? 0)
      const bBest = Math.max(b.vaultAttempts.attempt1?.finalScore ?? 0, b.vaultAttempts.attempt2?.finalScore ?? 0)
      if (Math.abs(bBest - aBest) > 0.0001) {
        return {
          diff: bBest - aBest,
          reason: `Desempate FIG Salto: Mejor salto individual (${Math.max(aBest, bBest).toFixed(3)} vs ${Math.min(aBest, bBest).toFixed(3)})`,
        }
      }
    }

    return { diff: 0, reason: 'Empate oficial compartido (Criterios FIG idénticos)' }
  }

  gymnastEntries.sort((a, b) => compareApparatus(a, b).diff)

  const results: ApparatusStanding[] = []
  let previousRank = 1

  for (let i = 0; i < gymnastEntries.length; i++) {
    const entry = gymnastEntries[i]
    let rank = i + 1
    let tieBreakInfo: string | undefined

    if (i > 0) {
      const prev = gymnastEntries[i - 1]
      const comparison = compareApparatus(entry, prev)

      if (comparison.diff === 0) {
        rank = previousRank
        tieBreakInfo = isTimeBased ? 'Empate en tiempo compartido (Reglamento FIG Parkour)' : 'Empate compartido (Reglamento FIG)'
      } else {
        if (Math.abs(entry.finalScore - prev.finalScore) < 0.0001) {
          tieBreakInfo = comparison.reason
        }
        previousRank = rank
      }
    } else {
      previousRank = 1
    }

    let medal: ApparatusStanding['medal']
    if (rank === 1) medal = 'gold'
    else if (rank === 2) medal = 'silver'
    else if (rank === 3) medal = 'bronze'

    results.push({
      rank,
      apparatusCode,
      ...entry,
      isTimeBased,
      unit: isTimeBased ? 's' : 'pts',
      tieBreakInfo,
      medal,
    })
  }

  return results
}

/**
 * Computes Team Standings (Top N scores per apparatus for each club).
 * Default: 3 best scores per apparatus.
 * FIG Rule: Only attempt 1 of Vault counts for Team Total.
 */
export function computeTeamStandings(
  scores: GymnastScoreEntry[],
  topNScoresPerApparatus = 3
): TeamStanding[] {
  const valid = scores.filter(
    (s) =>
      (s.status === 'official_approved' || s.status === 'provisional') &&
      // Only attempt 1 counts for team totals
      (s.attemptNumber ?? 1) === 1
  )

  // Group by club -> apparatus -> array of scores
  const clubMap = new Map<
    string,
    {
      clubName: string
      gymnastIds: Set<string>
      scoresByApparatus: Map<string, number[]>
    }
  >()

  for (const s of valid) {
    if (!clubMap.has(s.clubId)) {
      clubMap.set(s.clubId, {
        clubName: s.clubName,
        gymnastIds: new Set(),
        scoresByApparatus: new Map(),
      })
    }

    const club = clubMap.get(s.clubId)!
    club.gymnastIds.add(s.gymnastId)

    if (!club.scoresByApparatus.has(s.apparatusCode)) {
      club.scoresByApparatus.set(s.apparatusCode, [])
    }
    club.scoresByApparatus.get(s.apparatusCode)!.push(s.finalScore)
  }

  // Calculate sum of top N scores for each apparatus
  const standings = Array.from(clubMap.entries()).map(([clubId, data]) => {
    let grandTotal = 0
    const apparatusTotals: Record<string, number> = {}

    for (const [appCode, appScores] of data.scoresByApparatus.entries()) {
      // Sort descending and take top N
      const topScores = [...appScores].sort((a, b) => b - a).slice(0, topNScoresPerApparatus)
      const appSum = Math.round(topScores.reduce((acc, curr) => acc + curr, 0) * 1000) / 1000
      apparatusTotals[appCode] = appSum
      grandTotal = Math.round((grandTotal + appSum) * 1000) / 1000
    }

    return {
      clubId,
      clubName: data.clubName,
      totalScore: grandTotal,
      apparatusTotals,
      participatingGymnastsCount: data.gymnastIds.size,
    }
  })

  // Team FIG Comparator
  const compareTeams = (
    a: (typeof standings)[0],
    b: (typeof standings)[0]
  ): { diff: number; reason?: string } => {
    // 0. Primary: Total Score
    if (Math.abs(b.totalScore - a.totalScore) > 0.0001) {
      return { diff: b.totalScore - a.totalScore }
    }

    // Step 1: Highest sum of the 3 highest apparatus totals
    const aVals = Object.values(a.apparatusTotals).sort((x, y) => y - x)
    const bVals = Object.values(b.apparatusTotals).sort((x, y) => y - x)
    const aTop3 = Math.round(aVals.slice(0, 3).reduce((acc, curr) => acc + curr, 0) * 1000) / 1000
    const bTop3 = Math.round(bVals.slice(0, 3).reduce((acc, curr) => acc + curr, 0) * 1000) / 1000
    if (Math.abs(bTop3 - aTop3) > 0.0001) {
      return {
        diff: bTop3 - aTop3,
        reason: `Desempate FIG Equipos: Suma 3 mejores aparatos (${Math.max(aTop3, bTop3).toFixed(3)} vs ${Math.min(aTop3, bTop3).toFixed(3)})`,
      }
    }

    // Step 2: Highest single apparatus total
    const aTop1 = aVals[0] ?? 0
    const bTop1 = bVals[0] ?? 0
    if (Math.abs(bTop1 - aTop1) > 0.0001) {
      return {
        diff: bTop1 - aTop1,
        reason: `Desempate FIG Equipos: Mayor total en un solo aparato (${Math.max(aTop1, bTop1).toFixed(3)} vs ${Math.min(aTop1, bTop1).toFixed(3)})`,
      }
    }

    return { diff: 0, reason: 'Empate de equipos compartido (Criterios FIG idénticos)' }
  }

  standings.sort((a, b) => compareTeams(a, b).diff)

  const results: TeamStanding[] = []
  let previousRank = 1

  for (let i = 0; i < standings.length; i++) {
    const entry = standings[i]
    let rank = i + 1
    let tieBreakInfo: string | undefined

    if (i > 0) {
      const prev = standings[i - 1]
      const comparison = compareTeams(entry, prev)

      if (comparison.diff === 0) {
        rank = previousRank
        tieBreakInfo = 'Empate de equipos compartido'
      } else {
        if (Math.abs(entry.totalScore - prev.totalScore) < 0.0001) {
          tieBreakInfo = comparison.reason
        }
        previousRank = rank
      }
    } else {
      previousRank = 1
    }

    let trophy: TeamStanding['trophy']
    if (rank === 1) trophy = '1st'
    else if (rank === 2) trophy = '2nd'
    else if (rank === 3) trophy = '3rd'

    results.push({
      rank,
      ...entry,
      tieBreakInfo,
      trophy,
    })
  }

  return results
}
