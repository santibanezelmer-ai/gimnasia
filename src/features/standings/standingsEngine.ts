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
 * Tiebreaker: Higher total E-score sum.
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
    current.apparatusScores[s.apparatusCode] = s.finalScore
    current.totalScore = Math.round((current.totalScore + s.finalScore) * 1000) / 1000
    current.totalEScore = Math.round((current.totalEScore + s.eScoreAvg) * 1000) / 1000
  }

  // Sort descending by total score, then tiebreak by total E-score
  const sorted = Array.from(gymnastMap.entries())
    .map(([gymnastId, data]) => ({
      gymnastId,
      ...data,
    }))
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore
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

  const sorted = [...filtered].sort((a, b) => {
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
      apparatusCode: entry.apparatusCode,
      gymnastId: entry.gymnastId,
      gymnastName: entry.gymnastName,
      clubId: entry.clubId,
      clubName: entry.clubName,
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      dScore: entry.dScore,
      eScoreAvg: entry.eScoreAvg,
      finalScore: entry.finalScore,
      medal,
    }
  })
}

/**
 * Computes Team Standings (Top N scores per apparatus for each club).
 * Default: 3 best scores per apparatus.
 */
export function computeTeamStandings(
  scores: GymnastScoreEntry[],
  topNScoresPerApparatus = 3
): TeamStanding[] {
  const valid = scores.filter(
    (s) => s.status === 'official_approved' || s.status === 'provisional'
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
