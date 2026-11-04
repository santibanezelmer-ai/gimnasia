import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useOrganization } from '@/features/organizations/OrganizationContext'
import type {
  Championship,
  ChampionshipVisibility,
  ChampionshipStatus,
  Category,
  CategoryScoringRegime,
  GymnasticsDiscipline,
  GenderCategory,
} from '@/core/types/championship'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  Plus,
  Calendar,
  MapPin,
  Eye,
  Settings2,
  AlertCircle,
  Layers,
  X,
  CheckCircle2,
} from 'lucide-react'

export const ChampionshipsManager: React.FC = () => {
  const { activeOrganization, activeRole } = useOrganization()
  const [championships, setChampionships] = useState<Championship[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Form fields for Championship
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [location, setLocation] = useState('')
  const [venueName, setVenueName] = useState('')
  const [visibility, setVisibility] = useState<ChampionshipVisibility>('public')
  const [rulesetVersion, setRulesetVersion] = useState('FIG_2025_2028_V1')

  // Category Configuration Panel State
  const [selectedChampForCategories, setSelectedChampForCategories] = useState<Championship | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  const [categorySuccessMsg, setCategorySuccessMsg] = useState<string | null>(null)

  // Category Form fields
  const [catName, setCatName] = useState('')
  const [catCode, setCatCode] = useState('')
  const [catDiscipline, setCatDiscipline] = useState<GymnasticsDiscipline>('GAF')
  const [catGender, setCatGender] = useState<GenderCategory>('female')
  const [catRegime, setCatRegime] = useState<CategoryScoringRegime>('free')
  const [catFixedD, setCatFixedD] = useState('10.0')

  const canManage = activeRole === 'org_admin' || activeRole === 'competition_manager'

  const loadChampionships = useCallback(async () => {
    if (!activeOrganization) {
      setChampionships([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMsg(null)
      const { data, error } = await supabase
        .from('championships')
        .select('*')
        .eq('organization_id', activeOrganization.id)
        .order('start_date', { ascending: false })

      if (error) throw error

      setChampionships(
        (data || []).map((row) => ({
          id: row.id,
          organizationId: row.organization_id,
          name: row.name,
          slug: row.slug,
          description: row.description ?? undefined,
          startDate: row.start_date,
          endDate: row.end_date,
          location: row.location ?? undefined,
          venueName: row.venue_name ?? undefined,
          visibility: row.visibility,
          status: row.status,
          rulesetVersion: row.ruleset_version,
          scoringSchemaVersion: row.scoring_schema_version,
          bannerUrl: row.banner_url ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      )
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    } finally {
      setIsLoading(false)
    }
  }, [activeOrganization])

  useEffect(() => {
    loadChampionships()
  }, [loadChampionships])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeOrganization) return

    try {
      setErrorMsg(null)
      const { error } = await supabase.from('championships').insert({
        organization_id: activeOrganization.id,
        name,
        slug,
        start_date: startDate,
        end_date: endDate,
        location: location || null,
        venue_name: venueName || null,
        visibility,
        status: 'draft',
        ruleset_version: rulesetVersion,
        scoring_schema_version: 'FIG_STANDARD_V1',
      })

      if (error) throw error

      setIsCreating(false)
      setName('')
      setSlug('')
      setStartDate('')
      setEndDate('')
      setLocation('')
      setVenueName('')
      await loadChampionships()
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    }
  }

  const loadCategories = useCallback(async (champId: string) => {
    setIsLoadingCategories(true)
    setErrorMsg(null)
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('championship_id', champId)
        .order('sort_order', { ascending: true })

      if (error) throw error

      setCategories(
        (data || []).map((row) => ({
          id: row.id,
          championshipId: row.championship_id,
          discipline: row.discipline,
          name: row.name,
          code: row.code,
          gender: row.gender,
          scoringRegime: (row.scoring_regime || 'free') as CategoryScoringRegime,
          defaultFixedDScore: row.default_fixed_d_score ? Number(row.default_fixed_d_score) : undefined,
          minAge: row.min_age ?? undefined,
          maxAge: row.max_age ?? undefined,
          sortOrder: row.sort_order,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
      )
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    } finally {
      setIsLoadingCategories(false)
    }
  }, [])

  const handleOpenCategories = (champ: Championship) => {
    setSelectedChampForCategories(champ)
    setIsCreatingCategory(false)
    setCategorySuccessMsg(null)
    loadCategories(champ.id)
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChampForCategories) return

    try {
      setErrorMsg(null)
      setCategorySuccessMsg(null)

      const { error } = await supabase.from('categories').insert({
        championship_id: selectedChampForCategories.id,
        discipline: catDiscipline,
        name: catName,
        code: catCode.toUpperCase().trim(),
        gender: catGender,
        scoring_regime: catRegime,
        default_fixed_d_score: catRegime === 'obligatory' ? parseFloat(catFixedD) || 10.0 : null,
      })

      if (error) throw error

      setIsCreatingCategory(false)
      setCatName('')
      setCatCode('')
      setCatRegime('free')
      setCatFixedD('10.0')
      setCategorySuccessMsg('¡Categoría configurada exitosamente con su régimen técnico!')
      await loadCategories(selectedChampForCategories.id)
    } catch (err: unknown) {
      setErrorMsg((err as Error).message)
    }
  }

  const statusBadges: Record<ChampionshipStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'outline' }> = {
    draft: { label: 'Borrador', variant: 'outline' },
    registration_open: { label: 'Inscripciones Abiertas', variant: 'success' },
    registration_closed: { label: 'Inscripciones Cerradas', variant: 'warning' },
    in_progress: { label: 'En Progreso / En Vivo', variant: 'default' },
    completed: { label: 'Finalizado', variant: 'success' },
    archived: { label: 'Archivado', variant: 'outline' },
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-blue-700" />
            Campeonatos de la Organización
          </h3>
          <p className="text-xs text-slate-500">
            Administra los torneos, reglamento técnico congelado, visibilidad y cronograma.
          </p>
        </div>

        {canManage && !isCreating && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Nuevo Campeonato
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {isCreating && (
        <Card className="border-blue-200 bg-blue-50/30">
          <h4 className="text-sm font-bold text-slate-900 mb-4">Crear Nuevo Campeonato</h4>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Nombre del Campeonato</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Campeonato Nacional GAF Apertura 2026"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Slug URL</label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fecha de Inicio</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Fecha de Término</label>
                <input
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ciudad / Ubicación</label>
                <input
                  type="text"
                  placeholder="Ej. Santiago, Chile"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Gimnasio / Recinto</label>
                <input
                  type="text"
                  placeholder="Ej. Polideportivo Estadio Nacional"
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Visibilidad</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as ChampionshipVisibility)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                >
                  <option value="public">Público (Visible en portal de resultados)</option>
                  <option value="private">Privado (Solo organizador)</option>
                  <option value="invitational">Por Invitación (Solo clubes autorizados)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Código de Puntuación (Reglamento)</label>
                <select
                  value={rulesetVersion}
                  onChange={(e) => setRulesetVersion(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                >
                  <option value="FIG_2025_2028_V1">FIG Código de Puntuación 2025-2028</option>
                  <option value="USAG_DEVELOPMENT_2024">USAG Niveles 1 al 10 (2024)</option>
                  <option value="ESCOLAR_FORMATIVO_V1">Reglamento Escolar / Promocional</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Guardar Campeonato
              </button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Cargando campeonatos...</div>
      ) : championships.length === 0 ? (
        <Card className="text-center py-8">
          <Trophy className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-700">No hay campeonatos creados aún</p>
          <p className="text-xs text-slate-500 mt-1">Crea el primer campeonato para comenzar a configurar categorías y aparatos.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {championships.map((champ) => {
            const statusInfo = statusBadges[champ.status]
            return (
              <Card key={champ.id} className="hover:border-slate-300 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{champ.name}</h4>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">{champ.slug}</p>
                  </div>
                  <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{champ.startDate} al {champ.endDate}</span>
                  </div>
                  {champ.venueName && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{champ.venueName}{champ.location ? ` • ${champ.location}` : ''}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                      Reglamento: {champ.rulesetVersion}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {champ.visibility}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenCategories(champ)}
                    className="font-semibold text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-1"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Configurar Categorías & Jurado →
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL / PANEL DE CONFIGURACIÓN TÉCNICA DE CATEGORÍAS */}
      {selectedChampForCategories && (
        <Card className="border-indigo-200 bg-indigo-50/20 shadow-md">
          <div className="flex items-start justify-between border-b border-indigo-100 pb-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Configuración Técnica</span>
                <Badge variant="outline">{selectedChampForCategories.rulesetVersion}</Badge>
              </div>
              <h4 className="text-base font-bold text-slate-900 mt-0.5">
                Categorías & Régimen de Puntuación: {selectedChampForCategories.name}
              </h4>
              <p className="text-xs text-slate-500">
                Tipifica si cada nivel es Libre (Jurado D evalúa dificultad en vivo + Jurado E) o Rutina Establecida (Nota D fija, solo se registra ejecución E).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedChampForCategories(null)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {categorySuccessMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{categorySuccessMsg}</span>
            </div>
          )}

          {/* Form to create new category */}
          {isCreatingCategory ? (
            <Card className="mb-6 border-indigo-200 bg-white">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                Nueva Categoría / Nivel para el Torneo
              </h5>
              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nombre de Categoría</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Nivel 3 USAG o FIG Senior"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Código / Sigla</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. LVL3 o FIG-SR"
                      value={catCode}
                      onChange={(e) => setCatCode(e.target.value)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono uppercase focus:border-indigo-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Disciplina</label>
                    <select
                      value={catDiscipline}
                      onChange={(e) => setCatDiscipline(e.target.value as GymnasticsDiscipline)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-600 focus:outline-none"
                    >
                      <option value="GAF">GAF (Femenina)</option>
                      <option value="GAM">GAM (Masculina)</option>
                      <option value="GR">GR (Rítmica)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Rama / Género</label>
                    <select
                      value={catGender}
                      onChange={(e) => setCatGender(e.target.value as GenderCategory)}
                      className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-600 focus:outline-none"
                    >
                      <option value="female">Femenino</option>
                      <option value="male">Masculino</option>
                      <option value="mixed">Mixto</option>
                    </select>
                  </div>
                </div>

                {/* Regime Selector */}
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
                  <label className="block text-xs font-bold text-slate-800">
                    Régimen de Evaluación y Captura de Jurado
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`flex flex-col rounded-lg border p-3 cursor-pointer transition-all ${
                        catRegime === 'free'
                          ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="scoring_regime"
                          checked={catRegime === 'free'}
                          onChange={() => setCatRegime('free')}
                          className="text-blue-700"
                        />
                        <span className="text-xs font-bold text-slate-900">Nivel Libre (D + E)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 pl-5">
                        Norma FIG / Opcionales. Jurado D evalúa dificultad y valor de enlace en vivo. Jurado E evalúa ejecución técnica.
                      </p>
                    </label>

                    <label
                      className={`flex flex-col rounded-lg border p-3 cursor-pointer transition-all ${
                        catRegime === 'obligatory'
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-600'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="scoring_regime"
                          checked={catRegime === 'obligatory'}
                          onChange={() => setCatRegime('obligatory')}
                          className="text-indigo-700"
                        />
                        <span className="text-xs font-bold text-slate-900">Rutina Establecida (Solo E)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 pl-5">
                        Nivel Obligatorio / Formativo. La nota D está prefijada por el campeonato. Los jueces solo registran descuentos de ejecución (E).
                      </p>
                    </label>
                  </div>

                  {catRegime === 'obligatory' && (
                    <div className="pt-2 border-t border-indigo-100 flex items-center gap-3">
                      <label className="text-xs font-semibold text-slate-700">
                        Nota D Predeterminada del Campeonato:
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="20"
                        value={catFixedD}
                        onChange={(e) => setCatFixedD(e.target.value)}
                        className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono font-bold text-blue-900 text-center"
                      />
                      <span className="text-[11px] text-slate-500">
                        (Ej. 10.000 puntos base estándar FIG Formativo / USAG 1-5)
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded bg-indigo-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-800 shadow-sm"
                  >
                    Guardar Categoría
                  </button>
                </div>
              </form>
            </Card>
          ) : (
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs text-slate-600 font-medium">
                Categorías configuradas en este campeonato: <strong>{categories.length}</strong>
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setIsCreatingCategory(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar Categoría / Nivel
                </button>
              )}
            </div>
          )}

          {isLoadingCategories ? (
            <div className="py-6 text-center text-xs text-slate-500">Cargando categorías...</div>
          ) : categories.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
              <p className="text-xs font-medium text-slate-600">No hay categorías configuradas para este campeonato.</p>
              <p className="text-[11px] text-slate-400 mt-1">Crea categorías libres u obligatorias para habilitar las inscripciones y el jurado.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Categoría / Nivel</th>
                    <th className="px-4 py-2.5 font-semibold">Disciplina</th>
                    <th className="px-4 py-2.5 font-semibold">Régimen Técnico</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Configuración Jurado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-slate-900">{cat.name}</span>
                        <span className="ml-2 font-mono text-[10px] text-slate-400">({cat.code})</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{cat.discipline}</td>
                      <td className="px-4 py-2.5">
                        {cat.scoringRegime === 'obligatory' ? (
                          <Badge variant="default" className="text-[10px] bg-indigo-700">
                            Rutina Establecida (Obligatoria)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300">
                            Nivel Libre (FIG D+E)
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono text-[11px]">
                        {cat.scoringRegime === 'obligatory' ? (
                          <span className="font-semibold text-indigo-900">
                            D Fija = {cat.defaultFixedDScore?.toFixed(3) || '10.000'} • Solo Jurado E
                          </span>
                        ) : (
                          <span className="text-slate-600">Jurado D en vivo + Jurado E</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
