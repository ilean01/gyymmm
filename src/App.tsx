import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DesktopSidebar } from './components/navigation/DesktopSidebar'
import {
  MobileBottomNav,
  type MobileNavItemId,
} from './components/navigation/MobileBottomNav'
import { AuthPlaceholderPage } from './pages/AuthPlaceholderPage'
import {
  DynamicPlaceholderPage,
  PlaceholderPage,
} from './pages/PlaceholderPage'
import { TodayPage } from './pages/TodayPage'
import { ProtectedRoute } from './router/ProtectedRoute'

const navPaths: Record<MobileNavItemId, string> = {
  today: '/',
  routines: '/routines',
  progress: '/progress',
  coach: '/coach',
}

function activeItemFromPath(pathname: string): MobileNavItemId {
  if (pathname.startsWith('/routines') || pathname.startsWith('/exercises')) {
    return 'routines'
  }

  if (pathname.startsWith('/progress')) {
    return 'progress'
  }

  if (pathname.startsWith('/coach')) {
    return 'coach'
  }

  return 'today'
}

function PrivateAppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeItem = activeItemFromPath(location.pathname)

  function handleNavigation(item: MobileNavItemId) {
    navigate(navPaths[item])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <AppShell
      contentWidth="narrow"
      mobileNavigation={
        <MobileBottomNav
          activeItem={activeItem}
          onChange={handleNavigation}
        />
      }
      desktopNavigation={
        <DesktopSidebar
          activeItem={activeItem}
          onChange={handleNavigation}
        />
      }
    >
      <Outlet />
    </AppShell>
  )
}

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<AuthPlaceholderPage mode="login" />}
      />
      <Route
        path="/register"
        element={<AuthPlaceholderPage mode="register" />}
      />

      <Route
        element={
          <ProtectedRoute>
            <PrivateAppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TodayPage />} />

        <Route
          path="/routines"
          element={
            <PlaceholderPage
              title="Rutinas"
              description="Acá vas a crear, editar y organizar tus rutinas."
            />
          }
        />

        <Route
          path="/routines/:id"
          element={
            <DynamicPlaceholderPage
              title="Detalle de rutina"
              description="Esta ruta queda reservada para ver y editar una rutina específica."
              paramName="id"
              entityLabel="Rutina"
            />
          }
        />

        <Route
          path="/workout/:id"
          element={
            <DynamicPlaceholderPage
              title="Entrenamiento"
              description="Esta ruta alojará una sesión de entrenamiento activa o histórica."
              paramName="id"
              entityLabel="Entrenamiento"
            />
          }
        />

        <Route
          path="/exercises"
          element={
            <PlaceholderPage
              title="Ejercicios"
              description="Biblioteca general y ejercicios personalizados."
            />
          }
        />

        <Route
          path="/progress"
          element={
            <PlaceholderPage
              title="Progreso"
              description="Historial, volumen, récords y evolución."
            />
          }
        />

        <Route
          path="/coach"
          element={
            <PlaceholderPage
              title="Coach IA"
              description="Ruta reservada para el Coach IA. No mostramos recomendaciones ficticias."
            />
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
