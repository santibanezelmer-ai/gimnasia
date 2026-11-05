import type { GenderCategory } from '@/core/types/championship'

export type RegistrationStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'scratched'

export interface Club {
  id: string
  organizationId: string
  name: string
  shortName?: string
  code: string
  logoUrl?: string
  city?: string
  stateOrRegion?: string
  country: string
  contactEmail?: string
  contactPhone?: string
  createdAt: string
  updatedAt: string
}

export interface Gymnast {
  id: string
  clubId: string
  organizationId: string
  firstName: string
  lastName: string
  rutOrId?: string
  licenseNumber?: string
  birthDate: string
  gender: GenderCategory
  medicalClearanceDate?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Registration {
  id: string
  championshipId: string
  categoryId: string
  subcategoryId?: string
  gymnastId: string
  clubId: string
  bibNumber?: number
  rotationGroup?: string
  subdivision?: string
  startingApparatus?: string
  startOrder?: number
  status: RegistrationStatus
  approvedAt?: string
  approvedByUserId?: string
  createdAt: string
  updatedAt: string
  gymnast?: Gymnast
  club?: Club
}
