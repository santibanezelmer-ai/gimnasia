/**
 * Pruebas del Motor de Premiación y Medallero — Operix Awards.
 * Ciclo Olímpico FIG 2025-2028.
 * 
 * Desarrollado por Comercial Hels SpA.
 */

import { describe, it, expect } from 'vitest'
import {
  buildAwardPodiumFromAllAround,
  buildAwardPodiumFromApparatus,
  buildAwardPodiumFromTeams,
  computeExAequoClubMedalTally,
  generateCeremonySchedule,
  DEFAULT_AWARDS_CONFIG,
} from '@/features/awards/awardsEngine'
import {
  computeAllAroundStandings,
  computeApparatusStandings,
  type GymnastScoreEntry,
} from '@/features/standings/standingsEngine'
import type { Category } from '@/core/types/championship'
import type { AwardsConfig } from '@/core/types/awards'

describe('Operix Awards — Motor de Premiación y Medallero', () => {
  // Mock Category
  const mockCategory: Category = {
    id: 'cat-senior-a',
    championshipId: 'champ-1',
    discipline: 'GAF',
    name: 'Senior FIG A',
    code: 'SR-A',
    gender: 'female',
    scoringRegime: 'free',
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  // 1. Ex-Aequo en All-Around (Empate oficial no resuelto por cascada FIG)
  it('gestiona correctamente empates ex-aequo en All-Around asignando medallas compartidas', () => {
    // 2 gimnastas con notas idénticas en todos los aparatos
    const scores: GymnastScoreEntry[] = [
      // Gimnasta 1
      {
        gymnastId: 'g1',
        gymnastName: 'Sofía Gomez',
        clubId: 'club-1',
        clubName: 'Club Élite',
        categoryId: 'cat-senior-a',
        apparatusCode: 'VT',
        finalScore: 14.0,
        dScore: 5.0,
        eScoreAvg: 9.0,
        status: 'official_approved',
      },
      {
        gymnastId: 'g1',
        gymnastName: 'Sofía Gomez',
        clubId: 'club-1',
        clubName: 'Club Élite',
        categoryId: 'cat-senior-a',
        apparatusCode: 'UB',
        finalScore: 13.5,
        dScore: 5.0,
        eScoreAvg: 8.5,
        status: 'official_approved',
      },
      // Gimnasta 2 (Idéntica en todo a Sofía)
      {
        gymnastId: 'g2',
        gymnastName: 'Valentina Silva',
        clubId: 'club-2',
        clubName: 'Club Olímpico',
        categoryId: 'cat-senior-a',
        apparatusCode: 'VT',
        finalScore: 14.0,
        dScore: 5.0,
        eScoreAvg: 9.0,
        status: 'official_approved',
      },
      {
        gymnastId: 'g2',
        gymnastName: 'Valentina Silva',
        clubId: 'club-2',
        clubName: 'Club Olímpico',
        categoryId: 'cat-senior-a',
        apparatusCode: 'UB',
        finalScore: 13.5,
        dScore: 5.0,
        eScoreAvg: 8.5,
        status: 'official_approved',
      },
      // Gimnasta 3 (Tercer lugar)
      {
        gymnastId: 'g3',
        gymnastName: 'Camila Rojas',
        clubId: 'club-3',
        clubName: 'Club Gimnástico Sur',
        categoryId: 'cat-senior-a',
        apparatusCode: 'VT',
        finalScore: 13.0,
        dScore: 4.5,
        eScoreAvg: 8.5,
        status: 'official_approved',
      },
      {
        gymnastId: 'g3',
        gymnastName: 'Camila Rojas',
        clubId: 'club-3',
        clubName: 'Club Gimnástico Sur',
        categoryId: 'cat-senior-a',
        apparatusCode: 'UB',
        finalScore: 12.0,
        dScore: 4.0,
        eScoreAvg: 8.0,
        status: 'official_approved',
      },
    ]

    const aaStandings = computeAllAroundStandings(scores, { categoryId: 'cat-senior-a' })
    const { podiumPlaces } = buildAwardPodiumFromAllAround({
      standings: aaStandings,
      config: DEFAULT_AWARDS_CONFIG,
    })

    expect(podiumPlaces).toHaveLength(3)
    // Ambas gimnastas comparten el 1° lugar con medalla de oro
    expect(podiumPlaces[0].rank).toBe(1)
    expect(podiumPlaces[0].medal).toBe('gold')
    expect(podiumPlaces[0].isExAequo).toBe(true)

    expect(podiumPlaces[1].rank).toBe(1)
    expect(podiumPlaces[1].medal).toBe('gold')
    expect(podiumPlaces[1].isExAequo).toBe(true)

    // La siguiente gimnasta es 3° lugar (salta el 2° por haber dos 1eros)
    expect(podiumPlaces[2].rank).toBe(3)
    expect(podiumPlaces[2].medal).toBe('bronze')
    expect(podiumPlaces[2].isExAequo).toBe(false)
  })

  // 2. Empates ex-aequo en Finales por Aparato
  it('asigna correctamente podio y medallas ex-aequo en finales por aparato', () => {
    const scores: GymnastScoreEntry[] = [
      {
        gymnastId: 'g1',
        gymnastName: 'Gimnasta A',
        clubId: 'c1',
        clubName: 'Club 1',
        categoryId: 'cat-senior-a',
        apparatusCode: 'FX',
        finalScore: 13.8,
        dScore: 5.2,
        eScoreAvg: 8.6,
        status: 'official_approved',
      },
      {
        gymnastId: 'g2',
        gymnastName: 'Gimnasta B',
        clubId: 'c2',
        clubName: 'Club 2',
        categoryId: 'cat-senior-a',
        apparatusCode: 'FX',
        finalScore: 13.8,
        dScore: 5.2,
        eScoreAvg: 8.6,
        status: 'official_approved',
      },
    ]

    const standings = computeApparatusStandings(scores, 'FX', 'cat-senior-a')
    const { podiumPlaces } = buildAwardPodiumFromApparatus({
      standings,
      apparatusCode: 'FX',
      apparatusName: 'Suelo',
      config: DEFAULT_AWARDS_CONFIG,
    })

    expect(podiumPlaces).toHaveLength(2)
    expect(podiumPlaces[0].rank).toBe(1)
    expect(podiumPlaces[0].medal).toBe('gold')
    expect(podiumPlaces[0].isExAequo).toBe(true)
    expect(podiumPlaces[1].rank).toBe(1)
    expect(podiumPlaces[1].medal).toBe('gold')
    expect(podiumPlaces[1].isExAequo).toBe(true)
  })

  // 3. Medallero de Clubes con idéntico registro (Ex-Aequo Institucional)
  it('asigna la misma posición compartida (ex-aequo) a clubes con idéntico medallero', () => {
    // Simulamos standings donde Club Alfa y Club Beta obtienen 1 Oro y 1 Plata cada uno
    const aaStandings = [
      {
        rank: 1,
        gymnastId: 'g1',
        gymnastName: 'Atleta Alfa',
        clubId: 'club-alfa',
        clubName: 'Club Alfa',
        totalScore: 55.0,
        totalEScore: 35.0,
        apparatusScores: {},
        medal: 'gold' as const,
      },
      {
        rank: 2,
        gymnastId: 'g2',
        gymnastName: 'Atleta Beta',
        clubId: 'club-beta',
        clubName: 'Club Beta',
        totalScore: 54.0,
        totalEScore: 34.0,
        apparatusScores: {},
        medal: 'silver' as const,
      },
    ]

    const appStandings = [
      [
        {
          rank: 1,
          gymnastId: 'g3',
          gymnastName: 'Atleta Beta 2',
          clubId: 'club-beta',
          clubName: 'Club Beta',
          apparatusCode: 'VT',
          finalScore: 14.0,
          dScore: 5.0,
          eScoreAvg: 9.0,
          medal: 'gold' as const,
        },
        {
          rank: 2,
          gymnastId: 'g4',
          gymnastName: 'Atleta Alfa 2',
          clubId: 'club-alfa',
          clubName: 'Club Alfa',
          apparatusCode: 'VT',
          finalScore: 13.9,
          dScore: 5.0,
          eScoreAvg: 8.9,
          medal: 'silver' as const,
        },
      ],
    ]

    const tally = computeExAequoClubMedalTally(aaStandings, appStandings)

    expect(tally).toHaveLength(2)
    // Ambos tienen 1 Oro, 1 Plata, 0 Bronces, Total 2
    expect(tally[0].gold).toBe(1)
    expect(tally[0].silver).toBe(1)
    expect(tally[1].gold).toBe(1)
    expect(tally[1].silver).toBe(1)

    // Ambos comparten el 1° lugar
    expect(tally[0].rank).toBe(1)
    expect(tally[1].rank).toBe(1)
    expect(tally[0].isExAequo).toBe(true)
    expect(tally[1].isExAequo).toBe(true)
    expect(tally[0].awardedAthletesCount).toBe(2)
    expect(tally[1].awardedAthletesCount).toBe(2)
  })

  // 4. Categorías con pocos participantes (1 y 2 gimnastas)
  describe('Categorías con pocos participantes', () => {
    const singleAthleteStanding = [
      {
        rank: 1,
        gymnastId: 'single-1',
        gymnastName: 'Única Participante',
        clubId: 'club-sol',
        clubName: 'Club Sol',
        totalScore: 48.0,
        totalEScore: 32.0,
        apparatusScores: {},
        medal: 'gold' as const,
      },
    ]

    it('bajo regla "standard_all" otorga medalla de oro y diploma a la única participante', () => {
      const res = buildAwardPodiumFromAllAround({
        standings: singleAthleteStanding,
        config: { fewParticipantsRule: 'standard_all' },
      })
      expect(res.totalCompetitors).toBe(1)
      expect(res.isFewParticipants).toBe(true)
      expect(res.podiumPlaces[0].rank).toBe(1)
      expect(res.podiumPlaces[0].medal).toBe('gold')
      expect(res.podiumPlaces[0].diplomaEligible).toBe(true)
    })

    it('bajo regla "strict_n_minus_one" otorga mención de reconocimiento sin medalla oficial', () => {
      const res = buildAwardPodiumFromAllAround({
        standings: singleAthleteStanding,
        config: { fewParticipantsRule: 'strict_n_minus_one' },
      })
      expect(res.totalCompetitors).toBe(1)
      expect(res.isFewParticipants).toBe(true)
      expect(res.podiumPlaces[0].medal).toBeUndefined()
      expect(res.podiumPlaces[0].awardTitle).toContain('Reconocimiento')
      expect(res.podiumPlaces[0].diplomaEligible).toBe(true)
    })

    it('con 2 participantes premia únicamente 1° y 2° lugar (sin bronce)', () => {
      const twoAthletes = [
        ...singleAthleteStanding,
        {
          rank: 2,
          gymnastId: 'two-2',
          gymnastName: 'Segunda Participante',
          clubId: 'club-luna',
          clubName: 'Club Luna',
          totalScore: 45.0,
          totalEScore: 30.0,
          apparatusScores: {},
          medal: 'silver' as const,
        },
      ]

      const res = buildAwardPodiumFromAllAround({
        standings: twoAthletes,
        config: DEFAULT_AWARDS_CONFIG,
      })

      expect(res.totalCompetitors).toBe(2)
      expect(res.isFewParticipants).toBe(true)
      expect(res.podiumPlaces).toHaveLength(2)
      expect(res.podiumPlaces[0].medal).toBe('gold')
      expect(res.podiumPlaces[1].medal).toBe('silver')
      // No existe 3° lugar
      expect(res.podiumPlaces.find((p) => p.rank === 3)).toBeUndefined()
    })
  })

  // 5. Exclusión estricta de notas pendientes o provisionales
  it('excluye rigurosamente notas provisionales y borradores de las ceremonias oficiales', () => {
    const mixedScores: GymnastScoreEntry[] = [
      {
        gymnastId: 'g1',
        gymnastName: 'Gimnasta Aprobada',
        clubId: 'c1',
        clubName: 'Club 1',
        categoryId: 'cat-senior-a',
        apparatusCode: 'VT',
        finalScore: 14.5,
        dScore: 5.5,
        eScoreAvg: 9.0,
        status: 'official_approved',
      },
      {
        gymnastId: 'g2',
        gymnastName: 'Gimnasta Provisional',
        clubId: 'c2',
        clubName: 'Club 2',
        categoryId: 'cat-senior-a',
        apparatusCode: 'VT',
        finalScore: 15.0,
        dScore: 5.5,
        eScoreAvg: 9.5,
        status: 'provisional', // NOT APPROVED
      },
      {
        gymnastId: 'g3',
        gymnastName: 'Gimnasta Borrador',
        clubId: 'c3',
        clubName: 'Club 3',
        categoryId: 'cat-senior-a',
        apparatusCode: 'VT',
        finalScore: 14.8,
        dScore: 5.5,
        eScoreAvg: 9.3,
        status: 'draft', // DRAFT
      },
    ]

    const schedule = generateCeremonySchedule({
      categories: [mockCategory],
      approvedScores: mixedScores,
      config: DEFAULT_AWARDS_CONFIG,
    })

    // Las ceremonias solo deben contener a Gimnasta Aprobada
    const vtCeremony = schedule.find((c) => c.apparatusCode === 'VT')
    expect(vtCeremony).toBeDefined()
    expect(vtCeremony?.totalCompetitors).toBe(1)
    expect(vtCeremony?.podiumPlaces[0].gymnastName).toBe('Gimnasta Aprobada')
    expect(vtCeremony?.podiumPlaces.find((p) => p.gymnastName === 'Gimnasta Provisional')).toBeUndefined()
    expect(vtCeremony?.podiumPlaces.find((p) => p.gymnastName === 'Gimnasta Borrador')).toBeUndefined()
  })

  // 6. Generación de podio por equipos con trofeos
  it('genera podio por equipos asignando trofeos a los mejores lugares', () => {
    const teamStandings = [
      {
        rank: 1,
        clubId: 'c1',
        clubName: 'Club Campeón',
        totalScore: 165.4,
        participatingGymnastsCount: 4,
        apparatusTotals: { VT: 42.0, UB: 41.0, BB: 41.2, FX: 41.2 },
      },
      {
        rank: 2,
        clubId: 'c2',
        clubName: 'Club Subcampeón',
        totalScore: 160.0,
        participatingGymnastsCount: 4,
        apparatusTotals: { VT: 40.0, UB: 40.0, BB: 40.0, FX: 40.0 },
      },
    ]

    const { podiumPlaces } = buildAwardPodiumFromTeams({
      standings: teamStandings,
      config: { includeTrophiesForTeams: true },
    })

    expect(podiumPlaces).toHaveLength(2)
    expect(podiumPlaces[0].trophy).toBe(true)
    expect(podiumPlaces[0].awardTitle).toContain('Trofeo de Oro')
    expect(podiumPlaces[1].trophy).toBe(true)
    expect(podiumPlaces[1].awardTitle).toContain('Trofeo de Plata')
  })

  // 7. Secuencia lógica de ceremonias y control de estado
  it('organiza las ceremonias en secuencia ordenada (Aparatos -> AA -> Equipos -> Medallero)', () => {
    const scores: GymnastScoreEntry[] = [
      {
        gymnastId: 'g1',
        gymnastName: 'Atleta Uno',
        clubId: 'c1',
        clubName: 'Club 1',
        categoryId: 'cat-senior-a',
        apparatusCode: 'VT',
        finalScore: 14.0,
        dScore: 5.0,
        eScoreAvg: 9.0,
        status: 'official_approved',
      },
      {
        gymnastId: 'g1',
        gymnastName: 'Atleta Uno',
        clubId: 'c1',
        clubName: 'Club 1',
        categoryId: 'cat-senior-a',
        apparatusCode: 'UB',
        finalScore: 13.0,
        dScore: 4.5,
        eScoreAvg: 8.5,
        status: 'official_approved',
      },
    ]

    const config: AwardsConfig = {
      ...DEFAULT_AWARDS_CONFIG,
      specialAwards: [
        {
          id: 'sp-1',
          title: 'Premio Espíritu Deportivo',
          recipientName: 'Atleta Uno',
          clubName: 'Club 1',
        },
      ],
    }

    const schedule = generateCeremonySchedule({
      categories: [mockCategory],
      approvedScores: scores,
      config,
    })

    // Debe contener las ceremonias de Aparatos, All-Around, Equipos, Clubes y Especiales
    const types = schedule.map((s) => s.ceremonyType)
    expect(types).toContain('apparatus')
    expect(types).toContain('all_around')
    expect(types).toContain('team')
    expect(types).toContain('club_tally')
    expect(types).toContain('special')

    // Secuencia estrictamente creciente
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].sequenceOrder).toBeGreaterThan(schedule[i - 1].sequenceOrder)
    }
  })

  // 8. Trazabilidad de ceremonias ya realizadas (sin duplicar)
  it('refleja fielmente el estado de ceremonias completadas sin duplicar su ejecución', () => {
    const scores: GymnastScoreEntry[] = [
      {
        gymnastId: 'g1',
        gymnastName: 'Atleta Uno',
        clubId: 'c1',
        clubName: 'Club 1',
        categoryId: 'cat-senior-a',
        apparatusCode: 'VT',
        finalScore: 14.0,
        dScore: 5.0,
        eScoreAvg: 9.0,
        status: 'official_approved',
      },
    ]

    const savedCeremonies = [
      {
        ceremonyKey: 'app_cat-senior-a_VT',
        status: 'completed' as const,
        awardedAt: '2026-11-05T10:00:00Z',
      },
    ]

    const schedule = generateCeremonySchedule({
      categories: [mockCategory],
      approvedScores: scores,
      config: DEFAULT_AWARDS_CONFIG,
      savedCeremonies,
    })

    const vtCeremony = schedule.find((c) => c.ceremonyKey === 'app_cat-senior-a_VT')
    expect(vtCeremony?.status).toBe('completed')
    expect(vtCeremony?.awardedAt).toBe('2026-11-05T10:00:00Z')
  })
})
