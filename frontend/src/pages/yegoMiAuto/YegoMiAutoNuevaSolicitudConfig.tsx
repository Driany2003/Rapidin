import { useState, useEffect } from 'react';
import api from '../../services/api';
import { MIAUTO_NO_CACHE_HEADERS, isAxiosAbortError } from '../../utils/miautoApiUtils';
import type { NuevaSolicitudState } from './YegoMiAutoNuevaSolicitud';

const COUNTRY_OPTIONS = [
  { value: 'PE', label: 'Peru' },
  { value: 'CO', label: 'Colombia' },
];

const APPS_OPTIONS = [
  { code: 'yango', name: 'Yango' },
  { code: 'uber', name: 'Uber' },
  { code: 'indriver', name: 'InDriver' },
  { code: 'didii', name: 'Didi' },
];

type Cronograma = { id: string; name: string };
type Vehiculo = { id: string; name: string };

type Props = {
  state: NuevaSolicitudState;
  onChange: (patch: Partial<NuevaSolicitudState>) => void;
  cronogramas: Cronograma[];
  vehiculos: Vehiculo[];
  onCronogramasLoaded: (list: Cronograma[]) => void;
  onVehiculosLoaded: (list: Vehiculo[]) => void;
};

export default function YegoMiAutoNuevaSolicitudConfig({ state, onChange, cronogramas, vehiculos, onCronogramasLoaded, onVehiculosLoaded }: Props) {
  const [loadingVehiculos, setLoadingVehiculos] = useState(false);
  const [lastCountry, setLastCountry] = useState(state.country);

  // Cache cronogramas: solo recargar si cambia el país
  useEffect(() => {
    if (lastCountry !== state.country) {
      setLastCountry(state.country);
      onCronogramasLoaded([]);
      onVehiculosLoaded([]);
      onChange({ cronogramaId: '', cronogramaName: '', vehiculoId: '', vehiculoName: '' });
    }
    if (cronogramas.length > 0) return;
    const ac = new AbortController();
    const qs = new URLSearchParams();
    if (state.country) qs.set('country', state.country);
    qs.set('active', 'true');
    qs.set('lite', 'true');
    api.get(`/miauto/cronogramas?${qs.toString()}`, { signal: ac.signal, headers: MIAUTO_NO_CACHE_HEADERS })
      .then((res) => {
        const data = res.data?.data ?? res.data;
        const list = Array.isArray(data) ? data : [];
        onCronogramasLoaded(list.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      })
      .catch((e) => { if (!isAxiosAbortError(e)) onCronogramasLoaded([]); });
    return () => ac.abort();
  }, [state.country, cronogramas.length]);

  // Cache vehiculos: solo recargar si cambia el cronograma
  useEffect(() => {
    if (!state.cronogramaId) { onVehiculosLoaded([]); onChange({ vehiculoId: '', vehiculoName: '' }); return; }
    if (vehiculos.length > 0 && vehiculos[0]?.id !== '__loading__') return;
    const ac = new AbortController();
    setLoadingVehiculos(true);
    api.get(`/miauto/cronogramas/${state.cronogramaId}`, { signal: ac.signal, headers: MIAUTO_NO_CACHE_HEADERS })
      .then((res) => {
        const data = res.data?.data ?? res.data;
        const vehicles = data?.vehicles ?? data?.vehiculos ?? [];
        const list = Array.isArray(vehicles) ? vehicles.map((v: { id: string; name: string }) => ({ id: v.id, name: v.name })) : [];
        onVehiculosLoaded(list);
        if (list.length === 1) onChange({ vehiculoId: list[0].id, vehiculoName: list[0].name });
      })
      .catch((e) => { if (!isAxiosAbortError(e)) onVehiculosLoaded([]); })
      .finally(() => setLoadingVehiculos(false));
    return () => ac.abort();
  }, [state.cronogramaId]);

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-600 outline-none text-sm';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1.5">Pais</label>
          <select
            value={state.country}
            onChange={(e) => onChange({ country: e.target.value })}
            className={inputClass}
          >
            {COUNTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1.5">Cronograma</label>
          <select
            value={state.cronogramaId}
            onChange={(e) => onChange({ cronogramaId: e.target.value, cronogramaName: cronogramas.find(c => c.id === e.target.value)?.name || '' })}
            className={inputClass}
          >
            <option value="">Seleccionar...</option>
            {cronogramas.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1.5">Vehiculo</label>
          <select
            value={state.vehiculoId}
            onChange={(e) => onChange({ vehiculoId: e.target.value, vehiculoName: vehiculos.find(v => v.id === e.target.value)?.name || '' })}
            className={inputClass}
            disabled={loadingVehiculos || vehiculos.length === 0}
          >
            <option value="">{loadingVehiculos ? 'Cargando...' : 'Seleccionar...'}</option>
            {vehiculos.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span className="block text-xs font-semibold text-gray-900 mb-2">Apps trabajadas</span>
        <div className="flex flex-wrap gap-3">
          {APPS_OPTIONS.map((app) => (
            <label key={app.code} className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.apps.includes(app.code)}
                onChange={() => {
                  const next = state.apps.includes(app.code)
                    ? state.apps.filter((c) => c !== app.code)
                    : [...state.apps, app.code];
                  onChange({ apps: next });
                }}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">{app.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <p className="text-xs font-semibold text-gray-900 mb-3">Pago inicial</p>

        <div className="flex gap-6 mb-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="pagoTipo"
              value="completo"
              checked={state.pagoTipo === 'completo'}
              onChange={() => onChange({ pagoTipo: 'completo' })}
              className="text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700">Completo</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="pagoTipo"
              value="parcial"
              checked={state.pagoTipo === 'parcial'}
              onChange={() => onChange({ pagoTipo: 'parcial' })}
              className="text-red-600 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700">Parcial</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-900 mb-1">Comprobante de viajes</label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => onChange({ fileComprobante: e.target.files?.[0] ?? null })}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700"
            />
            {state.fileComprobante && (
              <p className="text-xs text-green-700 mt-1">{state.fileComprobante.name}</p>
            )}
          </div>
        </div>
      </div>
  );
}
