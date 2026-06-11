import { useMemo } from 'react';
import type { NuevaSolicitudState } from './YegoMiAutoNuevaSolicitud';
import type { YangoSuggestion } from './YegoMiAutoNuevaSolicitudConductor';
import { FileText } from 'lucide-react';

type Props = {
  state: NuevaSolicitudState;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

export default function YegoMiAutoNuevaSolicitudRevisar({ state, isSubmitting, onCancel, onSubmit }: Props) {
  const c = state.conductor as YangoSuggestion | null;

  const comprobanteUrl = useMemo(() => {
    if (!state.fileComprobante) return null;
    return URL.createObjectURL(state.fileComprobante);
  }, [state.fileComprobante]);

  return (
    <div className="space-y-5">
      {/* Conductor + Plan en fila */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conductor */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Conductor</h3>
          </div>
          <div className="px-5 py-4">
            {c ? (
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-lg font-bold text-red-700 shrink-0">
                  {c.name.first?.[0]}{c.name.last?.[0]}
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold text-gray-900">{c.name.first} {c.name.last}</p>
                  <p className="text-sm text-gray-500">{c.phone}</p>
                  {c.vehicle && (
                    <p className="text-sm text-gray-500">
                      {[c.vehicle.brand, c.vehicle.model, c.vehicle.year].filter(Boolean).join(' ')} · {c.vehicle.plate}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-red-600">No seleccionado</p>
            )}
          </div>
        </div>

        {/* Plan */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900">Plan</h3>
          </div>
          <div className="px-5 py-3">
            <Row label="País" value={state.country === 'PE' ? 'Perú' : 'Colombia'} />
            <Row label="Cronograma" value={state.cronogramaName || '—'} />
            <Row label="Vehículo" value={state.vehiculoName || '—'} />
            <Row
              label="Pago"
              value={state.pagoTipo === 'completo' ? 'Completo' : 'Parcial'}
            />
            {state.apps.length > 0 && <Row label="Apps" value={state.apps.join(', ')} />}
          </div>
        </div>
      </div>

      {/* Archivos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900">Archivos</h3>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {state.fileComprobante ? state.fileComprobante.name : 'Sin comprobante'}
              </p>
              <p className="text-xs text-gray-400">
                {state.fileComprobante ? `${(state.fileComprobante.size / 1024).toFixed(0)} KB` : 'No adjunto'}
              </p>
            </div>
          </div>
          {comprobanteUrl && state.fileComprobante && (
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50">
              {state.fileComprobante.type.startsWith('image/') ? (
                <img src={comprobanteUrl} alt="Comprobante" className="max-w-full max-h-56 object-contain mx-auto" />
              ) : (
                <embed src={comprobanteUrl} type="application/pdf" className="w-full h-64" />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium transition">
          Cancelar
        </button>
        <button type="button" onClick={onSubmit} disabled={isSubmitting} className="flex-1 px-5 py-2.5 bg-[#8B1A1A] text-white rounded-lg hover:bg-[#6B1515] disabled:opacity-50 font-medium text-sm transition">
          {isSubmitting ? 'Creando...' : 'Crear y generar Mi Auto'}
        </button>
      </div>
    </div>
  );
}
