/**
 * Operix Reports Engine.
 * Official Documentation & Result Book Compiler.
 * 
 * Integrity Rules:
 * 1. Only approved scores (status === 'official_approved') are eligible for official Result Books.
 * 2. Provisional scores must be explicitly flagged with watermark / warning.
 * 3. Deterministic medal tally calculation.
 * 4. Deduplicated diploma batch generation.
 * 5. Full Excel / CSV export with UTF-8 BOM.
 * 
 * Desarrollado por Comercial Hels SpA.
 */

import type {
  GymnastScoreEntry,
  AllAroundStanding,
  ApparatusStanding,
  TeamStanding,
} from '@/features/standings/standingsEngine'
import type {
  ClubMedalTally,
  DiplomaAwardItem,
  OfficialMinutesData,
} from '@/core/types/reports'
import type { Championship } from '@/core/types/championship'
import type { MarshalingAthlete } from '@/features/schedule/rotationEngine'

/**
 * Filters scores to strictly include only official approved scores.
 * Rejects drafts, submitted-only, or scratched scores.
 */
export function filterApprovedScores(
  scores: GymnastScoreEntry[],
  allowProvisional = false
): GymnastScoreEntry[] {
  return scores.filter((s) => {
    if (s.status === 'official_approved') return true
    if (allowProvisional && s.status === 'provisional') return true
    return false
  })
}

/**
 * Computes official Olympic medal tally by club across All-Around and Apparatus finals.
 * Ordering criteria (Olympic Standard):
 * 1. Most Gold medals
 * 2. Most Silver medals
 * 3. Most Bronze medals
 * 4. Total medals
 */
export function computeClubMedalTally(
  allAroundStandings: AllAroundStanding[],
  apparatusStandingsList: ApparatusStanding[][]
): ClubMedalTally[] {
  const clubMap = new Map<string, { clubName: string; gold: number; silver: number; bronze: number }>()

  const addMedal = (clubId: string, clubName: string, medal?: 'gold' | 'silver' | 'bronze') => {
    if (!medal) return
    const current = clubMap.get(clubId) || { clubName, gold: 0, silver: 0, bronze: 0 }
    if (medal === 'gold') current.gold++
    else if (medal === 'silver') current.silver++
    else if (medal === 'bronze') current.bronze++
    clubMap.set(clubId, current)
  }

  // Count All-Around medals
  allAroundStandings.forEach((aa) => {
    if (aa.medal) addMedal(aa.clubId, aa.clubName, aa.medal)
  })

  // Count Apparatus medals
  apparatusStandingsList.forEach((list) => {
    list.forEach((app) => {
      if (app.medal) addMedal(app.clubId, app.clubName, app.medal)
    })
  })

  const results: ClubMedalTally[] = Array.from(clubMap.entries()).map(([clubId, data]) => ({
    clubId,
    clubName: data.clubName,
    gold: data.gold,
    silver: data.silver,
    bronze: data.bronze,
    total: data.gold + data.silver + data.bronze,
    rank: 0,
  }))

  // Sort by Olympic medal cascade
  results.sort((a, b) => {
    if (b.gold !== a.gold) return b.gold - a.gold
    if (b.silver !== a.silver) return b.silver - a.silver
    if (b.bronze !== a.bronze) return b.bronze - a.bronze
    return b.total - a.total
  })

  // Assign ranks
  results.forEach((item, index) => {
    item.rank = index + 1
  })

  return results
}

/**
 * Generates deduplicated diploma award records for participation, podiums, and champions.
 */
