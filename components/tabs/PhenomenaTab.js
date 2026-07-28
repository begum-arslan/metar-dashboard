"use client";
import React, { useState, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';
import { generateOpsmetReport } from '@/utils/excelExport';
import { exportGraphAsPNG } from '@/utils/exportGraph';

const INTENSITIES = [
  { value: 'All', label: 'All Intensities' },
  { value: 'light', label: '(-) Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: '(+) Heavy' },
  { value: 'in the vicinity', label: '(VC) In the Vicinity' }
];

const DESCRIPTORS = [
  { value: 'All', label: 'All Descriptions' },
  { value: 'blowing', label: '(BL) Blowing' },
  { value: 'shallow', label: '(MI) Shallow' },
  { value: 'patches', label: '(BC) Patches' },
  { value: 'freezing', label: '(FZ) Freezing' },
  { value: 'partial', label: '(PR) Partial' },
  { value: 'shower', label: '(SH) Showers' },
  { value: 'low drifting', label: '(DR) Drifting' },
  { value: 'thunderstorm', label: '(TS) Thunderstorm' }
];

const PHENOMENAS = [
  { value: 'All', label: 'All Phenomena' },
  { value: 'FG', label: 'FG' },
  { value: 'IC', label: 'IC' },
  { value: 'SS', label: 'SS' },
  { value: 'SG', label: 'SG' },
  { value: 'GR', label: 'GR' },
  { value: 'BR', label: 'BR' },
  { value: 'DZ', label: 'DZ' },
  { value: 'SA', label: 'SA' },
  { value: 'SQ', label: 'SQ' },
  { value: 'FC', label: 'FC' },
  { value: 'DU', label: 'DU' },
  { value: 'PL', label: 'PL' },
  { value: 'VA', label: 'VA' },
  { value: 'GS', label: 'GS' },
  { value: 'HZ', label: 'HZ' },
  { value: 'PO', label: 'PO' },
  { value: 'SN', label: 'SN' },
  { value: 'FU', label: 'FU' },
  { value: 'DS', label: 'DS' },
  { value: 'RA', label: 'RA' }
];

export default function PhenomenaTab({ data, reportInfo }) {
  const chartRef = useRef(null);
  const [intensity, setIntensity] = useState('All');
  const [description, setDescription] = useState('All');
  const [phenomena, setPhenomena] = useState('All');

  const [appliedIntensity, setAppliedIntensity] = useState('All');
  const [appliedDesc, setAppliedDesc] = useState('All');
  const [appliedPhenom, setAppliedPhenom] = useState('All');
  const [timeGroup, setTimeGroup] = useState('Hourly');

  const handleClear = () => {
    setIntensity('All');
    setDescription('All');
    setPhenomena('All');
    setAppliedIntensity('All');
    setAppliedDesc('All');
    setAppliedPhenom('All');
    setTimeGroup('Hourly');
  };

  const handleRun = () => {
    setAppliedIntensity(intensity);
    setAppliedDesc(description);
    setAppliedPhenom(phenomena);
  };

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const filtered = data.filter(d => {
      // 1. Exact Phenomenon Check via raw tokens
      if (appliedPhenom !== 'All') {
        const rawStr = (d.raw || '').replace(/\s+(TEMPO|BECMG|NOSIG|PROB30|PROB40)\b.*/i, '');
        const cleanStr = d.station ? rawStr.replace(new RegExp('\\b' + d.station + '\\b', 'gi'), '') : rawStr;
        const rawTokens = cleanStr.split(/\s+/);
        const hasExactPhenom = rawTokens.some(t => {
          if (t.startsWith('RE')) return false;
          if (appliedPhenom === 'RA') return t.includes('RA') && !t.includes('RASN') && !t.includes('SNRA');
          if (appliedPhenom === 'SN') return t.includes('SN') && !t.includes('RASN') && !t.includes('SNRA');
          return t.includes(appliedPhenom);
        });
        if (!hasExactPhenom) return false;
      }

      // 2. Weather object checks (Intensity and Description)
      if (!d.weather || d.weather.length === 0) {
        // If metar-parser didn't parse anything, but we already matched the raw phenom (e.g. SS, PL, DS)
        if (appliedPhenom !== 'All' && appliedIntensity === 'All' && appliedDesc === 'All') {
          return true;
        }
        return false;
      }

      return d.weather.some(w => {
        const matchInt = appliedIntensity === 'All' || w.intensity === appliedIntensity || (appliedIntensity === 'moderate' && !w.intensity);
        const matchDesc = appliedDesc === 'All' || w.descriptor === appliedDesc;
        // If appliedPhenom is set, we already verified it exists in raw tokens.
        // We still need to ensure this specific weather object aligns if we want strictness, 
        // but since metar-parser structures vary, requiring matchInt and matchDesc is enough.
        return matchInt && matchDesc;
      });
    });

    // Grouping
    let buckets = {};
    if (timeGroup === 'Hourly') {
      for (let i = 0; i < 24; i++) buckets[i] = { label: String(i), obs: 0, uniqueDays: new Set() };
    } else if (timeGroup === 'Monthly') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 0; i < 12; i++) buckets[i] = { label: months[i], obs: 0, uniqueDays: new Set() };
    }

    filtered.forEach(d => {
      try {
        const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
        const dt = parseISO(dateStr);
        if (isNaN(dt.getTime())) return;

        let key = null;
        if (timeGroup === 'Hourly') key = dt.getUTCHours();
        else if (timeGroup === 'Monthly') key = dt.getUTCMonth();
        else if (timeGroup === 'Yearly') {
          key = dt.getUTCFullYear();
          if (!buckets[key]) buckets[key] = { label: String(key), obs: 0, uniqueDays: new Set() };
        }

        const dayStr = dt.toISOString().split('T')[0];
        if (key !== null && buckets[key]) {
          buckets[key].obs++;
          buckets[key].uniqueDays.add(dayStr);
        }
      } catch (e) { }
    });

    let result = [];
    if (timeGroup === 'Hourly' || timeGroup === 'Monthly' || timeGroup === 'Yearly') {
      result = Object.keys(buckets).sort((a, b) => parseInt(a) - parseInt(b)).map(k => ({
        label: buckets[k].label,
        Observations: buckets[k].obs,
        Days: buckets[k].uniqueDays.size
      }));
    }
    return result;
  }, [data, appliedIntensity, appliedDesc, appliedPhenom, timeGroup]);

  const totalObs = chartData.reduce((acc, curr) => acc + curr.Observations, 0);

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="intensity">Intensity</label>
            <select id="intensity" className={intensity === 'All' ? 'select-default' : ''} value={intensity} onChange={e => setIntensity(e.target.value)}>
              {INTENSITIES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="description">Description</label>
            <select id="description" className={description === 'All' ? 'select-default' : ''} value={description} onChange={e => setDescription(e.target.value)}>
              {DESCRIPTORS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="phenomena">Weather Phenomena</label>
            <select id="phenomena" className={phenomena === 'All' ? 'select-default' : ''} value={phenomena} onChange={e => setPhenomena(e.target.value)}>
              {PHENOMENAS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleRun}>▶ Run</button>
            <button className="btn-primary" style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }} onClick={handleClear}>✕ Clear</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              className="btn-primary"
              style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', color: '#ffffff', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
              onClick={() => exportGraphAsPNG(chartRef, 'PhenomenaTab.png')}
            >
              📈 Export Graph
            </button>
            <button
              className="btn-primary"
              style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#ffffff', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
              onClick={() => {
                if (!reportInfo) return;
                generateOpsmetReport({
                  analysis: 'Phenomena',
                  airport: reportInfo.airport,
                  begin: reportInfo.begin,
                  end: reportInfo.end,
                  selectedMonths: reportInfo.selectedMonths,
                  data,
                  extraParams: { INTENSITY: appliedIntensity, DESCRIPTOR: appliedDesc, PHENOMENA: appliedPhenom },
                  filterFn: (d) => {
                    // 1. Exact Phenomenon Check via raw tokens
                    if (appliedPhenom !== 'All') {
                      const rawStr = (d.raw || '').replace(/\s+(TEMPO|BECMG|NOSIG|PROB30|PROB40)\b.*/i, '');
                      const cleanStr = d.station ? rawStr.replace(new RegExp('\\b' + d.station + '\\b', 'gi'), '') : rawStr;
                      const rawTokens = cleanStr.split(/\s+/);
                      const hasExactPhenom = rawTokens.some(t => {
                        if (t.startsWith('RE')) return false;
                        if (appliedPhenom === 'RA') return t.includes('RA') && !t.includes('RASN') && !t.includes('SNRA');
                        if (appliedPhenom === 'SN') return t.includes('SN') && !t.includes('RASN') && !t.includes('SNRA');
                        return t.includes(appliedPhenom);
                      });
                      if (!hasExactPhenom) return false;
                    }

                    // 2. Weather object checks (Intensity and Description)
                    if (!d.weather || d.weather.length === 0) {
                      if (appliedPhenom !== 'All' && appliedIntensity === 'All' && appliedDesc === 'All') {
                        return true;
                      }
                      return false;
                    }

                    return d.weather.some(w => {
                      const matchInt = appliedIntensity === 'All' || w.intensity === appliedIntensity || (appliedIntensity === 'moderate' && !w.intensity);
                      const matchDesc = appliedDesc === 'All' || w.descriptor === appliedDesc;
                      return matchInt && matchDesc;
                    });
                  },
                });
              }}
            >
              📊 Export Report
            </button>
          </div>
        </div>

        {/* Chart Area */}
        <div ref={chartRef} className="glass-container md:col-span-3" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div className="tabs-container" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              {['Hourly', 'Monthly', 'Yearly'].map(tg => (
                <button
                  key={tg}
                  className={`tab-btn sub-tab-btn ${timeGroup === tg ? 'active' : ''}`}
                  onClick={() => setTimeGroup(tg)}
                >
                  {tg}
                </button>
              ))}
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
              Phenomena Query (Rec. Total: {totalObs})
            </div>
          </div>

          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 25, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} label={{ value: timeGroup === 'Hourly' ? 'Hours' : timeGroup === 'Monthly' ? 'Months' : 'Years', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)' }} />
                <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} label={{ value: 'Sum(Observations/Days)', angle: -90, position: 'insideLeft', offset: -15, fill: 'var(--text-muted)', style: { textAnchor: 'middle' } }} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Legend verticalAlign="top" height={36} iconType="rect" align="center" wrapperStyle={{ marginBottom: '16px' }} />

                <Bar dataKey="Observations" fill="#fb7185" name="Observations" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Days" fill="#60a5fa" name="Days" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
