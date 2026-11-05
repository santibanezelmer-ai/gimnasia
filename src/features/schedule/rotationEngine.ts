/**
 * Olympic Gymnastics Rotation & Marshaling Engine (FIG Standards).
 * 
 * Manages:
 * 1. Olympic apparatus rotation cycles (VT -> UB -> BB -> FX, etc.).
 * 2. Subdivision groupings and running orders.
 * 3. Live marshaling / "En Pista / En Preparación" state management.
 * 
 * Desarrollado por Comercial Hels SpA para Operix Gymnastics.
 */

export interface MarshalingAthlete {
  registrationId: string
  gymnastId: string
  gymnastName: string
  clubId: string
  clubName: string
  bibNumber?: number
  categoryName?: string
  subdivision?: string
  rotationGroup: string
  startingApparatus: string
  startOrder: number
}

export interface GroupRotationSchedule {
  groupName: string
  rotations: {
    rotationNumber: number
    apparatusCode: string
  }[]
}

export interface ApparatusLiveMarshalingState {
  apparatusCode: string
  apparatusName: string
  currentRotation: number
  currentAthlete?: MarshalingAthlete
  nextAthlete?: MarshalingAthlete
  waitingAthletes: MarshalingAthlete[]
}

/**
 * Calculates which apparatus a group is competing on for a given rotation number
 * following the standard Olympic cycle (Salto -> Asimétricas -> Viga -> Suelo).
 */
export function getApparatusForRotation(
  apparatusCodes: string[],
  startingApparatusIndex: number,
  rotationNumber: number
): string {
  if (!apparatusCodes || apparatusCodes.length === 0) return 'VT'
  const offset = (rotationNumber - 1) % apparatusCodes.length
  const targetIndex = (startingApparatusIndex + offset) % apparatusCodes.length
  return apparatusCodes[targetIndex]
}

/**
 * Generates the full 4-rotation (or N-rotation) Olympic matrix for all groups.
 */
export function generateOlympicRotationMatrix(
  groupNames: string[],
  apparatusCodes: string[]
): GroupRotationSchedule[] {
  const numRotations = apparatusCodes.length

  return groupNames.map((groupName, groupIdx) => {
    // Each group starts at apparatus index = groupIdx % numRotations
    const startingAppIndex = groupIdx % numRotations
    const rotations = []

    for (let rot = 1; rot <= numRotations; rot++) {
      rotations.push({
        rotationNumber: rot,
        apparatusCode: getApparatusForRotation(apparatusCodes, startingAppIndex, rot),
      })
    }

    return {
      groupName,
      rotations,
    }
  })
}

/**
 * Filters and orders the athletes who are currently scheduled at a specific apparatus
 * for the active rotation number.
 */
export function getAthletesAtApparatusForRotation(
  athletes: MarshalingAthlete[],
  apparatusCodes: string[],
  targetApparatusCode: string,
  rotationNumber: number
): MarshalingAthlete[] {
  return athletes
    .filter((ath) => {
      const startingIndex = apparatusCodes.indexOf(ath.startingApparatus)
      const validStartingIndex = startingIndex >= 0 ? startingIndex : 0
      const currentApp = getApparatusForRotation(apparatusCodes, validStartingIndex, rotationNumber)
      return currentApp === targetApparatusCode
    })
    .sort((a, b) => a.startOrder - b.startOrder)
}

/**
 * Determines the current, on-deck (next), and waiting athletes for an apparatus.
 * If currentRegistrationId is specified, finds that athlete; otherwise defaults to 1st in order.
 */
