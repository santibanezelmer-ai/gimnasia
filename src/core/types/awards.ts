/**
 * Domain types for Operix Awards & Ceremonies.
 * Ciclo Olímpico FIG 2025-2028.
 * 
 * Desarrollado por Comercial Hels SpA.
 */

export type AwardCeremonyType = 'all_around' | 'apparatus' | 'team' | 'club_tally' | 'special'

export type CeremonyStatus = 'pending' | 'in_progress' | 'completed'

export type FewParticipantsRule = 'standard_all' | 'strict_n_minus_one'

export interface SpecialAwardEntry {
  id: string
  title: string
  description?: string
  recipientName: string
  clubName?: string
  medalOrPrize?: string
}

export interface AwardsConfig {
  placesAwardedCount: number // Default 3, can be 1..8
  fewParticipantsRule: FewParticipantsRule
  includeTrophiesForTeams: boolean
  includeClubMedals: boolean
  specialAwards: SpecialAwardEntry[]
}

export interface AwardPodiumPlace {
  rank: number
  isExAequo: boolean
  medal?: 'gold' | 'silver' | 'bronze'
  trophy?: boolean
  diplomaEligible: boolean
  awardTitle: string
  gymnastId?: string
  gymnastName?: string
  clubId: string
  clubName: string
  categoryName?: string
  apparatusCode?: string
  apparatusName?: string
  finalScore?: number
  tieBreakInfo?: string
  participatingGymnastsCount?: number
  teamMembers?: string[]
}

export interface AwardCeremonyItem {
  id: string
  ceremonyKey: string
  ceremonyType: AwardCeremonyType
  title: string
  categoryId?: string
  categoryName?: string
  apparatusCode?: string
  apparatusName?: string
  sequenceOrder: number
  status: CeremonyStatus
  podiumPlaces: AwardPodiumPlace[]
  awardedAt?: string
  awardedByUserId?: string
  awardedByUserName?: string
  totalCompetitors: number
  isFewParticipants: boolean
  fewParticipantsNote?: string
}

export interface ClubMedalStandingWithAthletes {
  rank: number
  isExAequo: boolean
  clubId: string
  clubName: string
  gold: number
  silver: number
  bronze: number
  total: number
  awardedAthletesCount: number
}
