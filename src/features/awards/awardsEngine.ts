/**
 * Operix Awards Engine.
 * Modulo Oficial de Premiacion, Podios, Medallero y Ceremonias.
 * Ciclo Olimpico FIG 2025-2028.
 * 
 * Desarrollado por Comercial Hels SpA.
 * 
 * Reglas de Integridad:
 * 1. Solo utiliza puntuaciones aprobadas ('official_approved') provenientes del motor deportivo oficial.
 * 2. Respeta las cascadas oficiales de desempate FIG y posiciones ex-aequo.
 * 3. Asigna correctamente empates en el medallero general de clubes.
 * 4. Gestiona categorias con pocos participantes segun politica configurable (estandar vs estricta FIG).
 * 5. Previene duplicacion de ceremonias y diplomas.
 */

import {
  computeAllAroundStandings,
  computeApparatusStandings,
  computeTeamStandings,
  type GymnastScoreEntry,
  type AllAroundStanding,
  type ApparatusStanding,
  type TeamStanding,
} from '@/features/standings/standingsEngine'
import { filterApprovedScores } from '@/features/reports/reportsEngine'
import type {
  AwardPodiumPlace,
  AwardCeremonyItem,
  AwardsConfig,
  ClubMedalStandingWithAthletes,
  FewParticipantsRule,
} from '@/core/types/awards'
import type { Category } from '@/core/types/championship'

export const DEFAULT_AWARDS_CONFIG: AwardsConfig = {
  placesAwardedCount: 3,
  fewParticipantsRule: 'standard_all',
  includeTrophiesForTeams: true,
  includeClubMedals: true,
  specialAwards: [],
}

/**
 * Builds podium places from All-Around standings.
 * Honors FIG tie-breaking and ex-aequo ranks.
 */
export function buildAwardPodiumFromAllAround(params: {
  standings: AllAroundStanding[]
  config?: Partial<AwardsConfig>
  categoryName?: string
}): { podiumPlaces: AwardPodiumPlace[]; totalCompetitors: number; isFewParticipants: boolean; fewParticipantsNote?: string } {
  const { standings, categoryName = 'General' } = params
  const placesCount = params.config?.placesAwardedCount ?? DEFAULT_AWARDS_CONFIG.placesAwardedCount
  const fewRule: FewParticipantsRule = params.config?.fewParticipantsRule ?? DEFAULT_AWARDS_CONFIG.fewParticipantsRule

  const totalCompetitors = standings.length
  const isFewParticipants = totalCompetitors > 0 && totalCompetitors < 3

  let fewParticipantsNote: string | undefined
  if (totalCompetitors === 1) {
    fewParticipantsNote =
      fewRule === 'strict_n_minus_one'
        ? 'Categoría con 1 participante: Norma FIG (Mención de Reconocimiento sin podio oficial disputado)'
        : 'Categoría con 1 participante: Reconocimiento y Medalla Oficial directa'
  } else if (totalCompetitors === 2) {
    fewParticipantsNote = 'Categoría con 2 participantes: Se premian 1° y 2° lugar (Sin 3° lugar)'
  }

  // Filter up to placesAwardedCount, respecting ties
  const eligibleStandings = standings.filter((s) => s.rank <= placesCount)

  const podiumPlaces: AwardPodiumPlace[] = eligibleStandings.map((s, idx, arr) => {
    // Check if this rank is shared with previous or next
    const isExAequo =
      (idx > 0 && arr[idx - 1].rank === s.rank) ||
      (idx < arr.length - 1 && arr[idx + 1].rank === s.rank)

    let medal: 'gold' | 'silver' | 'bronze' | undefined
    let awardTitle = `${s.rank}° Lugar — All-Around`

    if (s.rank === 1) {
      if (totalCompetitors === 1 && fewRule === 'strict_n_minus_one') {
        medal = undefined
        awardTitle = '1° Lugar — Reconocimiento Especial'
      } else {
        medal = 'gold'
        awardTitle = '1° Lugar — Campeón All-Around (Medalla de Oro)'
      }
    } else if (s.rank === 2) {
      medal = 'silver'
      awardTitle = '2° Lugar — Medalla de Plata'
    } else if (s.rank === 3) {
      if (totalCompetitors >= 3) {
        medal = 'bronze'
        awardTitle = '3° Lugar — Medalla de Bronce'
      } else {
        medal = undefined
        awardTitle = '3° Lugar'
      }
    }

    return {
      rank: s.rank,
      isExAequo,
      medal,
      trophy: s.rank === 1,
      diplomaEligible: true,
      awardTitle,
      gymnastId: s.gymnastId,
      gymnastName: s.gymnastName,
      clubId: s.clubId,
      clubName: s.clubName,
      categoryName: s.categoryName || categoryName,
      finalScore: s.totalScore,
      tieBreakInfo: s.tieBreakInfo,
    }
  })

  return { podiumPlaces, totalCompetitors, isFewParticipants, fewParticipantsNote }
}

