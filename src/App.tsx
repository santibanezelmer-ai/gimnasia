import React from 'react'
import { AuthProvider, useAuth } from '@/features/auth/AuthContext'
import { OrganizationProvider, useOrganization } from '@/features/organizations/OrganizationContext'
import { AuthForm } from '@/features/auth/AuthForm'
import { TenantSwitcher } from '@/features/organizations/TenantSwitcher'
import { ChampionshipsManager } from '@/features/championships/ChampionshipsManager'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, ShieldCheck, Database, Layers, LogOut, CheckCircle, Users } from 'lucide-react'

const DashboardContent: React.FC = () => {
  const { user, profile, signOut } = useAuth()
  const { activeOrganization, activeRole, organizations } = useOrganization()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-700 text-white shadow-sm">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Operix Gymnastics</h1>
              <p className="text-xs text-slate-500">SaaS Multi-Tenant Gymnastics Championship Management</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="success">Supabase Conectado</Badge>
            {user ? (
              <div className="flex items-center gap-3">
                <TenantSwitcher />
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-slate-800">{profile?.fullName || user.email}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{user.email}</p>
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
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {!user ? (
          <div className="py-8">
            <div className="max-w-md mx-auto mb-6 text-center">
              <h2 className="text-2xl font-bold text-slate-900">Autenticación & Acceso Multi-Tenant</h2>
              <p className="mt-1 text-sm text-slate-600">
                Inicia sesión con tu cuenta o crea una nueva para interactuar con tus organizaciones y campeonatos.
              </p>
            </div>
            <AuthForm />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Tenant Overview */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">Organización Activa</span>
                    <Badge variant="default">{activeRole || 'Sin Rol Asignado'}</Badge>
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
                    <Users className="h-4 w-4 text-slate-600" />
                    <span>Membresías activas: <strong>{organizations.length}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Phase 6: Championships Module */}
            {activeOrganization && (
              <ChampionshipsManager />
            )}

            {/* Architecture Invariants */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Card>
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="h-6 w-6 text-emerald-600" />
                  <h3 className="font-semibold text-slate-800">Aislamiento RLS en Vivo</h3>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Filtrado estricto por <code>organization_id</code>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Escalamiento de privilegios bloqueado por trigger
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Consultas directas a PostgREST operativas
                  </li>
                </ul>
              </Card>

              <Card>
                <div className="flex items-center gap-3 mb-4">
                  <Database className="h-6 w-6 text-blue-600" />
                  <h3 className="font-semibold text-slate-800">Reglamento & Puntuaciones</h3>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Versionado de Código de Puntos FIG/USAG
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Fórmulas puras sin ejecución arbitraria
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Auditoría inmutable con motivo de cambio
                  </li>
                </ul>
              </Card>

              <Card>
                <div className="flex items-center gap-3 mb-4">
                  <Layers className="h-6 w-6 text-indigo-600" />
                  <h3 className="font-semibold text-slate-800">Próximo Hito: Fase Deportiva</h3>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Gestión de Campeonatos y Categorías
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Paneles de Jueces y Registro de Notas
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    Clasificaciones All-Around y por Equipos
                  </li>
                </ul>
              </Card>
            </div>
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
