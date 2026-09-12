import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { api, formatCompactINR, formatNumber } from '../lib/api';
import { useHouse } from '../context/HouseContext';

/**
 * State-level map of MPLADS allocation and fund utilisation.
 *
 * Every marker sits at the geographic centre of the state or union territory it
 * represents, and carries that state's own aggregated figures. MPLADS data contains no
 * coordinates for individual works, so this deliberately maps the unit the data *is*
 * about — the state — rather than scattering members' works across invented pins.
 *
 * Marker area is proportional to allocation and colour follows the utilisation band,
 * but neither is the only carrier of meaning: every marker is labelled, and the same
 * figures are available as a sortable table on the States page.
 */

/** Centroids of Indian states and union territories. Geographic constants. */
const CENTROIDS: Record<string, [number, number]> = {
  'Andaman And Nicobar Islands': [11.74, 92.66],
  'Andhra Pradesh': [15.91, 79.74],
  'Arunachal Pradesh': [28.22, 94.73],
  Assam: [26.20, 92.94],
  Bihar: [25.10, 85.31],
  Chandigarh: [30.73, 76.78],
  Chhattisgarh: [21.28, 81.87],
  'Dadra And Nagar Haveli And Daman And Diu': [20.40, 72.83],
  Delhi: [28.70, 77.10],
  Goa: [15.30, 74.12],
  Gujarat: [22.26, 71.19],
  Haryana: [29.06, 76.09],
  'Himachal Pradesh': [31.10, 77.17],
  'Jammu And Kashmir': [33.78, 76.58],
  Jharkhand: [23.61, 85.28],
  Karnataka: [15.32, 75.71],
  Kerala: [10.85, 76.27],
  Ladakh: [34.15, 77.58],
  Lakshadweep: [10.57, 72.64],
  'Madhya Pradesh': [22.97, 78.66],
  Maharashtra: [19.75, 75.71],
  Manipur: [24.66, 93.91],
  Meghalaya: [25.47, 91.37],
  Mizoram: [23.16, 92.94],
  Nagaland: [26.16, 94.56],
  Odisha: [20.95, 85.10],
  Puducherry: [11.94, 79.81],
  Punjab: [31.15, 75.34],
  Rajasthan: [27.02, 74.22],
  Sikkim: [27.53, 88.51],
  'Tamil Nadu': [11.13, 78.66],
  Telangana: [18.11, 79.02],
  Tripura: [23.94, 91.99],
  'Uttar Pradesh': [26.85, 80.95],
  Uttarakhand: [30.07, 79.02],
  'West Bengal': [22.99, 87.85],
};

const BAND_COLOR: Record<string, string> = {
  high: '#10b981',
  medium: '#f59e0b',
  low: '#f43f5e',
  unknown: '#94a3b8',
};
const BAND_LABEL: Record<string, string> = {
  high: 'High utilisation (≥80%)',
  medium: 'Medium utilisation (50–79%)',
  low: 'Low utilisation (<50%)',
  unknown: 'Utilisation not in dataset',
};

type StateRow = {
  state: string; mps: number; allocated: number; expenditure: number | null;
  utilization: number | null; utilizationBand: string;
  worksCompleted: number | null; worksRecommended: number | null;
};

/** Normalises the odd casings that appear across extracts before matching a centroid. */
function centroidFor(name: string): [number, number] | null {
  if (CENTROIDS[name]) return CENTROIDS[name];
  const key = Object.keys(CENTROIDS).find((k) => k.toLowerCase() === name.trim().toLowerCase());
  return key ? CENTROIDS[key] : null;
}