/**
 * Builds podium places from Apparatus finals standings.
 */
export function buildAwardPodiumFromApparatus(params: {
  standings: ApparatusStanding[]
  apparatusCode: string
  apparatusName: string
  config?: Partial<AwardsConfig>
  categoryName?: string
}): { podiumPlaces: AwardPodiumPlace[]; totalCompetitors: number; isFewParticipants: boolean; fewParticipantsNote?: string } {
  const { standings, apparatusCode, apparatusName, categoryName = 'General' } = params
  const placesCount = params.config?.placesAwardedCount ?? DEFAULT_AWARDS_CONFIG.placesAwardedCount
  const fewRule: FewParticipantsRule = params.config?.fewParticipantsRule ?? DEFAULT_AWARDS_CONFIG.fewParticipantsRule

  const totalCompetitors = standings.length
  const isFewParticipants = totalCompetitors > 0 && totalCompetitors < 3

  let fewParticipantsNote: string | undefined
  if (totalCompetitors === 1) {
    fewParticipantsNote =
      fewRule === 'strict_n_minus_one'
        ? `Aparato ${apparatusName}: 1 participante (Mención de Reconocimiento)`
        : `Aparato ${apparatusName}: 1 participante (Medalla Oficial directa)`
  } else if (totalCompetitors === 2) {
    fewParticipantsNote = `Aparato ${apparatusName}: 2 participantes (1° y 2° lugar)`
  }

  const eligibleStandings = standings.filter((s) => s.rank <= placesCount)

  const podiumPlaces: AwardPodiumPlace[] = eligibleStandings.map((s, idx, arr) => {
    const isExAequo =
      (idx > 0 && arr[idx - 1].rank === s.rank) ||
      (idx < arr.length - 1 && arr[idx + 1].rank === s.rank)

    let medal: 'gold' | 'silver' | 'bronze' | undefined
    let awardTitle = `${s.rank}° Lugar — ${apparatusName}`

    if (s.rank === 1) {
      if (totalCompetitors === 1 && fewRule === 'strict_n_minus_one') {
        medal = undefined
        awardTitle = `1° Lugar — Reconocimiento ${apparatusName}`
      } else {
        medal = 'gold'
        awardTitle = `1° Lugar — Medalla de Oro en ${apparatusName}`
      }
    } else if (s.rank === 2) {
      medal = 'silver'
      awardTitle = `2° Lugar — Medalla de Plata en ${apparatusName}`
    } else if (s.rank === 3) {
      if (totalCompetitors >= 3) {
        medal = 'bronze'
        awardTitle = `3° Lugar — Medalla de Bronce en ${apparatusName}`
      } else {
        medal = undefined
        awardTitle = `3° Lugar en ${apparatusName}`
      }
    }

    return {
      rank: s.rank,
      isExAequo,
      medal,
      trophy: false,
      diplomaEligible: true,
      awardTitle,
      gymnastId: s.gymnastId,
      gymnastName: s.gymnastName,
      clubId: s.clubId,
      clubName: s.clubName,
      categoryName: s.categoryName || categoryName,
      apparatusCode,
      apparatusName,
      finalScore: s.finalScore,
      tieBreakInfo: s.tieBreakInfo,
    }
  })

  return { podiumPlaces, totalCompetitors, isFewParticipants, fewParticipantsNote }
}

/**
 * Builds podium places from Team standings.
 */
