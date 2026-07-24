"use client";
import React, { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { parseISO } from 'date-fns';
import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Wind rose constants (same as PrevailingWindTab)
const SPEED_BINS = [
  { label: '0 ≤ Wₛ < 5',   min: 0,  max: 5,   color: '#1a3c5c' },
  { label: '5 ≤ Wₛ < 10',  min: 5,  max: 10,  color: '#2b7eb8' },
  { label: '10 ≤ Wₛ < 15', min: 10, max: 15,  color: '#6cc4b4' },
  { label: '15 ≤ Wₛ < 20', min: 15, max: 20,  color: '#a0d9a4' },
  { label: '20 ≤ Wₛ < 25', min: 20, max: 25,  color: '#e8f098' },
  { label: '25 ≤ Wₛ < 30', min: 25, max: 30,  color: '#f5d76e' },
  { label: '30 ≤ Wₛ < 35', min: 30, max: 35,  color: '#f2994a' },
  { label: '35 ≤ Wₛ < 40', min: 35, max: 40,  color: '#e74c3c' },
  { label: 'Wₛ ≥ 40',      min: 40, max: 999, color: '#7b1a2c' }
];

const DEGREE_SECTORS = Array.from({ length: 36 }, (_, i) => (i + 1) * 10);
const ORDERED_SECTORS = [360, ...DEGREE_SECTORS.filter(d => d !== 360)];

// Shared tooltip style
const tooltipStyle = {
  backgroundColor: 'var(--secondary)',
  border: '1px solid var(--card-border)',
  borderRadius: '8px'
};

export default function Charts({ data, startDate, endDate }) {

  // ── 5-year validation ──
  const yearSpan = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    return (e - s) / (1000 * 60 * 60 * 24 * 365.25);
  }, [startDate, endDate]);

  const isInsufficient = yearSpan < 5;

  // ── Parse all records once ──
  const records = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map(d => {
      try {
        const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
        const dt = parseISO(dateStr);
        if (isNaN(dt.getTime())) return null;
        return {
          ...d,
          _dt: dt,
          _month: dt.getUTCMonth(),
          _dayStr: dt.toISOString().split('T')[0],
          _vis: d.visibility !== null ? parseFloat(d.visibility) : null,
          _ws: d.windSpeed !== null ? parseFloat(d.windSpeed) : 0,
          _wg: d.windGust !== null ? parseFloat(d.windGust) : 0,
          _temp: d.temperature !== null ? parseFloat(d.temperature) : null,
          _dir: d.windDirection,
        };
      } catch { return null; }
    }).filter(Boolean);
  }, [data]);

  // ── Total unique days per month (denominator for risk %) ──
  const totalDaysPerMonth = useMemo(() => {
    const map = {};
    for (let m = 0; m < 12; m++) map[m] = new Set();
    records.forEach(r => map[r._month].add(r._dayStr));
    return Object.fromEntries(Object.entries(map).map(([m, s]) => [m, s.size]));
  }, [records]);

  // ── 1. Visibility Risk ──
  const visRiskData = useMemo(() => {
    const thresholds = [5000, 1000, 550];
    // days with at least one obs below threshold, per month
    const buckets = {};
    thresholds.forEach(t => { buckets[t] = {}; for (let m = 0; m < 12; m++) buckets[t][m] = new Set(); });

    records.forEach(r => {
      if (r._vis === null) return;
      thresholds.forEach(t => {
        if (r._vis < t) buckets[t][r._month].add(r._dayStr);
      });
    });

    return MONTHS.map((label, m) => {
      const total = totalDaysPerMonth[m] || 0;
      return {
        label,
        'VIS < 5000m': total > 0 ? parseFloat(((buckets[5000][m].size / total) * 100).toFixed(2)) : 0,
        'VIS < 1000m': total > 0 ? parseFloat(((buckets[1000][m].size / total) * 100).toFixed(2)) : 0,
        'VIS < 550m':  total > 0 ? parseFloat(((buckets[550][m].size / total) * 100).toFixed(2)) : 0,
      };
    });
  }, [records, totalDaysPerMonth]);

  // ── 2. Wind Risk (>50kt) ──
  const windRiskData = useMemo(() => {
    const buckets = {};
    for (let m = 0; m < 12; m++) buckets[m] = new Set();

    records.forEach(r => {
      const maxWind = Math.max(r._ws, r._wg);
      if (maxWind > 50) buckets[r._month].add(r._dayStr);
    });

    return MONTHS.map((label, m) => {
      const total = totalDaysPerMonth[m] || 0;
      return {
        label,
        'Wind > 50kt': total > 0 ? parseFloat(((buckets[m].size / total) * 100).toFixed(2)) : 0,
      };
    });
  }, [records, totalDaysPerMonth]);

  // ── 3. Wind Gust Rose ──
  const { gustRoseData, gustTotals } = useMemo(() => {
    let totalsObj = { rec: 0, vrb: 0 };
    if (records.length === 0) return { gustRoseData: [], gustTotals: totalsObj };

    // Only gust observations (windGust > 0)
    const gustObs = records.filter(r => r._wg > 0);
    totalsObj.rec = gustObs.length;

    const roseBuckets = {};
    DEGREE_SECTORS.forEach(deg => {
      roseBuckets[deg] = {};
      SPEED_BINS.forEach(b => roseBuckets[deg][b.label] = 0);
    });

    gustObs.forEach(r => {
      const deg = r._dir;
      const spd = r._wg; // gust speed for binning

      if (deg === 'VRB') {
        totalsObj.vrb++;
      } else if (deg !== null && deg !== undefined && !isNaN(deg)) {
        let bin = Math.round(deg / 10) * 10;
        if (bin === 0) bin = 360;
        if (roseBuckets[bin]) {
          const matchedBin = SPEED_BINS.find(b => spd >= b.min && spd < b.max) || SPEED_BINS[SPEED_BINS.length - 1];
          roseBuckets[bin][matchedBin.label]++;
        }
      }
    });

    const totalNonVRB = totalsObj.rec - totalsObj.vrb;
    const result = ORDERED_SECTORS.map(deg => {
      let bucket = { direction: deg };
      SPEED_BINS.forEach(b => {
        const raw = roseBuckets[deg]?.[b.label] || 0;
        bucket[b.label] = totalNonVRB > 0 ? parseFloat(((raw / totalNonVRB) * 100).toFixed(4)) : 0;
        bucket[`${b.label}_raw`] = raw;
      });
      return bucket;
    });

    return { gustRoseData: result, gustTotals: totalsObj };
  }, [records]);

  // ── 4. Monthly Temperature Climatology ──
  const tempClimatData = useMemo(() => {
    const buckets = {};
    for (let m = 0; m < 12; m++) buckets[m] = { temps: [] };

    records.forEach(r => {
      if (r._temp !== null) buckets[r._month].temps.push(r._temp);
    });

    return MONTHS.map((label, m) => {
      const arr = buckets[m].temps;
      if (arr.length === 0) return { label, Min: null, Avg: null, Max: null };
      return {
        label,
        Min: parseFloat(Math.min(...arr).toFixed(1)),
        Avg: parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)),
        Max: parseFloat(Math.max(...arr).toFixed(1)),
      };
    });
  }, [records]);

  // ── 5. TSRA & Snow Risk ──
  const wxRiskData = useMemo(() => {
    const tsraDays = {};
    const snowDays = {};
    for (let m = 0; m < 12; m++) { tsraDays[m] = new Set(); snowDays[m] = new Set(); }

    records.forEach(r => {
      if (!r.weather || r.weather.length === 0) return;
      r.weather.forEach(w => {
        // TSRA: thunderstorm descriptor + rain precipitation
        if (w.descriptor === 'thunderstorm' && w.precipitation === 'rain') {
          tsraDays[r._month].add(r._dayStr);
        }
        // Also match TS without RA (pure thunderstorm events)
        if (w.descriptor === 'thunderstorm' && !w.precipitation) {
          tsraDays[r._month].add(r._dayStr);
        }
        // VCTS (vicinity thunderstorm)
        if (w.intensity === 'in the vicinity' && w.descriptor === 'thunderstorm') {
          tsraDays[r._month].add(r._dayStr);
        }
        // Snow: any snow precipitation (SN, SHSN, +SN, -SN, BLSN, etc.)
        if (w.precipitation === 'snow') {
          snowDays[r._month].add(r._dayStr);
        }
      });
    });

    return MONTHS.map((label, m) => {
      const total = totalDaysPerMonth[m] || 0;
      return {
        label,
        'TSRA Risk': total > 0 ? parseFloat(((tsraDays[m].size / total) * 100).toFixed(2)) : 0,
        'Snow Risk': total > 0 ? parseFloat(((snowDays[m].size / total) * 100).toFixed(2)) : 0,
      };
    });
  }, [records, totalDaysPerMonth]);

  // ── Render ──
  if (isInsufficient) {
    return (
      <div className="glass-container" style={{ textAlign: 'center', padding: '64px 32px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '12px', color: '#fbbf24' }}>
          Insufficient Date Range
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '500px', margin: '0 auto', lineHeight: 1.6 }}>
          Please select a date range of at least <strong style={{ color: '#fff' }}>5 years</strong> for meaningful climatological analysis.
          The current selection covers approximately <strong style={{ color: '#fbbf24' }}>{yearSpan.toFixed(1)} years</strong>.
        </p>
      </div>
    );
  }

  // ECharts wind rose option builder (same visual style as PrevailingWindTab)
  const gustRoseOption = {
    title: {
      text: `Wind Gust Rose (Gust Obs: ${gustTotals.rec.toLocaleString()} / VRB: ${gustTotals.vrb.toLocaleString()} (${(gustTotals.rec ? (gustTotals.vrb / gustTotals.rec) * 100 : 0).toFixed(1)}%))`,
      left: 'center',
      top: 5,
      textStyle: { color: '#64748b', fontSize: 13, fontWeight: 500 }
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(15, 15, 25, 0.92)',
      borderColor: 'rgba(255,255,255,0.12)',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (params) => {
        if (!params || !params.name || !params.seriesName || params.componentType !== 'series') return '';
        const dir = typeof params.name === 'string' ? params.name.replace('°', '') : params.name;
        const bucket = gustRoseData.find(d => d.direction == dir);
        const binPct = params.value || 0;
        const binRaw = bucket ? (bucket[`${params.seriesName}_raw`] || 0) : 0;

        let sectorTotal = 0;
        if (bucket) {
          for (let b of SPEED_BINS) sectorTotal += bucket[b.label] || 0;
        }

        let pctDisplay = binPct === 0 ? '0.00%' : binPct < 0.01 ? '<0.01%' : `${binPct.toFixed(2)}%`;
        return `<b>${dir}°</b> | <span style="color:${params.color}">■</span> ${params.seriesName} kt: ${pctDisplay} (${binRaw.toLocaleString('tr-TR')} obs)<br/>All Speeds: ${sectorTotal.toFixed(2)}%`;
      }
    },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 40,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: { color: '#64748b', fontSize: 11 },
      data: SPEED_BINS.map(b => b.label)
    },
    graphic: (() => {
      const maxPct = gustRoseData.reduce((mx, d) => {
        let s = 0;
        SPEED_BINS.forEach(b => { s += d[b.label] || 0; });
        return Math.max(mx, s);
      }, 0);
      const rawInterval = maxPct / 4;
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval || 1)));
      const niceInterval = Math.ceil(rawInterval / magnitude) * magnitude;
      const tickValues = [];
      for (let i = 1; i <= 4; i++) {
        const val = niceInterval * i;
        if (val > 0) tickValues.push(val);
      }
      const angleDeg = 315;
      const angleRad = (angleDeg * Math.PI) / 180;
      const centerXPct = 44;
      const centerYPct = 54;
      const maxRadius = 68;
      const maxTickVal = tickValues.length > 0 ? tickValues[tickValues.length - 1] : 1;

      const pctLabels = tickValues.map(val => {
        const rPct = (val / maxTickVal) * maxRadius * 0.5;
        const x = centerXPct + rPct * Math.cos(angleRad);
        const y = centerYPct - rPct * Math.sin(angleRad);
        return {
          type: 'text',
          left: `${x}%`,
          top: `${y}%`,
          z: 100,
          style: {
            text: `${val}%`,
            fill: '#e2e8f0',
            fontSize: 11,
            fontWeight: 'bold',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            borderRadius: 3,
            padding: [2, 4, 2, 4],
            align: 'center',
            verticalAlign: 'middle'
          }
        };
      });

      return [
        {
          type: 'text',
          right: 5,
          top: 24,
          style: {
            text: 'Gust Speed (knots)',
            fill: '#64748b',
            fontSize: 12,
            fontWeight: 'bold'
          }
        },
        ...pctLabels
      ];
    })(),
    polar: { radius: '68%', center: ['44%', '54%'] },
    angleAxis: {
      type: 'category',
      data: ORDERED_SECTORS.map(d => `${d}°`),
      startAngle: 90,
      clockwise: true,
      boundaryGap: true,
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
      axisTick: { show: false },
      splitLine: { show: true, interval: 2, lineStyle: { color: 'rgba(255,255,255,0.08)' } },
      axisLabel: { interval: 2, color: '#64748b', fontSize: 11, margin: 8 }
    },
    radiusAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisPointer: { show: true, label: { show: false }, lineStyle: { color: 'rgba(255,255,255,0.4)', width: 1 } },
      axisLabel: { show: false },
      splitLine: { show: true, lineStyle: { color: 'rgba(255,255,255,0.12)', type: 'dashed' } },
      splitNumber: 4
    },
    series: SPEED_BINS.map(bin => ({
      type: 'bar',
      data: gustRoseData.map(d => d[bin.label]),
      coordinateSystem: 'polar',
      name: bin.label,
      stack: 'wind',
      itemStyle: { color: bin.color, borderColor: bin.color, borderWidth: 0.5 },
      emphasis: { focus: 'self' },
      barCategoryGap: '5%'
    }))
  };

  return (
    <div className="grid grid-cols-1 gap-4">

      {/* ── Visibility Risk ── */}
      <div className="glass-container">
        <h2 style={{ marginBottom: '4px', fontSize: '1.2rem', fontWeight: 600 }}>
          Visibility Risk by Month
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
          Percentage of days with at least one observation below the visibility threshold
        </p>
        <div style={{ height: '340px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visRiskData} margin={{ top: 5, right: 20, bottom: 5, left: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val}%`, undefined]} />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="VIS < 5000m" fill="#eab308" name="VIS < 5000m" radius={[2, 2, 0, 0]} />
              <Bar dataKey="VIS < 1000m" fill="#f97316" name="VIS < 1000m" radius={[2, 2, 0, 0]} />
              <Bar dataKey="VIS < 550m"  fill="#ef4444" name="VIS < 550m"  radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Wind Risk (>50kt) ── */}
      <div className="glass-container">
        <h2 style={{ marginBottom: '4px', fontSize: '1.2rem', fontWeight: 600 }}>
          High Wind Risk by Month (&gt;50 KT)
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
          Percentage of days with at least one observation where wind speed or gust exceeds 50 KT
        </p>
        <div style={{ height: '340px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={windRiskData} margin={{ top: 5, right: 20, bottom: 5, left: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val}%`, undefined]} />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="Wind > 50kt" fill="#8b5cf6" name="Wind > 50kt" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Wind Gust Rose ── */}
      <div className="glass-container">
        <h2 style={{ marginBottom: '4px', fontSize: '1.2rem', fontWeight: 600 }}>
          Wind Gust Rose
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
          Directional distribution of wind gust observations only (gust &gt; 0 KT)
        </p>
        <div style={{ height: '560px' }}>
          {gustRoseData.length > 0 ? (
            <ReactECharts
              option={gustRoseOption}
              style={{ height: '560px', width: '100%' }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              No gust observations in the selected data.
            </div>
          )}
        </div>
      </div>

      {/* ── Monthly Temperature Climatology ── */}
      <div className="glass-container">
        <h2 style={{ marginBottom: '4px', fontSize: '1.2rem', fontWeight: 600 }}>
          Monthly Temperature Climatology (°C)
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
          Absolute minimum, average, and absolute maximum temperatures by month
        </p>
        <div style={{ height: '340px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={tempClimatData} margin={{ top: 5, right: 20, bottom: 5, left: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} unit="°C" />
              <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val}°C`, undefined]} />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="Max" name="Max Temperature" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 4, fill: '#ef4444' }} />
              <Line type="monotone" dataKey="Avg" name="Avg Temperature" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 4, fill: '#22c55e' }} />
              <Line type="monotone" dataKey="Min" name="Min Temperature" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#3b82f6' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── TSRA & Snow Risk ── */}
      <div className="glass-container">
        <h2 style={{ marginBottom: '4px', fontSize: '1.2rem', fontWeight: 600 }}>
          Thunderstorm (TSRA) &amp; Snow Risk by Month
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>
          Percentage of days with thunderstorm (TS/TSRA/VCTS) or snow (SN) phenomena
        </p>
        <div style={{ height: '340px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={wxRiskData} margin={{ top: 5, right: 20, bottom: 5, left: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} unit="%" />
              <Tooltip contentStyle={tooltipStyle} formatter={(val) => [`${val}%`, undefined]} />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="TSRA Risk" fill="#f59e0b" name="⚡ TSRA Risk" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Snow Risk" fill="#06b6d4" name="❄️ Snow Risk" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
