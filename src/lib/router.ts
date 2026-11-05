/**
 * Lightweight SPA Router for Operix Gymnastics
 * Supports clean URLs:
 * - `/` -> Landing / Dashboard
 * - `/evento/:slug` -> Public Championship Portal
 * - `/club/rotaciones` -> Private Club Delegates Portal
 *
 * Desarrollado por Comercial Hels SpA.
 */

import { useState, useEffect, useCallback } from 'react'

export interface RouteState {
  path: string
  params: Record<string, string>
}

function parsePath(pathname: string): RouteState {
  const cleanPath = pathname.replace(/\/$/, '') || '/'

  // 1. Match /evento/:slug
  const eventMatch = cleanPath.match(/^\/evento\/([^/]+)/)
  if (eventMatch) {
    return {
      path: '/evento',
      params: { slug: decodeURIComponent(eventMatch[1]) },
    }
  }

  // 2. Match /club/rotaciones
  if (cleanPath === '/club/rotaciones' || cleanPath.startsWith('/club/rotaciones')) {
    return {
      path: '/club/rotaciones',
      params: {},
    }
  }

  return {
    path: cleanPath,
    params: {},
  }
}

export function useRouter() {
  const [route, setRoute] = useState<RouteState>(() => parsePath(window.location.pathname))

  useEffect(() => {
    const handlePopState = () => {
      setRoute(parsePath(window.location.pathname))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((to: string) => {
    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to)
      setRoute(parsePath(to))
      window.scrollTo(0, 0)
    }
  }, [])

  return { route, navigate }
}