export function buildAwardPodiumFromTeams(params: {
  standings: TeamStanding[]
  config?: Partial<AwardsConfig>
}): { podiumPlaces: AwardPodiumPlace[]; totalCompetitors: number; isFewParticipants: boolean; fewParticipantsNote?: string } {
  const { standings } = params
  const placesCount = params.config?.placesAwardedCount ?? DEFAULT_AWARDS_CONFIG.placesAwardedCount
  const includeTrophies = params.config?.includeTrophiesForTeams ?? DEFAULT_AWARDS_CONFIG.includeTrophiesForTeams

  const totalCompetitors = standings.length
  const isFewParticipants = totalCompetitors > 0 && totalCompetitors < 3

  const eligibleStandings = standings.filter((s) => s.rank <= placesCount)

  const podiumPlaces: AwardPodiumPlace[] = eligibleStandings.map((s, idx, arr) => {
    const isExAequo =
      (idx > 0 && arr[idx - 1].rank === s.rank) ||
      (idx < arr.length - 1 && arr[idx + 1].rank === s.rank)

    let medal: 'gold' | 'silver' | 'bronze' | undefined
    let awardTitle = `${s.rank}° Lugar por Equipos`

    if (s.rank === 1) {
      medal = 'gold'
      awardTitle = '1° Lugar — Campeón por Equipos (Trofeo de Oro)'
    } else if (s.rank === 2) {
      medal = 'silver'
      awardTitle = '2° Lugar por Equipos (Trofeo de Plata)'
    } else if (s.rank === 3) {
      medal = 'bronze'
      awardTitle = '3° Lugar por Equipos (Trofeo de Bronce)'
    }

    return {
      rank: s.rank,
      isExAequo,
      medal,
      trophy: includeTrophies && s.rank <= 3,
      diplomaEligible: true,
      awardTitle,
      clubId: s.clubId,
      clubName: s.clubName,
      finalScore: s.totalScore,
      tieBreakInfo: s.tieBreakInfo,
      participatingGymnastsCount: s.participatingGymnastsCount,
    }
  })

  return {
    podiumPlaces,
    totalCompetitors,
    isFewParticipants,
    fewParticipantsNote: isFewParticipants ? `Participan ${totalCompetitors} clubes en la modalidad por equipos` : undefined,
  }
}

/**
 * Computes official Olympic Medal Tally for clubs, with explicit ex-aequo rank sharing
 * and distinct awarded athletes count.
 */
export function computeExAequoClubMedalTally(
  allAroundStandings: AllAroundStanding[],
  apparatusStandingsList: ApparatusStanding[][]
): ClubMedalStandingWithAthletes[] {
  const clubMap = new Map<
    string,
    {
      clubName: string
      gold: number
      silver: number
      bronze: number
      awardedAthleteIds: Set<string>
    }
  >()

  const registerMedal = (
    clubId: string,
    clubName: string,
    gymnastId: string,
    medal?: 'gold' | 'silver' | 'bronze'
  ) => {
    if (!medal) return
    const current = clubMap.get(clubId) || {
      clubName,
      gold: 0,
      silver: 0,
      bronze: 0,
      awardedAthleteIds: new Set<string>(),
    }

    if (medal === 'gold') current.gold++
    else if (medal === 'silver') current.silver++
    else if (medal === 'bronze') current.bronze++

    current.awardedAthleteIds.add(gymnastId)
    clubMap.set(clubId, current)
  }

  // 1. Process All-Around medals
  allAroundStandings.forEach((aa) => {
    if (aa.medal) {
      registerMedal(aa.clubId, aa.clubName, aa.gymnastId, aa.medal)
    }
  })

  // 2. Process Apparatus medals
  apparatusStandingsList.forEach((list) => {
    list.forEach((app) => {
      if (app.medal) {
        registerMedal(app.clubId, app.clubName, app.gymnastId, app.medal)
      }
    })
  })

  const results: ClubMedalStandingWithAthletes[] = Array.from(clubMap.entries()).map(([clubId, data]) => ({
    clubId,
    clubName: data.clubName,
    gold: data.gold,
    silver: data.silver,
    bronze: data.bronze,
    total: data.gold + data.silver + data.bronze,
    awardedAthletesCount: data.awardedAthleteIds.size,
    rank: 0,
    isExAequo: false,
  }))

  // Sort by Olympic Cascade: Gold desc, Silver desc, Bronze desc, Total desc
  results.sort((a, b) => {
    if (b.gold !== a.gold) return b.gold - a.gold
    if (b.silver !== a.silver) return b.silver - a.silver
    if (b.bronze !== a.bronze) return b.bronze - a.bronze
    return b.total - a.total
  })

  // Assign ex-aequo ranks
  let previousRank = 1
  for (let i = 0; i < results.length; i++) {
    const current = results[i]
    let rank = i + 1

    if (i > 0) {
      const prev = results[i - 1]
      const isIdentical =
        current.gold === prev.gold &&
        current.silver === prev.silver &&
        current.bronze === prev.bronze &&
        current.total === prev.total

      if (isIdentical) {
        rank = previousRank
        current.isExAequo = true
        prev.isExAequo = true
      } else {
        previousRank = rank
      }
    } else {
      previousRank = 1
    }

    current.rank = rank
  }

  return results
}