export function generateDiplomaAwardItems(params: {
  allAroundStandings: AllAroundStanding[]
  apparatusStandingsList: { apparatusCode: string; apparatusName: string; standings: ApparatusStanding[] }[]
  teamStandings: TeamStanding[]
  allAthletes: MarshalingAthlete[]
  includeParticipation?: boolean
  includePodiums?: boolean
}): DiplomaAwardItem[] {
  const {
    allAroundStandings,
    apparatusStandingsList,
    teamStandings,
    allAthletes,
    includeParticipation = true,
    includePodiums = true,
  } = params

  const awards: DiplomaAwardItem[] = []
  const uniqueKeySet = new Set<string>()

  const pushAward = (item: DiplomaAwardItem) => {
    const key = `${item.gymnastId}_${item.awardType}_${item.apparatusCode || 'aa'}_${item.rank || 0}`
    if (!uniqueKeySet.has(key)) {
      uniqueKeySet.add(key)
      awards.push(item)
    }
  }

  // 1. Podiums: All-Around (Gold, Silver, Bronze)
  if (includePodiums) {
    allAroundStandings.forEach((aa) => {
      if (aa.rank === 1) {
        pushAward({
          id: `dip-aa-gold-${aa.gymnastId}`,
          gymnastId: aa.gymnastId,
          gymnastName: aa.gymnastName,
          clubId: aa.clubId,
          clubName: aa.clubName,
          categoryName: aa.categoryName || 'General',
          awardType: 'gold',
          awardTitle: 'Primer Lugar — Campeón General (All-Around)',
          rank: 1,
          finalScore: aa.totalScore,
        })
      } else if (aa.rank === 2) {
        pushAward({
          id: `dip-aa-silver-${aa.gymnastId}`,
          gymnastId: aa.gymnastId,
          gymnastName: aa.gymnastName,
          clubId: aa.clubId,
          clubName: aa.clubName,
          categoryName: aa.categoryName || 'General',
          awardType: 'silver',
          awardTitle: 'Segundo Lugar — General Individual',
          rank: 2,
          finalScore: aa.totalScore,
        })
      } else if (aa.rank === 3) {
        pushAward({
          id: `dip-aa-bronze-${aa.gymnastId}`,
          gymnastId: aa.gymnastId,
          gymnastName: aa.gymnastName,
          clubId: aa.clubId,
          clubName: aa.clubName,
          categoryName: aa.categoryName || 'General',
          awardType: 'bronze',
          awardTitle: 'Tercer Lugar — General Individual',
          rank: 3,
          finalScore: aa.totalScore,
        })
      }
    })

    // 2. Podiums: Apparatus Finals
    apparatusStandingsList.forEach(({ apparatusCode, apparatusName, standings }) => {
      standings.forEach((app) => {
        if (app.rank === 1) {
          pushAward({
            id: `dip-${apparatusCode}-gold-${app.gymnastId}`,
            gymnastId: app.gymnastId,
            gymnastName: app.gymnastName,
            clubId: app.clubId,
            clubName: app.clubName,
            categoryName: app.categoryName || 'General',
            awardType: 'gold',
            awardTitle: `Primer Lugar (Oro) — ${apparatusName}`,
            rank: 1,
            apparatusCode,
            apparatusName,
            finalScore: app.finalScore,
          })
        } else if (app.rank === 2) {
          pushAward({
            id: `dip-${apparatusCode}-silver-${app.gymnastId}`,
            gymnastId: app.gymnastId,
            gymnastName: app.gymnastName,
            clubId: app.clubId,
            clubName: app.clubName,
            categoryName: app.categoryName || 'General',
            awardType: 'silver',
            awardTitle: `Segundo Lugar (Plata) — ${apparatusName}`,
            rank: 2,
            apparatusCode,
            apparatusName,
            finalScore: app.finalScore,
          })
        } else if (app.rank === 3) {
          pushAward({
            id: `dip-${apparatusCode}-bronze-${app.gymnastId}`,
            gymnastId: app.gymnastId,
            gymnastName: app.gymnastName,
            clubId: app.clubId,
            clubName: app.clubName,
            categoryName: app.categoryName || 'General',
            awardType: 'bronze',
            awardTitle: `Tercer Lugar (Bronce) — ${apparatusName}`,
            rank: 3,
            apparatusCode,
            apparatusName,
            finalScore: app.finalScore,
          })
        }
      })
    })

    // 3. Team awards for athletes in top 3 clubs
    teamStandings.slice(0, 3).forEach((team) => {
      const teamAthletes = allAthletes.filter((a) => a.clubId === team.clubId)
      const trophyText =
        team.rank === 1 ? 'Campeón por Equipos (1° Lugar)' : `${team.rank}° Lugar por Equipos`
      teamAthletes.forEach((ath) => {
        pushAward({
          id: `dip-team-${team.rank}-${ath.gymnastId}`,
          gymnastId: ath.gymnastId,
          gymnastName: ath.gymnastName,
          clubId: ath.clubId,
          clubName: ath.clubName,
          categoryName: ath.categoryName || 'Equipos',
          awardType: 'team_champion',
          awardTitle: trophyText,
          rank: team.rank,
          finalScore: team.totalScore,
        })
      })
    })
  }

  // 4. General Participation Diplomas (for every athlete registered in the tournament)
  if (includeParticipation) {
    allAthletes.forEach((ath) => {
      pushAward({
        id: `dip-part-${ath.gymnastId}`,
        gymnastId: ath.gymnastId,
        gymnastName: ath.gymnastName,
        clubId: ath.clubId,
        clubName: ath.clubName,
        categoryName: ath.categoryName || 'General',
        awardType: 'participation',
        awardTitle: 'Diploma de Participación Oficial',
      })
    })
  }

  return awards
}

