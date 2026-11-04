/**
 * FIG (Fédération Internationale de Gymnastique) Official Disciplines & Apparatuses
 * Code of Points (Ciclo Olímpico 2025-2028).
 * 
 * Desarrollado por Comercial Hels SpA para Operix Gymnastics.
 */

import type { GymnasticsDiscipline } from '../types/championship'

export interface ApparatusDefinition {
  code: string
  name: string
  description?: string
  sortOrder: number
  scoringType: 'artistic_fig' | 'rhythmic_fig' | 'aerobic_fig' | 'acrobatic_fig' | 'trampoline_fig' | 'parkour_speed' | 'parkour_freestyle'
  hasArtisticScore?: boolean
  hasToFAndHD?: boolean
  isTimeBased?: boolean // Si es menor tiempo = mejor (ej. Parkour Speed)
  unit: string // 'pts' | 's'
}

export interface DisciplineDefinition {
  code: GymnasticsDiscipline
  name: string
  shortName: string
  figCode: string
  description: string
  genderSupport: 'female' | 'male' | 'mixed' | 'all'
  apparatuses: ApparatusDefinition[]
  rulesetReference: string
}

export const OFFICIAL_DISCIPLINES: Record<GymnasticsDiscipline, DisciplineDefinition> = {
  GAF: {
    code: 'GAF',
    name: 'Gimnasia Artística Femenina',
    shortName: 'Artística Femenina',
    figCode: 'WAG',
    description: 'Disciplina olímpica compuesta por Salto, Barras Asimétricas, Viga de Equilibrio y Suelo.',
    genderSupport: 'female',
    rulesetReference: 'Código de Puntuación FIG GAF 2025-2028',
    apparatuses: [
      { code: 'VT', name: 'Salto de Caballo / Salto', sortOrder: 1, scoringType: 'artistic_fig', unit: 'pts' },
      { code: 'UB', name: 'Barras Asimétricas', sortOrder: 2, scoringType: 'artistic_fig', unit: 'pts' },
      { code: 'BB', name: 'Viga de Equilibrio', sortOrder: 3, scoringType: 'artistic_fig', unit: 'pts' },
      { code: 'FX', name: 'Suelo / Manos Libres', sortOrder: 4, scoringType: 'artistic_fig', unit: 'pts' },
    ],
  },
  GAM: {
    code: 'GAM',
    name: 'Gimnasia Artística Masculina',
    shortName: 'Artística Masculina',
    figCode: 'MAG',
    description: 'Disciplina olímpica compuesta por 6 aparatos masculinos: Suelo, Arzones, Anillas, Salto, Paralelas y Barra Fija.',
    genderSupport: 'male',
    rulesetReference: 'Código de Puntuación FIG GAM 2025-2028',
    apparatuses: [
      { code: 'FX', name: 'Suelo', sortOrder: 1, scoringType: 'artistic_fig', unit: 'pts' },
      { code: 'PH', name: 'Caballo con Arzones', sortOrder: 2, scoringType: 'artistic_fig', unit: 'pts' },
      { code: 'SR', name: 'Anillas', sortOrder: 3, scoringType: 'artistic_fig', unit: 'pts' },
      { code: 'VT', name: 'Salto', sortOrder: 4, scoringType: 'artistic_fig', unit: 'pts' },
      { code: 'PB', name: 'Barras Paralelas', sortOrder: 5, scoringType: 'artistic_fig', unit: 'pts' },
      { code: 'HB', name: 'Barra Fija', sortOrder: 6, scoringType: 'artistic_fig', unit: 'pts' },
    ],
  },
  GR: {
    code: 'GR',
    name: 'Gimnasia Rítmica',
    shortName: 'Rítmica',
    figCode: 'RG',
    description: 'Disciplina reglamentada por la FIG que combina danza, expresión y manejo de implementos. Evaluación: D (Dificultad DB+DA) + A (Artística) + E (Ejecución) - ND.',
    genderSupport: 'female',
    rulesetReference: 'Código de Puntuación FIG GR 2025-2028',
    apparatuses: [
      { code: 'HOOP', name: 'Aro', sortOrder: 1, scoringType: 'rhythmic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'BALL', name: 'Pelota', sortOrder: 2, scoringType: 'rhythmic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'CLUBS', name: 'Mazas', sortOrder: 3, scoringType: 'rhythmic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'RIBBON', name: 'Cinta', sortOrder: 4, scoringType: 'rhythmic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'FREE', name: 'Manos Libres', sortOrder: 5, scoringType: 'rhythmic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'GROUP', name: 'Conjunto / General', sortOrder: 6, scoringType: 'rhythmic_fig', hasArtisticScore: true, unit: 'pts' },
    ],
  },
  TRA: {
    code: 'TRA',
    name: 'Gimnasia Trampolín',
    shortName: 'Trampolín',
    figCode: 'TRA',
    description: 'Disciplina olímpica de trampolín acrobático y disciplinas asociadas (Doble Minitramp, Tumbling y Sincronizado). Puntuación: D + E + ToF + HD - ND.',
    genderSupport: 'all',
    rulesetReference: 'Código de Puntuación FIG Trampolín 2025-2028',
    apparatuses: [
      { code: 'TRA', name: 'Trampolín Individual', sortOrder: 1, scoringType: 'trampoline_fig', hasToFAndHD: true, unit: 'pts' },
      { code: 'DMT', name: 'Doble Minitramp (DMT)', sortOrder: 2, scoringType: 'trampoline_fig', unit: 'pts' },
      { code: 'TUM', name: 'Tumbling', sortOrder: 3, scoringType: 'trampoline_fig', unit: 'pts' },
      { code: 'SYN', name: 'Trampolín Sincronizado', sortOrder: 4, scoringType: 'trampoline_fig', hasToFAndHD: true, unit: 'pts' },
    ],
  },
  AER: {
    code: 'AER',
    name: 'Gimnasia Aeróbica',
    shortName: 'Aeróbica',
    figCode: 'AER',
    description: 'Disciplina que demuestra dinamismo, fuerza, flexibilidad y musicalidad en rutinas continuas de alta intensidad. Puntuación: D + A + E - ND.',
    genderSupport: 'all',
    rulesetReference: 'Código de Puntuación FIG Aeróbica 2025-2028',
    apparatuses: [
      { code: 'IW', name: 'Individual Femenino (IW)', sortOrder: 1, scoringType: 'aerobic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'IM', name: 'Individual Masculino (IM)', sortOrder: 2, scoringType: 'aerobic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'MP', name: 'Pareja Mixta (MP)', sortOrder: 3, scoringType: 'aerobic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'TR', name: 'Trío (TR)', sortOrder: 4, scoringType: 'aerobic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'GR', name: 'Grupo (GR)', sortOrder: 5, scoringType: 'aerobic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'AD', name: 'Aerobic Dance (AD)', sortOrder: 6, scoringType: 'aerobic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'AS', name: 'Aerobic Step (AS)', sortOrder: 7, scoringType: 'aerobic_fig', hasArtisticScore: true, unit: 'pts' },
    ],
  },
  ACRO: {
    code: 'ACRO',
    name: 'Gimnasia Acrobática',
    shortName: 'Acrobática',
    figCode: 'ACRO',
    description: 'Disciplina deportiva basada en equilibrios estáticos, lanzamientos dinámicos y musicalidad por parejas o grupos. Puntuación: D + A + E - ND.',
    genderSupport: 'all',
    rulesetReference: 'Código de Puntuación FIG Acrobática 2025-2028',
    apparatuses: [
      { code: 'BAL', name: 'Ejercicio Estático / Equilibrio (Balance)', sortOrder: 1, scoringType: 'acrobatic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'DYN', name: 'Ejercicio Dinámico (Dynamic / Tempo)', sortOrder: 2, scoringType: 'acrobatic_fig', hasArtisticScore: true, unit: 'pts' },
      { code: 'COM', name: 'Ejercicio Combinado (Combined)', sortOrder: 3, scoringType: 'acrobatic_fig', hasArtisticScore: true, unit: 'pts' },
    ],
  },
  PK: {
    code: 'PK',
    name: 'Parkour FIG',
    shortName: 'Parkour',
    figCode: 'PK',
    description: 'Disciplina oficial de la FIG que supera obstáculos con rapidez y fluidez técnica. Incluye modalidad Speed (menor tiempo en segundos) y Freestyle (creatividad, dificultad y estilo).',
    genderSupport: 'all',
    rulesetReference: 'Reglamento Oficial FIG Parkour 2025-2028',
    apparatuses: [
      { code: 'SPD', name: 'Parkour Velocidad (Speed)', sortOrder: 1, scoringType: 'parkour_speed', isTimeBased: true, unit: 's' },
      { code: 'FR', name: 'Parkour Estilo Libre (Freestyle)', sortOrder: 2, scoringType: 'parkour_freestyle', unit: 'pts' },
    ],
  },
}

export const DISCIPLINES_LIST = Object.values(OFFICIAL_DISCIPLINES)
