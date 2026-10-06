import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation()
  const authRequired = import.meta.env.VITE_AUTH_REQUIRED === 'true'
  const token = localStorage.getItem('gymbro:access-token')

  if (authRequired && !token) {
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
