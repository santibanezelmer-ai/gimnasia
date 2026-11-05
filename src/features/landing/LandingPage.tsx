import React, { useState } from 'react'
import { AuthForm } from '@/features/auth/AuthForm'
import { FastJudgeTerminal } from '@/features/scoring/FastJudgeTerminal'
import { LiveStandingsBoard } from '@/features/standings/LiveStandingsBoard'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Trophy,
  Award,
  Flame,
  KeyRound,
  Building2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Radio,
  Tv,
  Calculator,
  Sparkles,
  Scale,
  ArrowUpRight,
  Megaphone,
} from 'lucide-react'

export interface LandingPageProps {
  initialMode?: 'landing' | 'login' | 'fast_judge' | 'live_standings'
}

export const LandingPage: React.FC<LandingPageProps> = ({ initialMode = 'landing' }) => {
  const [activeView, setActiveView] = useState<'landing' | 'login' | 'fast_judge' | 'live_standings'>(initialMode)
  const [previewTab, setPreviewTab] = useState<'live' | 'judge' | 'audit'>('live')

  // If in interactive action view, show that view with a top navigation bar to return to landing
  if (activeView !== 'landing') {
    return (
      <div className="space-y-6">
        {/* Sub-header navigation to return to Landing Page */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('landing')}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              ← Volver al Inicio
            </button>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Modo Activo:</span>
              <Badge variant="default" className="text-[10px] font-bold">
                {activeView === 'login' && 'Ingreso de Club / Federación'}
                {activeView === 'fast_judge' && 'Terminal Rápida de Juez (PIN)'}
                {activeView === 'live_standings' && 'Resultados en Vivo'}
              </Badge>
            </div>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveView('login')}
              className={`rounded-lg px-3 py-1 font-bold transition-all ${
                activeView === 'login' ? 'bg-blue-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Club / Admin
            </button>
            <button
              type="button"
              onClick={() => setActiveView('fast_judge')}
              className={`rounded-lg px-3 py-1 font-bold transition-all ${
                activeView === 'fast_judge' ? 'bg-indigo-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Acceso Juez PIN
            </button>
            <button
              type="button"
              onClick={() => setActiveView('live_standings')}
              className={`rounded-lg px-3 py-1 font-bold transition-all ${
                activeView === 'live_standings' ? 'bg-orange-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              En Vivo
            </button>
          </div>
        </div>

        {activeView === 'login' && <AuthForm />}
        {activeView === 'fast_judge' && <FastJudgeTerminal />}
        {activeView === 'live_standings' && <LiveStandingsBoard />}
      </div>
    )
  }

  return (
    <div className="space-y-20 py-4 font-sans text-slate-900">
      {/* =========================================================================
          HERO SECTION
         ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-blue-950 to-slate-950 px-6 py-16 sm:px-12 sm:py-24 text-white shadow-2xl border border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-600/20 via-transparent to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-4xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 border border-blue-400/30 px-4 py-1.5 text-xs font-bold text-blue-300 shadow-lg backdrop-blur-xs">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span>SaaS Oficial de Gimnasia Artística · Normativa FIG 2025-2028</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight sm:text-6xl sm:leading-tight">
            La plataforma definitiva para gestionar{' '}
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
              campeonatos de gimnasia
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm sm:text-lg text-slate-300 font-medium leading-relaxed">
            Automatiza inscripciones de clubes, captura notas en pista con terminal táctil express para jueces,
            proyecta tableros en vivo en pantallas gigantes y genera actas oficiales con desempates FIG deterministas.
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={() => setActiveView('login')}
              className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Trophy className="h-4 w-4" />
              <span>Organizar mi Campeonato</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setActiveView('fast_judge')}
              className="flex items-center gap-2 rounded-2xl bg-slate-800/80 border border-slate-700 px-5 py-3.5 text-sm font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
            >
              <KeyRound className="h-4 w-4 text-indigo-400" />
              <span>Acceso Juez con PIN</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('live_standings')}
              className="flex items-center gap-2 rounded-2xl bg-orange-600/90 border border-orange-500/50 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-600/20 hover:bg-orange-500 transition-all"
            >
              <Flame className="h-4 w-4 text-amber-300 animate-pulse" />
              <span>Resultados en Vivo</span>
            </button>
          </div>

          {/* Key metrics / Trust pillars */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-10 text-left border-t border-slate-800/80 max-w-3xl mx-auto">
            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                <Radio className="h-3.5 w-3.5 animate-pulse" /> Realtime Activo
              </div>
              <div className="text-lg font-black font-mono text-white mt-1">&lt; 150 ms</div>
              <div className="text-[11px] text-slate-400">Latencia WebSocket en vivo</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                <Award className="h-3.5 w-3.5" /> Motor FIG Oficial
              </div>
              <div className="text-lg font-black font-mono text-white mt-1">2025-2028</div>
              <div className="text-[11px] text-slate-400">Fórmulas D/E y desempates</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                <Tv className="h-3.5 w-3.5" /> Modo TV Arena
              </div>
              <div className="text-lg font-black font-mono text-white mt-1">Pantallas Kiosk</div>
              <div className="text-[11px] text-slate-400">Legible a más de 25 metros</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs">
                <ShieldCheck className="h-3.5 w-3.5" /> Multi-Tenant RLS
              </div>
              <div className="text-lg font-black font-mono text-white mt-1">100% Aislado</div>
              <div className="text-[11px] text-slate-400">Seguridad por organización</div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          INTERACTIVE PRODUCT SHOWCASE (PREVIEW MODES)
         ========================================================================= */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="default" className="text-xs font-bold">Experiencia Unificada</Badge>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Diseñado para cada protagonista del campeonato
          </h2>
          <p className="text-sm text-slate-600">
            Una interfaz especializada para organizadores, jueces en pista, público en el gimnasio y delegados de clubes.
          </p>
        </div>

        {/* Tab switcher for feature demo */}
        <div className="flex justify-center">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1.5 text-xs shadow-xs">
            <button
              type="button"
              onClick={() => setPreviewTab('live')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition-all ${
                previewTab === 'live' ? 'bg-white text-blue-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className="h-4 w-4 text-orange-500" />
              <span>Tablero en Vivo & Podio</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab('judge')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition-all ${
                previewTab === 'judge' ? 'bg-white text-indigo-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calculator className="h-4 w-4 text-indigo-600" />
              <span>Terminal Rápida de Juez</span>
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab('audit')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-bold transition-all ${
                previewTab === 'audit' ? 'bg-white text-amber-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Scale className="h-4 w-4 text-amber-600" />
              <span>Juez Árbitro & Apelaciones</span>
            </button>
          </div>
        </div>

        {/* Preview Container */}
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl">
          {previewTab === 'live' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                    Tablero de Resultados con 3 Vistas
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cambia al instante entre Tabla Estándar, Podio Olímpico con pedestales y Modo TV Arena de alto contraste.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('live_standings')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 self-start sm:self-auto"
                >
                  <span>Abrir Tablero Real</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Simulated Podium Preview */}
              <div className="rounded-2xl bg-slate-950 p-6 text-white text-center border border-slate-800">
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] mb-4">
                  Vista Previa del Podio All-Around
                </Badge>
                <div className="grid grid-cols-3 gap-3 items-end max-w-md mx-auto pt-4">
                  {/* Silver */}
                  <div className="flex flex-col items-center">
                    <div className="text-[11px] font-bold text-slate-300 truncate">Camila V.</div>
                    <div className="text-xs font-mono font-black text-slate-200">52.500</div>
                    <div className="w-full h-20 rounded-t-lg bg-slate-700 border-t-2 border-slate-400 flex items-center justify-center font-mono font-black text-xl">2</div>
                  </div>
                  {/* Gold */}
                  <div className="flex flex-col items-center -mt-4">
                    <Trophy className="h-6 w-6 text-amber-400 mb-1" />
                    <div className="text-xs font-black text-amber-300 truncate">Florencia C.</div>
                    <div className="text-sm font-mono font-black text-amber-400">52.700</div>
                    <div className="w-full h-28 rounded-t-lg bg-amber-700/80 border-t-2 border-amber-300 flex items-center justify-center font-mono font-black text-2xl text-amber-200">1</div>
                  </div>
                  {/* Bronze */}
                  <div className="flex flex-col items-center">
                    <div className="text-[11px] font-bold text-slate-300 truncate">Martina R.</div>
                    <div className="text-xs font-mono font-black text-orange-300">50.800</div>
                    <div className="w-full h-16 rounded-t-lg bg-orange-900 border-t-2 border-orange-500 flex items-center justify-center font-mono font-black text-lg text-orange-300">3</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {previewTab === 'judge' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-indigo-600" />
                    Terminal Express para Jueces de Pista
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ingreso con código PIN del torneo. Sin necesidad de registrar cuenta ni recordar contraseñas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('fast_judge')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-800 self-start sm:self-auto"
                >
                  <span>Probar Terminal</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-6 space-y-4">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-700">Gimnasta: Camila Valenzuela (Club Manquehue)</span>
                  <Badge variant="outline">Aparato: Salto (VT)</Badge>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                  <div>
                    <div className="text-[10px] text-slate-500 font-sans">Nota D</div>
                    <div className="text-base font-black text-slate-900">5.000</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-sans">Promedio E</div>
                    <div className="text-base font-black text-emerald-700">+8.550</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-sans">Deducciones</div>
                    <div className="text-base font-black text-rose-600">-0.000</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-sans">Puntaje Final</div>
                    <div className="text-lg font-black text-blue-900">13.550</div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 italic text-center">
                  Cálculo determinista con descarte automático de notas extremas en jurados de 4 o 6 jueces.
                </p>
              </div>
            </div>
          )}

          {previewTab === 'audit' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Scale className="h-5 w-5 text-amber-600" />
                    Consola del Juez Árbitro & Pista de Auditoría
                  </h3>
                  <p className="text-xs text-slate-500">
                    Control central de actas, resolución oficial de apelaciones (Score Inquiries) y firma digital inmutable.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('login')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-slate-800 self-start sm:self-auto"
                >
                  <span>Ingresar como Árbitro</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>Registro de Auditoría Inmutable #AUD-2026-08</span>
                  <span className="text-emerald-700 font-mono">14:22:15 · Verificado</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 font-medium text-slate-800">
                  [Resolución Apelación Jurado Superior]: Se acredita el elemento de giro en viga (+0.200 D).
                </div>
                <div className="grid grid-cols-2 gap-2 text-center font-mono text-[11px]">
                  <div className="bg-rose-50 text-rose-800 rounded p-1.5 border border-rose-200">
                    Nota Previa: 12.800 (D: 4.800)
                  </div>
                  <div className="bg-emerald-50 text-emerald-800 rounded p-1.5 border border-emerald-200">
                    Nota Corregida: 13.000 (D: 5.000)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          THE 6 CORE CAPABILITIES (FEATURES GRID)
         ========================================================================= */}
      <section className="space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <Badge variant="default" className="text-xs font-bold">Tecnología de Punta</Badge>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Todo lo que necesita un campeonato moderno
          </h2>
          <p className="text-sm text-slate-600">
            Diseñado para cumplir con los estándares técnicos más exigentes de federaciones y clubes formativos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 */}
          <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-blue-300 hover:shadow-md transition-all space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs">
              <Award className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Motor de Puntuación FIG 2025-2028</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cálculo de D-Score, promedio de Ejecución E con descarte automático de extremos (paneles de 4 o 6 jueces),
              deducciones neutras y regla de dos saltos en Salto (VT).
            </p>
          </Card>

          {/* Card 2 */}
          <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-2xs">
              <KeyRound className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Terminal Rápida para Jueces sin Cuenta</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Los jueces entran desde su celular o tablet en pista ingresando el código PIN del torneo.
              Sin crear contraseñas ni demoras operativas.
            </p>
          </Card>

          {/* Card 3 */}
          <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-amber-300 hover:shadow-md transition-all space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 shadow-2xs">
              <Tv className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Modo TV Arena & Podio Olímpico</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pantallas gigantes de gimnasio con alto contraste (`bg-slate-950`), podio de premiación
              visual y tablas compactas con números tabulares para no oscilar en vivo.
            </p>
          </Card>

          {/* Card: Rotaciones & Llamado a Pista */}
          <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-sky-300 hover:shadow-md transition-all space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700 border border-sky-100 shadow-2xs">
              <Megaphone className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Rotaciones Olímpicas & Llamado a Pista</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Matriz secuencial FIG de rotación de aparatos, orden de paso con dorsales y pantalla en vivo
              de megafonía que indica quién compite en cada aparato y quién está en preparación (On Deck).
            </p>
          </Card>

          {/* Card 4 */}
          <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-2xs">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Portal Autónomo para Clubes</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Cada club participante carga su propia nómina de deportistas, administra sus licencias
              e inscribe libremente a sus gimnastas mediante el código de invitación.
            </p>
          </Card>

          {/* Card 5 */}
          <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-purple-300 hover:shadow-md transition-all space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700 border border-purple-100 shadow-2xs">
              <Scale className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Apelaciones & Auditoría Inmutable</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Resolución técnica de apelaciones de nota (Score Inquiries) por el Jurado Superior con
              registro cronológico inmutable de nota previa vs nota corregida.
            </p>
          </Card>

          {/* Card 6 */}
          <Card className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-rose-300 hover:shadow-md transition-all space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 border border-rose-100 shadow-2xs">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Aislamiento Multi-Tenant Blindado</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Políticas de Row Level Security (RLS) en PostgreSQL que garantizan que los datos de un club o
              federación jamás puedan ser accedidos o modificados por terceros.
            </p>
          </Card>
        </div>
      </section>

      {/* =========================================================================
          REGLAMENTOS & MULTI-DISCIPLINA FIG 2025-2028
         ========================================================================= */}
      <section className="rounded-3xl bg-slate-100/80 p-8 sm:p-12 border border-slate-200 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Versatilidad Técnica Multidisciplina</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              Disponible para 7 disciplinas según normativas oficiales FIG
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="default" className="text-xs bg-blue-700">GAF</Badge>
            <Badge variant="default" className="text-xs bg-blue-700">GAM</Badge>
            <Badge variant="default" className="text-xs bg-purple-700">GR (Rítmica)</Badge>
            <Badge variant="default" className="text-xs bg-sky-700">TRA (Trampolín)</Badge>
            <Badge variant="default" className="text-xs bg-emerald-700">AER (Aeróbica)</Badge>
            <Badge variant="default" className="text-xs bg-indigo-700">ACRO (Acrobática)</Badge>
            <Badge variant="default" className="text-xs bg-amber-600">PK (Parkour FIG)</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-[10px] font-bold text-blue-800">FIG</span>
              <h4 className="font-bold text-slate-900 text-sm">Artística (GAF & GAM)</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              4 aparatos femeninos y 6 masculinos. Cómputo oficial D + E - ND con regla de dos intentos en Salto (VT) y descarte de extremos.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 text-[10px] font-bold text-purple-800">RG</span>
              <h4 className="font-bold text-slate-900 text-sm">Rítmica (GR) & Aeróbica (AER)</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Aro, Pelota, Mazas, Cinta, Manos Libres y Conjuntos. Evaluación tripartita reglamentaria: Dificultad (D) + Artística (A) + Ejecución (E).
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-100 text-[10px] font-bold text-sky-800">TRA</span>
              <h4 className="font-bold text-slate-900 text-sm">Trampolín & Acrobática</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Trampolín Individual, DMT, Tumbling y Sincronizado con Tiempo de Vuelo (ToF) y Desplazamiento Horizontal (HD), más rutinas Acrobáticas (Balance/Dinámico).
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-[10px] font-bold text-amber-800">PK</span>
              <h4 className="font-bold text-slate-900 text-sm">Parkour FIG (Speed & Freestyle)</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Modalidad Carrera de Velocidad (Speed) con registro electrónico de tiempos en segundos y penalizaciones de recorrido, más Estilo Libre (Freestyle).
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          PRICING & PLANS TEASER
         ========================================================================= */}
      <section className="space-y-8 text-center">
        <div className="max-w-2xl mx-auto space-y-2">
          <Badge variant="default" className="text-xs font-bold">Planes Flexibles</Badge>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Comienza gratis y escala con tu torneo
          </h2>
          <p className="text-sm text-slate-600">
            Cero costo inicial para clubes que participan en campeonatos de terceros.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-5xl mx-auto">
          {/* Plan Club */}
          <Card className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Club Participante</span>
              <h3 className="text-xl font-bold text-slate-900 mt-1">Plan Club</h3>
              <div className="mt-3 text-3xl font-black text-slate-900">$0</div>
              <p className="text-xs text-slate-500 mt-1 mb-6">Gratis para siempre</p>

              <ul className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Hasta 25 gimnastas registradas</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Inscripción en torneos con código</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Resultados en vivo en directo</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setActiveView('login')}
              className="mt-6 w-full rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Comenzar Gratis
            </button>
          </Card>

          {/* Plan Organizador */}
          <Card className="rounded-2xl border-2 border-blue-600 bg-blue-50/20 p-6 flex flex-col justify-between shadow-lg relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-blue-600 text-white font-bold text-[10px] px-3 py-0.5 shadow-sm">
                Más Popular
              </Badge>
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700">Club Anfitrión / Asociación</span>
              <h3 className="text-xl font-bold text-slate-900 mt-1">Plan Organizador</h3>
              <div className="mt-3 text-3xl font-black text-slate-900">$49.990</div>
              <p className="text-xs text-slate-500 mt-1 mb-6">por mes / sin contrato</p>

              <ul className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>Campeonatos y categorías ilimitadas</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>Terminales de jueces con PIN express</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>Modo TV Arena & Podio Olímpico</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>Actas oficiales con desempates FIG</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setActiveView('login')}
              className="mt-6 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-colors"
            >
              Crear mi Campeonato
            </button>
          </Card>

          {/* Plan Federación */}
          <Card className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-xs">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Federaciones Nacionales</span>
              <h3 className="text-xl font-bold text-slate-900 mt-1">Plan Federación</h3>
              <div className="mt-3 text-3xl font-black text-slate-900">$120.000</div>
              <p className="text-xs text-slate-500 mt-1 mb-6">por mes</p>

              <ul className="space-y-2.5 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Múltiples asociaciones bajo un paraguas</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Control de licencias y ranking nacional</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Subdominio propio y SLA prioritario</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setActiveView('login')}
              className="mt-6 w-full rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Contactar Soporte
            </button>
          </Card>
        </div>
      </section>

      {/* =========================================================================
          FINAL CALL TO ACTION BANNER
         ========================================================================= */}
      <section className="rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 p-8 sm:p-14 text-white text-center shadow-xl space-y-6">
        <h3 className="text-2xl sm:text-4xl font-black tracking-tight max-w-xl mx-auto">
          ¿Listo para llevar tus campeonatos de gimnasia al siguiente nivel?
        </h3>
        <p className="text-xs sm:text-sm text-blue-100 max-w-lg mx-auto leading-relaxed">
          Únete a los clubes y federaciones que ya operan sus torneos con puntuación oficial FIG en tiempo real.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setActiveView('login')}
            className="rounded-2xl bg-white px-6 py-3 text-xs sm:text-sm font-bold text-blue-900 hover:bg-slate-100 shadow-md transition-colors"
          >
            Registrar mi Club u Organización
          </button>
          <button
            type="button"
            onClick={() => setActiveView('live_standings')}
            className="rounded-2xl border border-white/30 bg-white/10 backdrop-blur-xs px-6 py-3 text-xs sm:text-sm font-bold text-white hover:bg-white/20 transition-colors"
          >
            Ver Tablero en Directo
          </button>
        </div>
      </section>

      {/* =========================================================================
          FOOTER
         ========================================================================= */}
      <footer className="border-t border-slate-200/90 pt-8 pb-12 text-center text-xs text-slate-500 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="h-4 w-4 text-blue-700" />
          <span className="font-bold text-slate-900">Operix Gymnastics</span>
          <span className="text-slate-300">·</span>
          <span>SaaS Multiempresa de Gimnasia Deportiva</span>
        </div>
        <p className="text-xs font-semibold text-slate-700">
          Desarrollado por <span className="font-bold text-blue-700">Comercial Hels SpA</span>
        </p>
        <p className="text-[11px] text-slate-400">
          Conforme a las Regulaciones Técnicas y Código de Puntuación FIG 2025-2028 (GAF / GAM). Todos los derechos reservados.
        </p>
      </footer>
    </div>
  )
}
