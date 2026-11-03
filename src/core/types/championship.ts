/**
 * Domain types for Phase 6: Championships, Disciplines, Apparatuses, and Categories.
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
  | 'GAF' // Women's Artistic Gymnastics
  | 'GAM' // Men's Artistic Gymnastics
  | 'GR'  // Rhythmic Gymnastics
  | 'TRA' // Trampoline Gymnastics
  | 'AER' // Aerobic Gymnastics
  | 'ACRO'// Acrobatic Gymnastics

export type GenderCategory = 'female' | 'male' | 'mixed'

export interface Championship {
  id: string
  organizationId: string
  name: string
  slug: string
  description?: string
  startDate: string
  endDate: string
  location?: string
  venueName?: string
  visibility: ChampionshipVisibility
  status: ChampionshipStatus
  rulesetVersion: string          // e.g. "FIG_2025_2028_V1", "USAG_LEVELS_2024"
  scoringSchemaVersion: string    // Versioned scoring engine identifier
  bannerUrl?: string
  createdAt: string
  updatedAt: string
}

export interface Apparatus {
  id: string
  discipline: GymnasticsDiscipline
  code: string                    // e.g. "VT", "UB", "BB", "FX"
  name: string                    // e.g. "Salto", "Barras Asimétricas", "Viga", "Suelo"
  sortOrder: number
  iconName?: string
}

export type CategoryScoringRegime =
  | 'free'        // Nivel Libre / Opcional: Jurado D (Dificultad evaluada en vivo) + Jurado E
  | 'obligatory'  // Nivel No Libre / Rutina Establecida: Nota D fija, solo se califica E

export interface Category {
  id: string
  championshipId: string
  discipline: GymnasticsDiscipline
  name: string                    // e.g. "Nivel 3", "FIG Senior"
  code: string                    // e.g. "LVL3", "FIG-SR"
  gender: GenderCategory
  scoringRegime: CategoryScoringRegime
  defaultFixedDScore?: number     // e.g. 10.000 for USAG Levels 1-5 or formativo
  minAge?: number
  maxAge?: number
  sortOrder: number
  subcategories?: Subcategory[]
  apparatuses?: Apparatus[]
  createdAt: string
  updatedAt: string
}

export interface Subcategory {
  id: string
  categoryId: string
  name: string                    // e.g. "Sub-8", "8-9 años", "Juvenil"
  minAge?: number
  maxAge?: number
  sortOrder: number
  createdAt: string
}
