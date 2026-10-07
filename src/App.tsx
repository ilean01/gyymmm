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
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ExercisesPage } from './pages/ExercisesPage'
import { RoutineEditorPage } from './pages/RoutineEditorPage'
import { RoutinesPage } from './pages/RoutinesPage'
import { TodayPage } from './pages/TodayPage'
import { WorkoutBootstrapPage } from './pages/WorkoutBootstrapPage'
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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <ProtectedRoute>
            <PrivateAppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<TodayPage />} />

        <Route path="/routines" element={<RoutinesPage />} />
        <Route path="/routines/:id" element={<RoutineEditorPage />} />
        <Route path="/workout/:id" element={<WorkoutBootstrapPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />

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
