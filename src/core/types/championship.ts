/**
 * Core domain types for Gymnastics Championships.
 */

export type ChampionshipVisibility = 'public' | 'private' | 'invitational'

export type ChampionshipStatus = 
  | 'draft'
  | 'registration_open'
  | 'registration_closed'
  | 'in_progress'
  | 'completed'
  | 'archived'

export type GymnasticsDiscipline = 
  | 'GAF' // Gimnasia Artística Femenina (Women's Artistic Gymnastics)
  | 'GAM' // Gimnasia Artística Masculina (Men's Artistic Gymnastics)
  | 'GR'  // Gimnasia Rítmica (Rhythmic Gymnastics)
  | 'TRA' // Trampolín (Trampoline Gymnastics)
  | 'AER' // Gimnasia Aeróbica (Aerobic Gymnastics)
  | 'ACRO'// Gimnasia Acrobática (Acrobatic Gymnastics)

export type ScorePublicationStatus = 
  | 'unrealtime_hidden'    // Internal/judge draft, not visible to public
  | 'provisional'          // Visible in live stream/provisional board
  | 'official_approved'    // Final approved score, published to official reports

export interface Championship {
  id: string
  organizationId: string
  name: string
  slug: string
  description?: string
  startDate: string
  endDate: string
  location?: string
  visibility: ChampionshipVisibility
  status: ChampionshipStatus
  rulesetVersion: string          // e.g. "FIG_2025_2028_V1", "USAG_LEVELS_2024"
  scoringSchemaVersion: string    // Versioned JSON schema identifier for score calculations
  createdAt: string
  updatedAt: string
}

export interface Apparatus {
  id: string
  discipline: GymnasticsDiscipline
  code: string                    // e.g. "VT" (Vault), "UB" (Uneven Bars), "BB" (Balance Beam), "FX" (Floor Exercise)
  name: string                    // e.g. "Salto", "Barras Asimétricas", "Viga", "Suelo"
  sortOrder: number
}

export interface ScoreAuditEntry {
  id: string
  scoreId: string
  modifiedByUserId: string
  reason: string
  previousValue: Record<string, unknown>
  newValue: Record<string, unknown>
  createdAt: string
}
