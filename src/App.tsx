import React, { useState } from 'react'
import { AuthProvider, useAuth } from '@/features/auth/AuthContext'
import { OrganizationProvider, useOrganization } from '@/features/organizations/OrganizationContext'
import { TenantSwitcher } from '@/features/organizations/TenantSwitcher'
import { ChampionshipsManager } from '@/features/championships/ChampionshipsManager'
import { DelegationsManager } from '@/features/delegations/DelegationsManager'
import { ScoringPad } from '@/features/scoring/ScoringPad'
import { LiveStandingsBoard } from '@/features/standings/LiveStandingsBoard'
import { HeadJudgeView } from '@/features/views/HeadJudgeView'
import { ClubManagerView } from '@/features/views/ClubManagerView'
import { SubscriptionPlansView } from '@/features/billing/SubscriptionPlansView'
import { LandingPage } from '@/features/landing/LandingPage'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  LogOut,
  Building2,
  Users,
  Award,
  Flame,
  Zap,
  LayoutDashboard,
  ShieldCheck,
  Activity,
} from 'lucide-react'

const DashboardContent: React.FC = () => {
  const { user, profile, signOut } = useAuth()
  const { activeOrganization, activeRole, organizations } = useOrganization()
  const [activeTab, setActiveTab] = useState<
    'overview' | 'championships' | 'delegations' | 'judging' | 'standings' | 'billing'
  >('overview')

  type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'outline'

  const roleBadgeStyles: Record<string, { label: string; variant: BadgeVariant }> = {
    org_admin: { label: 'Administrador Org', variant: 'danger' },
    head_judge: { label: 'Juez Árbitro', variant: 'warning' },
    judge: { label: 'Juez de Aparato', variant: 'outline' },
    club_manager: { label: 'Delegado de Club', variant: 'success' },
    coach: { label: 'Entrenador', variant: 'default' },
    viewer: { label: 'Observador', variant: 'outline' },
  }

  const currentRoleInfo: { label: string; variant: BadgeVariant } = activeRole && roleBadgeStyles[activeRole]
    ? roleBadgeStyles[activeRole]
    : { label: activeRole || 'Sin Rol', variant: 'outline' }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navigation Header */}
      <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white shadow-sm ring-1 ring-blue-500/20">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900">Operix Gymnastics</h1>
                <span className="rounded-md bg-blue-50 border border-blue-200/70 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 tracking-wide">
                  FIG 2025-2028
                </span>
                {profile?.platformRole === 'platform_admin' && (
                  <Badge variant="danger" className="text-[10px] py-0 px-1.5">SuperAdmin</Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Plataforma de Campeonatos & Puntuación Oficial de Gimnasia
              </p>
            </div>
          </div>

          {/* User Controls & Tenant Switcher */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <TenantSwitcher />
                <div className="text-right hidden sm:block border-l border-slate-200 pl-3">
                  <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[150px]">
                    {profile?.fullName || user.email}
                  </p>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <Badge variant={currentRoleInfo.variant} className="text-[9px] py-0 px-1.5 font-bold">
                      {currentRoleInfo.label}
                    </Badge>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => signOut()}
                  title="Cerrar Sesión"
                  className="rounded-xl border border-slate-200/90 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Acceso Público & Torneos
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Scoped Navigation Tabs Bar */}
        {user && activeOrganization && (
          <div className="border-t border-slate-100 bg-slate-50/70 px-4 sm:px-6">
            <div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto py-2 text-xs scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-semibold transition-all ${
                  activeTab === 'overview'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Panel Principal</span>
              </button>

              {(activeRole === 'org_admin' || activeRole === 'club_manager' || profile?.platformRole === 'platform_admin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('championships')}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-semibold transition-all ${
                    activeTab === 'championships'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Trophy className="h-4 w-4" />
                  <span>{activeRole === 'club_manager' ? 'Organizar Torneos' : 'Campeonatos'}</span>
                </button>
              )}

              {(activeRole === 'org_admin' || activeRole === 'club_manager' || profile?.platformRole === 'platform_admin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('delegations')}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-semibold transition-all ${
                    activeTab === 'delegations'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>{activeRole === 'club_manager' ? 'Mi Club & Inscripciones' : 'Clubes & Deportistas'}</span>
                </button>
              )}

              {(activeRole === 'org_admin' || activeRole === 'head_judge' || activeRole === 'judge' || profile?.platformRole === 'platform_admin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('judging')}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-semibold transition-all ${
                    activeTab === 'judging'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Award className="h-4 w-4" />
                  <span>{activeRole === 'head_judge' ? 'Consola Juez Árbitro' : 'Mesa de Jurado FIG'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('standings')}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-semibold transition-all relative ${
                  activeTab === 'standings'
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
              >
                <Flame className={`h-4 w-4 ${activeTab === 'standings' ? 'text-amber-300' : 'text-orange-500'}`} />
                <span>Resultados en Vivo</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                </span>
              </button>

              {(activeRole === 'org_admin' || profile?.platformRole === 'platform_admin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('billing')}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-semibold transition-all ${
                    activeTab === 'billing'
                      ? 'bg-blue-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <Zap className={`h-4 w-4 ${activeTab === 'billing' ? 'text-amber-300' : 'text-amber-500'}`} />
                  <span>Planes SaaS</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Viewport */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {!user ? (
          <LandingPage />
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* Modern Organization Command Center Banner */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-slate-50/70 to-blue-50/20 p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                      Organización Activa
                    </span>
                    <Badge variant={currentRoleInfo.variant} className="text-[10px] font-bold">
                      {currentRoleInfo.label}
                    </Badge>
                    <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-700">
                      Plan: {activeOrganization?.billingPlan?.toUpperCase() || 'FREE'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200/80 rounded-md px-2 py-0.5">
                      <ShieldCheck className="h-3 w-3 text-emerald-600" /> Aislamiento RLS Activo
                    </span>
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-900">
                    {activeOrganization ? activeOrganization.name : 'No tienes una organización seleccionada'}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono">
                    ID: {activeOrganization ? activeOrganization.id : 'N/A'} · Slug: {activeOrganization?.slug || 'N/A'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 border border-slate-200 text-xs shadow-2xs">
                    <Building2 className="h-4 w-4 text-slate-500" />
                    <span className="text-slate-600">Membresías:</span>
                    <strong className="text-slate-900 font-bold">{organizations.length}</strong>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 border border-slate-200 text-xs shadow-2xs">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    <span className="text-slate-600">Motor FIG:</span>
                    <strong className="text-emerald-700 font-bold">2025-2028 Conforme</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* TAB CONTENT: Scoped by active view & user role */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {activeRole === 'org_admin' && (
                  <div className="space-y-8">
                    <ChampionshipsManager />
                    <DelegationsManager />
                    <LiveStandingsBoard />
                  </div>
                )}

                {activeRole === 'head_judge' && (
                  <div className="space-y-8">
                    <HeadJudgeView />
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-slate-900">Terminal de Jurado FIG & Rutinas Establecidas</h4>
                      <ScoringPad />
                    </div>
                    <LiveStandingsBoard />
                  </div>
                )}

                {activeRole === 'club_manager' && (
                  <div className="space-y-8">
                    <ClubManagerView onCreateChampionship={() => setActiveTab('championships')} />
                    <LiveStandingsBoard />
                  </div>
                )}

                {!['org_admin', 'head_judge', 'club_manager'].includes(activeRole || '') && (
                  <div className="space-y-8">
                    <LiveStandingsBoard />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'championships' && <ChampionshipsManager />}
            {activeTab === 'delegations' && (
              activeRole === 'club_manager' ? (
                <ClubManagerView onCreateChampionship={() => setActiveTab('championships')} />
              ) : (
                <DelegationsManager />
              )
            )}
            {activeTab === 'judging' && (
              <div className="space-y-8">
                {activeRole === 'head_judge' && <HeadJudgeView />}
                <ScoringPad />
              </div>
            )}
            {activeTab === 'standings' && <LiveStandingsBoard />}
            {activeTab === 'billing' && <SubscriptionPlansView />}
          </div>
        )}
      </main>
    </div>
  )
}

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <DashboardContent />
      </OrganizationProvider>
    </AuthProvider>
  )
}

export default App