/**
 * Builds the complete list of ceremonies for a tournament in chronological/logical order.
 * Order:
 * 1. Finales por Aparato (categoría por categoría)
 * 2. All-Around General (categoría por categoría)
 * 3. Campeonato por Equipos
 * 4. Medallero General de Clubes (Instituciones)
 * 5. Premios Especiales (Espíritu deportivo, etc.)
 */
export function generateCeremonySchedule(params: {
  categories: Category[]
  approvedScores: GymnastScoreEntry[]
  config: AwardsConfig
  savedCeremonies?: { ceremonyKey: string; status: 'pending' | 'in_progress' | 'completed'; awardedAt?: string }[]
}): AwardCeremonyItem[] {
  const { categories, approvedScores, config, savedCeremonies = [] } = params
  const validScores = filterApprovedScores(approvedScores, false)

  const savedMap = new Map(savedCeremonies.map((s) => [s.ceremonyKey, s]))
  const ceremonies: AwardCeremonyItem[] = []
  let sequenceOrder = 1

  // 1. Aparatos por categoría
  for (const cat of categories) {
    const apparatusCodes =
      cat.apparatuses?.map((a) => a.code) ||
      Array.from(new Set(validScores.filter((s) => s.categoryId === cat.id).map((s) => s.apparatusCode))).filter(Boolean)

    for (const appCode of apparatusCodes) {
      const standings = computeApparatusStandings(validScores, appCode, cat.id)
      if (standings.length === 0) continue

      const ceremonyKey = `app_${cat.id}_${appCode}`
      const saved = savedMap.get(ceremonyKey)
      const appName = getApparatusDisplayName(appCode)

      const { podiumPlaces, totalCompetitors, isFewParticipants, fewParticipantsNote } =
        buildAwardPodiumFromApparatus({
          standings,
          apparatusCode: appCode,
          apparatusName: appName,
          config,
          categoryName: cat.name,
        })

      ceremonies.push({
        id: ceremonyKey,
        ceremonyKey,
        ceremonyType: 'apparatus',
        title: `Premiación: ${appName} — ${cat.name}`,
        categoryId: cat.id,
        categoryName: cat.name,
        apparatusCode: appCode,
        apparatusName: appName,
        sequenceOrder: sequenceOrder++,
        status: saved?.status || 'pending',
        podiumPlaces,
        awardedAt: saved?.awardedAt,
        totalCompetitors,
        isFewParticipants,
        fewParticipantsNote,
      })
    }
  }

  // 2. All-Around por categoría
  for (const cat of categories) {
    const aaStandings = computeAllAroundStandings(validScores, { categoryId: cat.id })
    if (aaStandings.length === 0) continue

    const ceremonyKey = `aa_${cat.id}`
    const saved = savedMap.get(ceremonyKey)

    const { podiumPlaces, totalCompetitors, isFewParticipants, fewParticipantsNote } =
      buildAwardPodiumFromAllAround({
        standings: aaStandings,
        config,
        categoryName: cat.name,
      })

    ceremonies.push({
      id: ceremonyKey,
      ceremonyKey,
      ceremonyType: 'all_around',
      title: `Premiación: General Individual (All-Around) — ${cat.name}`,
      categoryId: cat.id,
      categoryName: cat.name,
      sequenceOrder: sequenceOrder++,
      status: saved?.status || 'pending',
      podiumPlaces,
      awardedAt: saved?.awardedAt,
      totalCompetitors,
      isFewParticipants,
      fewParticipantsNote,
    })
  }

  // 3. Equipos
  const teamStandings = computeTeamStandings(validScores)
  if (teamStandings.length > 0) {
    const ceremonyKey = 'teams_championship'
    const saved = savedMap.get(ceremonyKey)

    const { podiumPlaces, totalCompetitors, isFewParticipants, fewParticipantsNote } =
      buildAwardPodiumFromTeams({
        standings: teamStandings,
        config,
      })

    ceremonies.push({
      id: ceremonyKey,
      ceremonyKey,
      ceremonyType: 'team',
      title: 'Premiación Oficial: Campeonato por Equipos',
      sequenceOrder: sequenceOrder++,
      status: saved?.status || 'pending',
      podiumPlaces,
      awardedAt: saved?.awardedAt,
      totalCompetitors,
      isFewParticipants,
      fewParticipantsNote,
    })
  }

  // 4. Medallero General de Clubes
  const allAroundGlobal = computeAllAroundStandings(validScores)
  const apparatusCodesGlobal = Array.from(new Set(validScores.map((s) => s.apparatusCode))).filter(Boolean)
  const apparatusGlobalList = apparatusCodesGlobal.map((code) =>
    computeApparatusStandings(validScores, code)
  )
  const clubTally = computeExAequoClubMedalTally(allAroundGlobal, apparatusGlobalList)

  if (clubTally.length > 0 && config.includeClubMedals) {
    const ceremonyKey = 'club_medal_tally'
    const saved = savedMap.get(ceremonyKey)

    const podiumPlaces: AwardPodiumPlace[] = clubTally
      .filter((c) => c.rank <= (config.placesAwardedCount || 3))
      .map((c) => ({
        rank: c.rank,
        isExAequo: c.isExAequo,
        medal: c.rank === 1 ? 'gold' : c.rank === 2 ? 'silver' : c.rank === 3 ? 'bronze' : undefined,
        trophy: c.rank === 1,
        diplomaEligible: true,
        awardTitle: `${c.rank}° Lugar Institucional (${c.gold} Oros, ${c.silver} Platas, ${c.bronze} Bronces)`,
        clubId: c.clubId,
        clubName: c.clubName,
        finalScore: c.total,
      }))

    ceremonies.push({
      id: ceremonyKey,
      ceremonyKey,
      ceremonyType: 'club_tally',
      title: 'Gran Premiación: Medallero General Institucional de Clubes',
      sequenceOrder: sequenceOrder++,
      status: saved?.status || 'pending',
      podiumPlaces,
      awardedAt: saved?.awardedAt,
      totalCompetitors: clubTally.length,
      isFewParticipants: false,
    })
  }

  // 5. Premios especiales
  if (config.specialAwards && config.specialAwards.length > 0) {
    config.specialAwards.forEach((sp, idx) => {
      const ceremonyKey = `special_${sp.id || idx}`
      const saved = savedMap.get(ceremonyKey)

      const podiumPlaces: AwardPodiumPlace[] = [
        {
          rank: 1,
          isExAequo: false,
          trophy: true,
          diplomaEligible: true,
          awardTitle: sp.title,
          gymnastName: sp.recipientName,
          clubId: 'special',
          clubName: sp.clubName || 'Reconocimiento General',
          tieBreakInfo: sp.description,
        },
      ]

      ceremonies.push({
        id: ceremonyKey,
        ceremonyKey,
        ceremonyType: 'special',
        title: `Reconocimiento Especial: ${sp.title}`,
        sequenceOrder: sequenceOrder++,
        status: saved?.status || 'pending',
        podiumPlaces,
        awardedAt: saved?.awardedAt,
        totalCompetitors: 1,
        isFewParticipants: false,
      })
    })
  }

  return ceremonies
}

export function getApparatusDisplayName(code: string): string {
  const map: Record<string, string> = {
    VT: 'Salto (Vault)',
    UB: 'Barras Asimétricas (Uneven Bars)',
    BB: 'Viga de Equilibrio (Balance Beam)',
    FX: 'Suelo (Floor Exercise)',
    FX_M: 'Suelo Masculino (Floor)',
    PH: 'Caballo con Arzones (Pommel Horse)',
    SR: 'Anillas (Still Rings)',
    PB: 'Barras Paralelas (Parallel Bars)',
    HB: 'Barra Fija (High Bar)',
    PK_SPEED: 'Parkour Speed',
    PK_FREE: 'Parkour Freestyle',
  }
  return map[code] || code
}
