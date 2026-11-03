import React, { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { LogIn, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react'

export const AuthForm: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        })
        if (error) throw error
        setSuccessMsg('¡Cuenta creada exitosamente! Revisa tu correo o inicia sesión.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Error en autenticación')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          {isSignUp ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isSignUp ? 'Crear Cuenta en Operix' : 'Acceso a la Plataforma'}
          </h2>
          <p className="text-xs text-slate-500">
            {isSignUp ? 'Regístrate para gestionar o participar en campeonatos' : 'Ingresa con tus credenciales'}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nombre Completo</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ej. María González"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Correo Electrónico</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="usuario@dominio.com"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Contraseña</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 transition-colors"
        >
          {isLoading ? 'Procesando...' : isSignUp ? 'Registrarse' : 'Iniciar Sesión'}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-slate-500">
        {isSignUp ? '¿Ya tienes una cuenta?' : '¿No tienes cuenta aún?'}{' '}
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp)
            setErrorMsg(null)
            setSuccessMsg(null)
          }}
          className="font-semibold text-blue-700 hover:underline"
        >
          {isSignUp ? 'Inicia sesión' : 'Regístrate aquí'}
        </button>
      </div>
    </Card>
  )
}
