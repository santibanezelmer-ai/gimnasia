export type JudgePanelRole =
  | 'D1'
  | 'D2'
  | 'E1'
  | 'E2'
  | 'E3'
  | 'E4'
  | 'E5'
  | 'E6'
  | 'LINE'
  | 'TIME'

export type ScoreStatus =
  | 'draft'
  | 'submitted'
  | 'provisional'
  | 'official_approved'

export interface Judge {
  id: string
  organizationId: string
  userId?: string
  firstName: string
  lastName: string
  brevetLevel: string
  disciplines: string[]
  createdAt: string
  updatedAt: string
}

export interface JudgeAssignment {
  id: string
  championshipId: string
  categoryId?: string
  apparatusId: string
  judgeId: string
  panelRole: JudgePanelRole
  rotationGroup?: string
  judge?: Judge
}

export interface Score {
  id: string
  championshipId: string
  registrationId: string
  apparatusId: string
  attemptNumber: number
  dScore: number
  eScores: number[]
  eScoreAvg: number
  neutralDeductions: number
  finalScore: number
  status: ScoreStatus
  submittedByJudgeId?: string
  approvedByUserId?: string
  approvedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface ScoreAudit {
  id: string
  scoreId: string
  organizationId: string
  modifiedByUserId: string
  reason: string
  previousValue: Record<string, unknown>
  newValue: Record<string, unknown>
  createdAt: string
}