export default function IndiaMap() {
  const { house, param } = useHouse();
  const [states, setStates] = useState<StateRow[]>([]);

  useEffect(() => {
    api.get(`/performance/states${param()}`)
      .then((d) => setStates(d.states || []))
      .catch(() => setStates([]));
  }, [house]);

  const plotted = states
    .map((s) => ({ ...s, pos: centroidFor(s.state) }))
    .filter((s): s is StateRow & { pos: [number, number] } => s.pos !== null);

  const maxAllocation = Math.max(1, ...plotted.map((s) => s.allocated));
  // Area-proportional radius, so a state with twice the allocation reads as twice the mark.
  const radiusFor = (v: number) => 7 + Math.sqrt(v / maxAllocation) * 22;

  const unplotted = states.length - plotted.length;

  return (
    <div className="relative h-full min-h-[380px] w-full overflow-hidden rounded-xl">
      <MapContainer
        center={[22.6, 80.0]}
        zoom={4}
        minZoom={3}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', minHeight: 380, background: '#f8fafc' }}
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {plotted.map((s) => (
          <CircleMarker
            key={s.state}
            center={s.pos}
            radius={radiusFor(s.allocated)}
            pathOptions={{
              color: BAND_COLOR[s.utilizationBand] || BAND_COLOR.unknown,
              fillColor: BAND_COLOR[s.utilizationBand] || BAND_COLOR.unknown,
              fillOpacity: 0.35,
              weight: 1.5,
            }}
          >
            {/* Hovering reads the same figures as the popup, so the map can be scanned
                without clicking. `sticky` keeps the panel with the cursor. */}
            <Tooltip direction="top" offset={[0, -6]} opacity={1} sticky>
              <div className="w-[210px]">
                <p className="text-[13px] font-bold text-slate-900">{s.state}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{formatNumber(s.mps)} members</p>
                <dl className="mt-1.5 space-y-0.5 text-[12px]">
                  <div className="flex justify-between gap-4">
                    <dt className="whitespace-nowrap text-slate-500">Allocated</dt>
                    <dd className="font-semibold tabular-nums">{formatCompactINR(s.allocated)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="whitespace-nowrap text-slate-500">Spent</dt>
                    <dd className="tabular-nums">{s.expenditure === null ? '—' : formatCompactINR(s.expenditure)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="whitespace-nowrap text-slate-500">Utilisation</dt>
                    <dd className="tabular-nums">{s.utilization === null ? '—' : `${s.utilization.toFixed(1)}%`}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="whitespace-nowrap text-slate-500">Works done</dt>
                    <dd className="tabular-nums">
                      {s.worksCompleted === null ? '—' : `${formatNumber(s.worksCompleted)} / ${formatNumber(s.worksRecommended || 0)}`}
                    </dd>
                  </div>
                </dl>
                <p className="mt-1.5 text-[10px] text-slate-400">Click for links</p>
              </div>
            </Tooltip>
            <Popup>
              <div className="min-w-[190px]">
                <p className="text-[13px] font-bold text-slate-900">{s.state}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{formatNumber(s.mps)} members</p>
                <dl className="mt-2 space-y-1 text-[12px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Allocated</dt>
                    <dd className="font-semibold tabular-nums">{formatCompactINR(s.allocated)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Spent</dt>
                    <dd className="tabular-nums">{s.expenditure === null ? '—' : formatCompactINR(s.expenditure)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Utilisation</dt>
                    <dd className="tabular-nums">{s.utilization === null ? '—' : `${s.utilization.toFixed(1)}%`}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Works done</dt>
                    <dd className="tabular-nums">
                      {s.worksCompleted === null ? '—' : `${formatNumber(s.worksCompleted)} of ${formatNumber(s.worksRecommended || 0)}`}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] text-slate-500">{BAND_LABEL[s.utilizationBand]}</p>
                <Link
                  to={`/projects?state=${encodeURIComponent(s.state)}`}
                  className="mt-2 inline-block text-[12px] font-medium text-slate-700 underline underline-offset-2"
                >
                  View records →
                </Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="pointer-events-none absolute right-3 top-3 z-[400] rounded-lg border border-slate-200 bg-white/95 p-3 text-[11px] shadow-sm backdrop-blur">
        <p className="font-semibold text-slate-800">Fund utilisation by state</p>
        <ul className="mt-1.5 space-y-1">
          {(['high', 'medium', 'low'] as const).map((b) => (
            <li key={b} className="flex items-center gap-2 text-slate-600">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: BAND_COLOR[b] }} aria-hidden="true" />
              {BAND_LABEL[b]}
            </li>
          ))}
        </ul>
        <p className="mt-2 max-w-[190px] leading-snug text-slate-400">
          Circle area is proportional to allocation. Markers sit at state centroids — MPLADS data carries no
          coordinates for individual works.
        </p>
      </div>

      {unplotted > 0 && (
        <div className="absolute bottom-3 left-3 z-[400] rounded-md border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] text-slate-500 shadow-sm">
          {unplotted} state{unplotted === 1 ? '' : 's'} not plotted — no centroid on file
        </div>
      )}
    </div>
  );
}
