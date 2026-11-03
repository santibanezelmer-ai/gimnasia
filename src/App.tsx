import React, { useState } from 'react'
import { AuthProvider, useAuth } from '@/features/auth/AuthContext'
import { OrganizationProvider, useOrganization } from '@/features/organizations/OrganizationContext'
import { AuthForm } from '@/features/auth/AuthForm'
import { TenantSwitcher } from '@/features/organizations/TenantSwitcher'
import { ChampionshipsManager } from '@/features/championships/ChampionshipsManager'
import { DelegationsManager } from '@/features/delegations/DelegationsManager'
import { ScoringPad } from '@/features/scoring/ScoringPad'
import { LiveStandingsBoard } from '@/features/standings/LiveStandingsBoard'
import { HeadJudgeView } from '@/features/views/HeadJudgeView'
import { ClubManagerView } from '@/features/views/ClubManagerView'
import { SubscriptionPlansView } from '@/features/billing/SubscriptionPlansView'
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700 text-white shadow-sm">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Operix Gymnastics</h1>
                {profile?.platformRole === 'platform_admin' && (
                  <Badge variant="danger" className="text-[10px]">SuperAdmin Plataforma</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">SaaS Multi-Tenant Gymnastics Championship Management</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <TenantSwitcher />
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-slate-800">{profile?.fullName || user.email}</p>
                  <div className="flex items-center justify-end gap-1.5 mt-0.5">
                    <Badge variant={currentRoleInfo.variant} className="text-[9px] py-0 px-1">
                      {currentRoleInfo.label}
                    </Badge>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => signOut()}
                  title="Cerrar Sesión"
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Badge variant="outline">Modo Invitado / Auth Requerida</Badge>
            )}
          </div>
        </div>

        {/* Navigation Tabs (Scoped strictly by role) */}
        {user && activeOrganization && (
          <div className="border-t border-slate-100 bg-slate-50/50 px-6">
            <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto py-2 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Panel Principal</span>
              </button>

              {(activeRole === 'org_admin' || profile?.platformRole === 'platform_admin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('championships')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    activeTab === 'championships'
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <Trophy className="h-4 w-4" />
                  <span>Campeonatos</span>
                </button>
              )}

              {(activeRole === 'org_admin' || activeRole === 'club_manager' || profile?.platformRole === 'platform_admin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('delegations')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    activeTab === 'delegations'
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/60'
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
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    activeTab === 'judging'
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <Award className="h-4 w-4" />
                  <span>{activeRole === 'head_judge' ? 'Consola Juez Árbitro' : 'Mesa de Jurado FIG'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab('standings')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  activeTab === 'standings'
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <Flame className="h-4 w-4 text-orange-600" />
                <span>Resultados en Vivo</span>
              </button>

              {(activeRole === 'org_admin' || profile?.platformRole === 'platform_admin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('billing')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                    activeTab === 'billing'
                      ? 'bg-blue-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>Planes SaaS</span>
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {!user ? (
          <div className="py-8">
            <div className="max-w-md mx-auto mb-6 text-center">
              <h2 className="text-2xl font-bold text-slate-900">Acceso a Operix Gymnastics</h2>
              <p className="mt-1 text-sm text-slate-600">
                Inicia sesión con tu rol (Administrador, Juez o Delegado de Club) para ver tu consola personalizada.
              </p>
            </div>
            <AuthForm />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Tenant Overview Banner */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">Organización Activa</span>
                    <Badge variant={currentRoleInfo.variant}>{currentRoleInfo.label}</Badge>
                    <span className="text-xs text-slate-400 font-mono">Plan: {activeOrganization?.billingPlan?.toUpperCase() || 'FREE'}</span>
                  </div>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900">
                    {activeOrganization ? activeOrganization.name : 'No tienes una organización seleccionada'}
                  </h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    ID: {activeOrganization ? activeOrganization.id : 'N/A'} • Slug: {activeOrganization?.slug || 'N/A'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 border border-slate-200 text-xs">
                    <Building2 className="h-4 w-4 text-slate-600" />
                    <span>Membresías activas: <strong>{organizations.length}</strong></span>
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
                      <h4 className="text-sm font-bold text-slate-900">Simulador de Terminal de Jurado FIG</h4>
                      <ScoringPad gymnastName="Camila Valenzuela • Salto (VT)" />
                    </div>
                    <LiveStandingsBoard />
                  </div>
                )}

                {activeRole === 'club_manager' && (
                  <div className="space-y-8">
                    <ClubManagerView />
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
            {activeTab === 'delegations' && (activeRole === 'club_manager' ? <ClubManagerView /> : <DelegationsManager />)}
            {activeTab === 'judging' && (
              <div className="space-y-8">
                {activeRole === 'head_judge' && <HeadJudgeView />}
                <ScoringPad gymnastName="Camila Valenzuela • Club Manquehue" apparatusName="Salto (VT) - Ronda Final" />
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
