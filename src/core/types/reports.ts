/**
 * Domain types for Operix Reports (Official Tournament Documentation & Result Books).
 * 
 * Desarrollado por Comercial Hels SpA.
 */

export type ReportDocumentType =
  | 'result_book'
  | 'category_results'
  | 'official_minutes'
  | 'diplomas_batch'
  | 'start_list'
  | 'judging_sheets'

export type ReportFileFormat = 'pdf' | 'excel_csv' | 'html'

export interface ChampionshipDocumentRecord {
  id: string
  championshipId: string
  documentType: ReportDocumentType
  title: string
  fileFormat: ReportFileFormat
  filters: Record<string, unknown>
  metadata: Record<string, unknown>
  generatedByUserId?: string
  createdAt: string
}

export interface ClubMedalTally {
  clubId: string
  clubName: string
  gold: number
  silver: number
  bronze: number
  total: number
  rank: number
}

export type DiplomaAwardType =
  | 'participation'
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'all_around_champion'
  | 'apparatus_champion'
  | 'team_champion'

export interface DiplomaAwardItem {
  id: string
  gymnastId: string
  gymnastName: string
  clubId: string
  clubName: string
  categoryName: string
  awardType: DiplomaAwardType
  awardTitle: string
  rank?: number
  apparatusCode?: string
  apparatusName?: string
  finalScore?: number
}

export interface DiplomaTemplateConfig {
  institutionTitle: string      // e.g. "Federación Nacional de Gimnasia / Comité Organizador"
  tournamentSubtitle: string    // e.g. "Por su destacada participación en el Campeonato Nacional"
  tournamentDate: string        // e.g. "Noviembre 2026"
  tournamentLocation: string    // e.g. "Santiago, Chile"
  directorName: string          // e.g. "Director de Torneo"
  directorTitle: string
  headJudgeName: string         // e.g. "Juez Árbitro General FIG"
  headJudgeTitle: string
  accentColor: 'gold' | 'navy' | 'emerald' | 'crimson'
}

export interface OfficialMinutesData {
  championshipName: string
  organizerName: string
  venueName: string
  dates: string
  closingDate: string
  rulesetVersion: string
  totalGymnasts: number
  totalClubs: number
  totalScoresSubmitted: number
  inquiriesCount: number
  inquiriesResolvedCount: number
  presidentName: string
  technicalDirectorName: string
  headJudgeName: string
  observations: string[]
}
