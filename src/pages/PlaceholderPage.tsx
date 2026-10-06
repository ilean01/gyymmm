import { useParams } from 'react-router-dom'
import { PageSection } from '../components/layout/AppShell'
import { Card, StatePanel } from '../components/ui'

interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({
  title,
  description,
}: PlaceholderPageProps) {
  return (
    <PageSection>
      <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
        GymBro
      </p>

      <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
        {title}
      </h1>

      <p className="mt-5 text-base leading-7 text-gym-muted">
        {description}
      </p>

      <Card className="mt-6">
        <StatePanel
          title="Ruta lista"
          description="La URL ya es real y navegable. El contenido definitivo se construirá en su punto correspondiente del checklist."
        />
      </Card>
    </PageSection>
  )
}

interface DynamicPlaceholderPageProps extends PlaceholderPageProps {
  paramName: 'id'
  entityLabel: string
}

export function DynamicPlaceholderPage({
  title,
  description,
  paramName,
  entityLabel,
}: DynamicPlaceholderPageProps) {
  const params = useParams()
  const value = params[paramName]

  return (
    <PageSection>
      <p className="font-display text-sm font-bold uppercase tracking-[0.22em] text-gym-accent">
        GymBro
      </p>

      <h1 className="font-display mt-2 text-5xl font-extrabold uppercase leading-[0.9] tracking-tight">
        {title}
      </h1>

      <p className="mt-5 text-base leading-7 text-gym-muted">
        {description}
      </p>

      <Card className="mt-6">
        <StatePanel
          title={value ? `${entityLabel}: ${value}` : entityLabel}
          description="React Router leyó correctamente el parámetro dinámico de la URL."
        />
      </Card>
    </PageSection>
  )
}
