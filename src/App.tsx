import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { env } from '@/core/config/env'
import { Trophy, ShieldCheck, Database, Layers, CheckCircle, AlertTriangle } from 'lucide-react'

export const App: React.FC = () => {
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
          <div className="flex items-center gap-2">
            <Badge variant="outline">Fase 1: Preparación Técnica & Arquitectura</Badge>
            {env.isConfigured ? (
              <Badge variant="success">Supabase Conectado</Badge>
            ) : (
              <Badge variant="warning">Supabase Modo Local / Pendiente Config</Badge>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Estado de la Base Técnica</h2>
          <p className="mt-1 text-sm text-slate-600">
            Plataforma comercial modular para campeonatos de gimnasia con aislamiento estricto por organización, RLS y auditoría de puntuaciones.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
              <h3 className="font-semibold text-slate-800">Seguridad & Multi-Tenancy</h3>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Políticas RLS en diseño por organización
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                No se exponen claves privilegiadas
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Aislamiento estricto de roles de plataforma
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
                Versionado explícito de código de puntos
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Fórmulas deterministas por disciplina
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Pista de auditoría inmutable de correcciones
              </li>
            </ul>
          </Card>

          <Card>
            <div className="flex items-center gap-3 mb-4">
              <Layers className="h-6 w-6 text-indigo-600" />
              <h3 className="font-semibold text-slate-800">Flujo de Publicación</h3>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Resultados borradores protegidos
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Canales en vivo provisionales vs oficiales
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                Clasificaciones derivadas de notas aprobadas
              </li>
            </ul>
          </Card>
        </div>

        {!env.isConfigured && (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-900">Variables de Entorno de Supabase</h4>
                <p className="mt-1 text-sm text-amber-700">
                  Copia el archivo <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-xs">.env.example</code> a{' '}
                  <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-xs">.env</code> y define tus credenciales públicas{' '}
                  <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-xs">VITE_SUPABASE_URL</code> y{' '}
                  <code className="font-mono bg-amber-100 px-1 py-0.5 rounded text-xs">VITE_SUPABASE_ANON_KEY</code>.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
