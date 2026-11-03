import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'

export const ClubManagerView: React.FC = () => {
  const myClubRegistrations = [
    {
      id: 'reg-1',
      gymnast: 'Camila Valenzuela',
      rut: '21.458.120-K',
      license: 'FED-GAF-2026-089',
      category: 'Nivel 5 GAF (Mayor)',
      rotation: 'Subdivisión 2 • Rotación B',
      status: 'approved' as const,
      scores: { VT: 13.6, UB: 13.6, BB: 13.0, FX: 13.4, total: 53.6 },
    },
    {
      id: 'reg-2',
      gymnast: 'Martina Rojas',
      rut: '22.301.890-4',
      license: 'FED-GAF-2026-144',
      category: 'Nivel 4 GAF (Juvenil)',
      rotation: 'Subdivisión 1 • Rotación A',
      status: 'approved' as const,
      scores: { VT: 13.1, UB: 12.8, BB: 12.9, FX: 13.0, total: 51.8 },
    },
    {
      id: 'reg-3',
      gymnast: 'Pascuala Díaz',
      rut: '23.114.778-9',
      license: 'FED-GAF-2026-210',
      category: 'Nivel 3 GAF (Infantil B)',
      rotation: 'Pendiente sorteo',
      status: 'pending_approval' as const,
      scores: null,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-emerald-600" />
            Portal del Club: Delegación & Estado de Inscripciones
          </h3>
          <p className="text-xs text-slate-500">
            Vista exclusiva para tu club. No tienes acceso a datos médicos ni documentos privados de otros clubes.
          </p>
        </div>

        <Badge variant="default">Club Deportivo Manquehue (CDM)</Badge>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Gimnastas Inscritas en el Campeonato Nacional 2026
          </h4>
          <span className="text-xs text-slate-500">Total: {myClubRegistrations.length} gimnastas</span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Gimnasta</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">Horario / Rotación</th>
              <th className="px-4 py-3 font-semibold">Estado Inscripción</th>
              <th className="px-4 py-3 font-semibold text-right">Puntaje AA Registrado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {myClubRegistrations.map((reg) => (
              <tr key={reg.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <p className="font-bold text-slate-900">{reg.gymnast}</p>
                  <p className="text-[10px] text-slate-400 font-mono">Licencia: {reg.license}</p>
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{reg.category}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{reg.rotation}</td>
                <td className="px-4 py-3">
                  {reg.status === 'approved' ? (
                    <Badge variant="success" className="text-[10px]">Aprobada / Habilitada</Badge>
                  ) : (
                    <Badge variant="warning" className="text-[10px]">Pendiente de Pago / Visado</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {reg.scores ? (
                    <span className="font-mono font-bold text-blue-900 text-sm">
                      {reg.scores.total.toFixed(3)}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-mono">Sin competir</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
