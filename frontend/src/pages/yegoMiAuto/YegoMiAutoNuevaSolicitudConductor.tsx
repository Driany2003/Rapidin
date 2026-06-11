import { useState, useCallback } from 'react';
import api from '../../services/api';
import { MIAUTO_NO_CACHE_HEADERS } from '../../utils/miautoApiUtils';
import { RapidinSearchField } from '../../components/RapidinSearchField';

export type YangoSuggestion = {
  contractor_id: string;
  name: { first: string; last: string };
  phone: string;
  balance: string;
  vehicle: {
    brand: string;
    model: string;
    year: number | null;
    plate: string;
  } | null;
};

type Props = {
  value: YangoSuggestion | null;
  onChange: (v: YangoSuggestion | null) => void;
};

export default function YegoMiAutoNuevaSolicitudConductor({ value, onChange }: Props) {
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState<YangoSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const doSearch = useCallback(async (text: string) => {
    const t = text.trim();
    if (t.length < 2) {
      setSuggestions([]);
      setError('');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/miauto/yango/contractor-suggestions', {
        params: { q: t },
        headers: MIAUTO_NO_CACHE_HEADERS,
      });
      setSuggestions(res.data?.data?.suggestions ?? []);
      if ((res.data?.data?.suggestions ?? []).length === 0) setSuggestions([]);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSelect = (s: YangoSuggestion) => {
    setError('');
    onChange(s);
    setSuggestions([]);
    setQ(`${s.name.first} ${s.name.last}`);
  };

  const handleClear = () => {
    setError('');
    onChange(null);
    setQ('');
    setSuggestions([]);
  };

  return (
    <div className="space-y-6">
      <div className="relative max-w-2xl">
      <RapidinSearchField
        id="yango-search"
        label="Buscar conductor en Yango"
        value={q}
        onChange={(v) => { setQ(v); doSearch(v); }}
        placeholder="Escribe DNI, nombre o licencia..."
        className="max-w-2xl"
      />

      {loading && <p className="text-sm text-gray-500 mt-1">Buscando...</p>}
      {error && !loading && suggestions.length === 0 && <p className="text-sm text-red-600 mt-1">{error}</p>}

      {suggestions.length > 0 && q.trim().length >= 2 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.contractor_id}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-4 py-3 hover:bg-red-50 transition-colors border-b border-gray-100 last:border-0"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    {s.name.first} {s.name.last}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">{s.phone}</p>
                  {s.vehicle && (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {[s.vehicle.brand, s.vehicle.model, s.vehicle.year].filter(Boolean).join(' ')}
                      {s.vehicle.plate ? ` | ${s.vehicle.plate}` : ''}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      </div>

      {value && (
        <div>
          <p className="text-xs font-semibold text-gray-900 mb-2">Conductor seleccionado</p>
          <div className="bg-white border border-gray-300 rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-gray-900 text-base">{value.name.first} {value.name.last}</p>
                <p className="text-sm text-gray-500">{value.phone}</p>
              </div>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-medium text-[#8B1A1A] border border-[#8B1A1A] rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
              >
                Cambiar
              </button>
            </div>
            {value.vehicle && (
              <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-gray-600 border-t border-gray-100 pt-3">
                <span>{[value.vehicle.brand, value.vehicle.model, value.vehicle.year].filter(Boolean).join(' ')}</span>
                <span>Placa: <span className="font-mono font-medium text-gray-800">{value.vehicle.plate}</span></span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