export function computeApparatusMarshalingState(
  athletesOnApparatus: MarshalingAthlete[],
  apparatusCode: string,
  apparatusName: string,
  currentRotation: number,
  currentRegistrationId?: string
): ApparatusLiveMarshalingState {
  if (athletesOnApparatus.length === 0) {
    return {
      apparatusCode,
      apparatusName,
      currentRotation,
      waitingAthletes: [],
    }
  }

  let currentIndex = 0
  if (currentRegistrationId) {
    const foundIdx = athletesOnApparatus.findIndex((a) => a.registrationId === currentRegistrationId)
    if (foundIdx >= 0) {
      currentIndex = foundIdx
    }
  }

  const currentAthlete = athletesOnApparatus[currentIndex]
  const nextAthlete = athletesOnApparatus[currentIndex + 1]
  const waitingAthletes = athletesOnApparatus.slice(currentIndex + 2)

  return {
    apparatusCode,
    apparatusName,
    currentRotation,
    currentAthlete,
    nextAthlete,
    waitingAthletes,
  }
}

/**
 * Advances to the next athlete in the running order.
 * Returns the new currentRegistrationId, or null if the rotation is finished.
 */
export function advanceApparatusAthlete(
  athletesOnApparatus: MarshalingAthlete[],
  currentRegistrationId?: string
): string | null {
  if (athletesOnApparatus.length === 0) return null
  if (!currentRegistrationId) {
    return athletesOnApparatus[0]?.registrationId || null
  }

  const foundIdx = athletesOnApparatus.findIndex((a) => a.registrationId === currentRegistrationId)
  if (foundIdx >= 0 && foundIdx + 1 < athletesOnApparatus.length) {
    return athletesOnApparatus[foundIdx + 1].registrationId
  }

  // Already at the last athlete
  return null
}

/**
 * Auto-assigns athletes to balanced rotation groups and running orders.
 * Keeps athletes from the same club together so coaches can accompany their gymnasts.
 */
export function autoAssignRotationGroups(
  athletes: {
    registrationId: string
    gymnastId: string
    gymnastName: string
    clubId: string
    clubName: string
    categoryName?: string
  }[],
  apparatusCodes: string[],
  groupPrefix = 'Grupo',
  subdivisionName = 'Subdivisión 1'
): MarshalingAthlete[] {
  if (athletes.length === 0) return []

  const numApparatuses = apparatusCodes.length || 4
  const groupCount = Math.min(numApparatuses, Math.max(1, Math.ceil(athletes.length / 8)))

  // Group athletes by club to keep club teammates together
  const clubMap = new Map<string, typeof athletes>()
  for (const ath of athletes) {
    const list = clubMap.get(ath.clubId) || []
    list.push(ath)
    clubMap.set(ath.clubId, list)
  }

  // Sort clubs by size descending (place largest clubs first)
  const sortedClubs = Array.from(clubMap.values()).sort((a, b) => b.length - a.length)

  const groupBuckets: (typeof athletes)[] = Array.from({ length: groupCount }, () => [])

  // Greedy balance assignment across group buckets
  for (const clubGymnasts of sortedClubs) {
    // Find bucket with least athletes
    let minIdx = 0
    let minCount = groupBuckets[0].length
    for (let i = 1; i < groupCount; i++) {
      if (groupBuckets[i].length < minCount) {
        minCount = groupBuckets[i].length
        minIdx = i
      }
    }
    groupBuckets[minIdx].push(...clubGymnasts)
  }

  const result: MarshalingAthlete[] = []

  // Assign group names, starting apparatuses, bib numbers and running order
  let globalBib = 101

  groupBuckets.forEach((bucket, groupIdx) => {
    const groupLetter = String.fromCharCode(65 + groupIdx) // A, B, C, D...
    const groupName = `${groupPrefix} ${groupLetter}`
    const startingApp = apparatusCodes[groupIdx % numApparatuses]

    bucket.forEach((ath, athIdx) => {
      result.push({
        registrationId: ath.registrationId,
        gymnastId: ath.gymnastId,
        gymnastName: ath.gymnastName,
        clubId: ath.clubId,
        clubName: ath.clubName,
        bibNumber: globalBib++,
        categoryName: ath.categoryName,
        subdivision: subdivisionName,
        rotationGroup: groupName,
        startingApparatus: startingApp,
        startOrder: athIdx + 1,
      })
    })
  })

  return result
}
