import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import {
  getAuthSession,
  subscribeToAuthChanges,
} from '../lib/auth-session'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const authRequired = import.meta.env.VITE_AUTH_REQUIRED !== 'false'
  const [session, setSession] = useState(() => getAuthSession())

  useEffect(() => {
    return subscribeToAuthChanges(() => {
      setSession(getAuthSession())
    })
  }, [])

  if (authRequired && !session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  return children
}
