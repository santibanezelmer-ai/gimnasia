import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Zap, ArrowRight } from 'lucide-react'
import { useOrganization } from '@/features/organizations/OrganizationContext'

export const SubscriptionPlansView: React.FC = () => {
  const { activeOrganization } = useOrganization()

  const plans = [
    {
      id: 'free',
      name: 'Plan Club / Gratuito',
      price: '$0',
      period: 'para siempre',
      description: 'Ideal para clubes locales que participan en torneos de terceros y gestionan gimnastas.',
      features: [
        'Hasta 25 gimnastas registradas',
        'Inscripción en campeonatos públicos',
        'Visualización de notas en vivo',
        '1 usuario administrador de club',
      ],
      current: activeOrganization?.billingPlan === 'free',
      badge: 'Básico',
      buttonText: 'Plan Actual',
    },
    {
      id: 'pro',
      name: 'Plan Federación / Organizador',
      price: '$49.990',
      period: 'por mes',
      description: 'Para asociaciones y clubes anfitriones que organizan campeonatos oficiales con jurado y live stream.',
      features: [
        'Campeonatos ilimitados (públicos y privados)',
        'Gimnastas y delegaciones ilimitadas',
        'Mesa de jurado interactiva FIG / USAG',
        'Cómputo en vivo All-Around y por equipos',
        'Pista de auditoría inmutable de correcciones',
        'Soporte prioritario para eventos en vivo',
      ],
      current: activeOrganization?.billingPlan === 'pro',
      badge: 'Recomendado',
      buttonText: 'Gestionar Suscripción',
    },
    {
      id: 'enterprise',
      name: 'Plan Federación Nacional / Multi-Región',
      price: '$120.000',
      period: 'por mes',
      description: 'Solución a medida para federaciones nacionales con gestión de licencias anuales y ranking nacional.',
      features: [
        'Múltiples organizaciones filiales bajo un mismo paraguas',
        'Control centralizado de licencias y homologación',
        'Exportación personalizada de actas oficiales PDF',
        'Dominio propio (ej. resultados.fedegim.cl)',
        'SLA 99.9% de disponibilidad durante torneos',
      ],
      current: activeOrganization?.billingPlan === 'enterprise',
      badge: 'Federaciones',
      buttonText: 'Contactar Ventas',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          Planes y Suscripción SaaS (Fase 12)
        </h3>
        <p className="text-xs text-slate-500">
          Administración de suscripción, cupos deportivos y límites comerciales de la organización activa.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className={`flex flex-col justify-between transition-all ${
              plan.current
                ? 'border-2 border-blue-600 bg-blue-50/20 shadow-md'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {plan.badge}
                </span>
                {plan.current && <Badge variant="success">Activo</Badge>}
              </div>

              <h4 className="text-base font-bold text-slate-900">{plan.name}</h4>
              <p className="text-xs text-slate-500 mt-1 mb-4">{plan.description}</p>

              <div className="mb-4">
                <span className="text-3xl font-extrabold text-slate-900">{plan.price}</span>{' '}
                <span className="text-xs text-slate-500">{plan.period}</span>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-700 mb-2">Incluye:</p>
                <ul className="space-y-2 text-xs text-slate-600">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              <button
                type="button"
                className={`w-full rounded-lg py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                  plan.current
                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <span>{plan.buttonText}</span>
                {!plan.current && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