/**
 * Generates an Excel-ready CSV string with UTF-8 BOM (\uFEFF) for All-Around Results.
 */
export function exportAllAroundToCsv(
  standings: AllAroundStanding[],
  apparatusCodes: string[] = ['VT', 'UB', 'BB', 'FX']
): string {
  const headers = ['Lugar', 'Dorsal', 'Gimnasta', 'Club', 'Categoría', ...apparatusCodes, 'Total All-Around', 'Desempate']
  const rows = standings.map((s) => [
    s.rank,
    s.medal ? `${s.medal.toUpperCase()} (${s.rank}°)` : `${s.rank}°`,
    `"${s.gymnastName.replace(/"/g, '""')}"`,
    `"${s.clubName.replace(/"/g, '""')}"`,
    `"${(s.categoryName || 'General').replace(/"/g, '""')}"`,
    ...apparatusCodes.map((c) => s.apparatusScores[c]?.toFixed(3) || '-'),
    s.totalScore.toFixed(3),
    `"${(s.tieBreakInfo || '').replace(/"/g, '""')}"`,
  ])

  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n')
  return '\uFEFF' + csvContent
}

/**
 * Generates an Excel-ready CSV string with UTF-8 BOM (\uFEFF) for Apparatus Results.
 */
export function exportApparatusToCsv(
  standings: ApparatusStanding[],
  apparatusCode: string,
  apparatusName: string
): string {
  const headers = ['Lugar', 'Medalla', 'Gimnasta', 'Club', 'Categoría', 'Aparato', 'Nota D', 'Nota E', 'Nota Final', 'Desempate']
  const rows = standings.map((s) => [
    s.rank,
    s.medal ? s.medal.toUpperCase() : '-',
    `"${s.gymnastName.replace(/"/g, '""')}"`,
    `"${s.clubName.replace(/"/g, '""')}"`,
    `"${(s.categoryName || 'General').replace(/"/g, '""')}"`,
    `"${apparatusName} (${apparatusCode})"`,
    s.dScore.toFixed(3),
    s.eScoreAvg.toFixed(3),
    s.finalScore.toFixed(3),
    `"${(s.tieBreakInfo || '').replace(/"/g, '""')}"`,
  ])

  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n')
  return '\uFEFF' + csvContent
}

/**
 * Compiles official tournament closing minutes.
 */
export function compileOfficialMinutes(
  champ: Championship,
  stats: {
    totalGymnasts: number
    totalClubs: number
    totalScores: number
    inquiriesCount: number
    inquiriesResolvedCount: number
  },
  observations: string[] = []
): OfficialMinutesData {
  return {
    championshipName: champ.name,
    organizerName: 'Comité Organizador & Federación Oficial',
    venueName: champ.venueName || champ.location || 'Gimnasio Oficial',
    dates: `${champ.startDate} al ${champ.endDate}`,
    closingDate: new Date().toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    rulesetVersion: champ.rulesetVersion || 'FIG 2025-2028',
    totalGymnasts: stats.totalGymnasts,
    totalClubs: stats.totalClubs,
    totalScoresSubmitted: stats.totalScores,
    inquiriesCount: stats.inquiriesCount,
    inquiriesResolvedCount: stats.inquiriesResolvedCount,
    presidentName: 'Presidente Comisión Técnica',
    technicalDirectorName: 'Director de Competencia',
    headJudgeName: 'Juez Árbitro General FIG',
    observations: observations.length > 0
      ? observations
      : [
          'La competencia se desarrolló en completa normalidad conforme al Código de Puntuación FIG y bases técnicas.',
          'Todas las puntuaciones registradas en el sistema Operix cuentan con el visado del panel de jueces correspondiente.',
          'Se resolvieron las apelaciones técnicas presentadas en conformidad con el reglamento.',
        ],
  }
}
