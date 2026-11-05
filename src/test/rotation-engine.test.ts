import { describe, it, expect } from 'vitest'
import {
  getApparatusForRotation,
  generateOlympicRotationMatrix,
  getAthletesAtApparatusForRotation,
  computeApparatusMarshalingState,
  advanceApparatusAthlete,
  autoAssignRotationGroups,
  type MarshalingAthlete,
} from '../features/schedule/rotationEngine'

describe('Olympic Rotation & Competition Marshaling Engine', () => {
  const gafApparatuses = ['VT', 'UB', 'BB', 'FX']

  describe('Olympic Apparatus Rotation Cycle', () => {
    it('calculates the exact apparatus cycle for a group starting at Vault (VT)', () => {
      // Starting at VT (index 0)
      expect(getApparatusForRotation(gafApparatuses, 0, 1)).toBe('VT')
      expect(getApparatusForRotation(gafApparatuses, 0, 2)).toBe('UB')
      expect(getApparatusForRotation(gafApparatuses, 0, 3)).toBe('BB')
      expect(getApparatusForRotation(gafApparatuses, 0, 4)).toBe('FX')
    })

    it('calculates the exact apparatus cycle for a group starting at Beam (BB)', () => {
      // Starting at BB (index 2)
      expect(getApparatusForRotation(gafApparatuses, 2, 1)).toBe('BB')
      expect(getApparatusForRotation(gafApparatuses, 2, 2)).toBe('FX')
      expect(getApparatusForRotation(gafApparatuses, 2, 3)).toBe('VT')
      expect(getApparatusForRotation(gafApparatuses, 2, 4)).toBe('UB')
    })

    it('generates the complete 4-rotation Olympic matrix for 4 groups', () => {
      const groups = ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D']
      const matrix = generateOlympicRotationMatrix(groups, gafApparatuses)

      expect(matrix).toHaveLength(4)
      // Grupo A: VT -> UB -> BB -> FX
      expect(matrix[0].rotations.map((r) => r.apparatusCode)).toEqual(['VT', 'UB', 'BB', 'FX'])
      // Grupo B: UB -> BB -> FX -> VT
      expect(matrix[1].rotations.map((r) => r.apparatusCode)).toEqual(['UB', 'BB', 'FX', 'VT'])
      // Grupo C: BB -> FX -> VT -> UB
      expect(matrix[2].rotations.map((r) => r.apparatusCode)).toEqual(['BB', 'FX', 'VT', 'UB'])
      // Grupo D: FX -> VT -> UB -> BB
      expect(matrix[3].rotations.map((r) => r.apparatusCode)).toEqual(['FX', 'VT', 'UB', 'BB'])
    })
  })

  describe('Marshaling & Live Call Order', () => {
    const mockAthletes: MarshalingAthlete[] = [
      {
        registrationId: 'reg-1',
        gymnastId: 'g1',
        gymnastName: 'Valentina Toro',
        clubId: 'c1',
        clubName: 'Club Estadio Italiano',
        bibNumber: 101,
        rotationGroup: 'Grupo A',
        startingApparatus: 'VT',
        startOrder: 1,
      },
      {
        registrationId: 'reg-2',
        gymnastId: 'g2',
        gymnastName: 'Florencia Silva',
        clubId: 'c1',
        clubName: 'Club Estadio Italiano',
        bibNumber: 102,
        rotationGroup: 'Grupo A',
        startingApparatus: 'VT',
        startOrder: 2,
      },
      {
        registrationId: 'reg-3',
        gymnastId: 'g3',
        gymnastName: 'Martina Castro',
        clubId: 'c2',
        clubName: 'Manquehue',
        bibNumber: 103,
        rotationGroup: 'Grupo B',
        startingApparatus: 'UB',
        startOrder: 1,
      },
    ]

    it('identifies athletes at Vault in Rotation 1 (Grupo A)', () => {
      const atVT = getAthletesAtApparatusForRotation(mockAthletes, gafApparatuses, 'VT', 1)
      expect(atVT).toHaveLength(2)
      expect(atVT[0].gymnastName).toBe('Valentina Toro')
      expect(atVT[1].gymnastName).toBe('Florencia Silva')
    })

    it('identifies athletes at Uneven Bars in Rotation 2 (Grupo A rotated from VT)', () => {
      const atUB = getAthletesAtApparatusForRotation(mockAthletes, gafApparatuses, 'UB', 2)
      expect(atUB).toHaveLength(2)
      expect(atUB[0].gymnastName).toBe('Valentina Toro')
    })

    it('computes live marshaling state with current athlete and on-deck', () => {
      const atVT = getAthletesAtApparatusForRotation(mockAthletes, gafApparatuses, 'VT', 1)
      const state = computeApparatusMarshalingState(atVT, 'VT', 'Salto de Caballo', 1, 'reg-1')

      expect(state.currentAthlete?.gymnastName).toBe('Valentina Toro')
      expect(state.nextAthlete?.gymnastName).toBe('Florencia Silva')
      expect(state.waitingAthletes).toHaveLength(0)
    })

    it('advances to next athlete in apparatus running order', () => {
      const atVT = getAthletesAtApparatusForRotation(mockAthletes, gafApparatuses, 'VT', 1)
      // Advance from reg-1
      const nextId = advanceApparatusAthlete(atVT, 'reg-1')
      expect(nextId).toBe('reg-2')

      // Advance from reg-2 (end of group)
      const endOfGroup = advanceApparatusAthlete(atVT, 'reg-2')
      expect(endOfGroup).toBeNull()
    })
  })

  describe('Auto-Assignment of Rotation Groups', () => {
    it('groups club teammates together to assist coaches', () => {
      const rawAthletes = [
        { registrationId: 'r1', gymnastId: 'g1', gymnastName: 'Gymnast 1', clubId: 'club-a', clubName: 'Club Alfa' },
        { registrationId: 'r2', gymnastId: 'g2', gymnastName: 'Gymnast 2', clubId: 'club-a', clubName: 'Club Alfa' },
        { registrationId: 'r3', gymnastId: 'g3', gymnastName: 'Gymnast 3', clubId: 'club-b', clubName: 'Club Beta' },
        { registrationId: 'r4', gymnastId: 'g4', gymnastName: 'Gymnast 4', clubId: 'club-b', clubName: 'Club Beta' },
      ]

      const assigned = autoAssignRotationGroups(rawAthletes, gafApparatuses, 'Grupo', 'Subdivisión 1')

      expect(assigned).toHaveLength(4)
      const alfaGymnasts = assigned.filter((a) => a.clubId === 'club-a')
      const betaGymnasts = assigned.filter((a) => a.clubId === 'club-b')

      // All Club Alfa teammates share the same rotation group
      expect(alfaGymnasts[0].rotationGroup).toBe(alfaGymnasts[1].rotationGroup)
      // All Club Beta teammates share the same rotation group
      expect(betaGymnasts[0].rotationGroup).toBe(betaGymnasts[1].rotationGroup)
    })
  })
})
