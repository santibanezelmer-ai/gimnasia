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
  scoringRegime?: 'free' | 'obligatory'
  apparatusCode: string
  attemptNumber?: number
  dScore: number
  eScoreAvg: number
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
  finalScore: number
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
  trophy?: '1st' | '2nd' | '3rd'
}

/**
 * Computes All-Around Individual Standings from approved/provisional scores.
 * Can be filtered by categoryId to prevent mixing Olympic/Free and Obligatory regimes.
 * 
 * FIG Official Rule: For All-Around, only Vault 1 (attempt 1) counts.
 * Tiebreaker:
 * 1. Sum of 3 highest apparatus scores (in GAF).
 * 2. Higher total E-score sum.
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
        totalScore: 0,
        totalEScore: 0,
      })
    }

    const current = gymnastMap.get(s.gymnastId)!
    // Prevent duplicate attempt 1 records if any
    if (current.apparatusScores[s.apparatusCode] === undefined) {
      current.apparatusScores[s.apparatusCode] = s.finalScore
      current.totalScore = Math.round((current.totalScore + s.finalScore) * 1000) / 1000
      current.totalEScore = Math.round((current.totalEScore + s.eScoreAvg) * 1000) / 1000
    }
  }

  // Sort descending by total score, then tiebreak by FIG Technical Regulations:
  // 1. Highest sum of top 3 apparatus scores
  // 2. Highest total E-score
  const sorted = Array.from(gymnastMap.entries())
    .map(([gymnastId, data]) => ({
      gymnastId,
      ...data,
    }))
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore
      }

      // FIG Art. 5.3: Top 3 apparatus scores sum
      const aVals = Object.values(a.apparatusScores).sort((x, y) => y - x)
      const bVals = Object.values(b.apparatusScores).sort((x, y) => y - x)
      const aTop3 = Math.round(aVals.slice(0, 3).reduce((acc, curr) => acc + curr, 0) * 1000) / 1000
      const bTop3 = Math.round(bVals.slice(0, 3).reduce((acc, curr) => acc + curr, 0) * 1000) / 1000
      if (bTop3 !== aTop3) {
        return bTop3 - aTop3
      }

      return b.totalEScore - a.totalEScore
    })

  return sorted.map((entry, index) => {
    const rank = index + 1
    let medal: AllAroundStanding['medal']
    if (rank === 1) medal = 'gold'
    else if (rank === 2) medal = 'silver'
    else if (rank === 3) medal = 'bronze'

    return {
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
      medal,
    }
  })
}

/**
 * Computes Apparatus Standings for a single apparatus.
 * Can be filtered by categoryId.
 * 
 * FIG Rule for Vault (VT) Event Finals:
 * If a gymnast performs two vaults (attempt 1 and attempt 2), the final score
 * is the arithmetic average of both vaults: (V1 + V2) / 2.
 * Other apparatuses (UB, BB, FX) only use attempt 1.
 * Tiebreaker: Higher E-score average.
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
        finalScore,
        vaultAttempts: {
          attempt1: g.attempt1 ? { dScore: g.attempt1.dScore, eScoreAvg: g.attempt1.eScoreAvg, finalScore: g.attempt1.finalScore } : undefined,
          attempt2: g.attempt2 ? { dScore: g.attempt2.dScore, eScoreAvg: g.attempt2.eScoreAvg, finalScore: g.attempt2.finalScore } : undefined,
        },
      }
    })
  } else {
    // For other apparatuses (UB, BB, FX), only attempt 1 is used
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
        finalScore: entry.finalScore,
      }))
  }

  const sorted = gymnastEntries.sort((a, b) => {
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore
    }
    return b.eScoreAvg - a.eScoreAvg
  })

  return sorted.map((entry, index) => {
    const rank = index + 1
    let medal: ApparatusStanding['medal']
    if (rank === 1) medal = 'gold'
    else if (rank === 2) medal = 'silver'
    else if (rank === 3) medal = 'bronze'

    return {
      rank,
      apparatusCode,
      ...entry,
      medal,
    }
  })
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

  // Sort descending by total score
  standings.sort((a, b) => b.totalScore - a.totalScore)

  return standings.map((entry, index) => {
    const rank = index + 1
    let trophy: TeamStanding['trophy']
    if (rank === 1) trophy = '1st'
    else if (rank === 2) trophy = '2nd'
    else if (rank === 3) trophy = '3rd'

    return {
      rank,
      ...entry,
      trophy,
    }
  })
}
