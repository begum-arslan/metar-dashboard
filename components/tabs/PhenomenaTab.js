"use client";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';
import { generateOpsmetReport } from '@/utils/excelExport';
import { exportGraphAsPNG } from '@/utils/exportGraph';

const INTENSITIES = [
  { value: 'All', label: 'All Intensities' },
  { value: 'light', label: '(-) Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: '(+) Heavy' }
];

const DESCRIPTORS = [
  { value: 'none', label: '(None) No Description' },
  { value: 'blowing', label: '(BL) Blowing' },
  { value: 'shallow', label: '(MI) Shallow' },
  { value: 'patches', label: '(BC) Patches' },
  { value: 'freezing', label: '(FZ) Freezing' },
  { value: 'partial', label: '(PR) Partial' },
  { value: 'shower', label: '(SH) Showers' },
  { value: 'low drifting', label: '(DR) Drifting' },
  { value: 'thunderstorm', label: '(TS) Thunderstorm' }
];

const DESC_TO_CODE = {
  'blowing': 'BL', 'shallow': 'MI', 'patches': 'BC', 'freezing': 'FZ',
  'partial': 'PR', 'shower': 'SH', 'low drifting': 'DR', 'thunderstorm': 'TS'
};

const PHENOMENAS = [
  { value: 'All', label: 'All Phenomena' },
  { value: 'SN', label: 'SN' },
  { value: 'RA', label: 'RA' },
  { value: 'SNRA', label: 'SNRA' },
  { value: 'RASN', label: 'RASN' },
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
  { value: 'FU', label: 'FU' },
  { value: 'DS', label: 'DS' }
];

const ALL_DESCRIPTOR_CODES = ['TS', 'SH', 'FZ', 'BL', 'MI', 'BC', 'PR', 'DR'];
const ALL_PHENOMENA_CODES = ['RA', 'SN', 'DZ', 'FG', 'BR', 'HZ', 'SQ', 'FC', 'SS', 'DS', 'GR', 'GS', 'PL', 'SG', 'IC', 'DU', 'SA', 'VA', 'PO', 'FU'];

function matchMetarToken(rawToken, { appliedIntensity, appliedIncludeVC, appliedDescriptions, appliedPhenomena }) {
  let t = rawToken.trim().toUpperCase();
  if (!t || t.startsWith('RE')) return false;

  const isVC = t.startsWith('VC');
  if (appliedIncludeVC && !isVC) return false;
  if (!appliedIncludeVC && isVC) return false;

  if (t.startsWith('+') || t.startsWith('-')) {
    const prefix = t[0];
    if (appliedIntensity === 'light' && prefix !== '-') return false;
    if (appliedIntensity === 'heavy' && prefix !== '+') return false;
    if (appliedIntensity === 'moderate') return false;
    t = t.slice(1);
  } else if (isVC) {
    t = t.slice(2);
  } else {
    if (appliedIntensity === 'light' || appliedIntensity === 'heavy') return false;
  }

  const selectedDescCodes = (appliedDescriptions || []).map(d => DESC_TO_CODE[d]).filter(Boolean);
  const isNoneDescSelected = (appliedDescriptions || []).includes('none');
  const hasAnySelectedDesc = selectedDescCodes.length > 0;

  if (hasAnySelectedDesc && !isNoneDescSelected) {
    if (!selectedDescCodes.some(code => t.includes(code))) return false;
  } else if (isNoneDescSelected && !hasAnySelectedDesc) {
    if (ALL_DESCRIPTOR_CODES.some(code => t.includes(code))) return false;
  } else if (hasAnySelectedDesc && isNoneDescSelected) {
    const hasSelected = selectedDescCodes.some(code => t.includes(code));
    const hasAnyDesc = ALL_DESCRIPTOR_CODES.some(code => t.includes(code));
    if (hasAnyDesc && !hasSelected) return false;
  }

  const hasSelectedPhenomena = appliedPhenomena && appliedPhenomena.length > 0;

  if (hasSelectedPhenomena) {
    let phenomMatch = appliedPhenomena.some(phenom => {
      if (phenom === 'RA') return t.includes('RA') && !t.includes('RASN') && !t.includes('SNRA');
      if (phenom === 'SN') return t.includes('SN') && !t.includes('RASN') && !t.includes('SNRA');
      return t.includes(phenom);
    });
    if (!phenomMatch) return false;

    if (t.includes('SN') && !appliedPhenomena.includes('SN') && !appliedPhenomena.includes('SNRA') && !appliedPhenomena.includes('RASN')) return false;
    if (t.includes('RA') && !appliedPhenomena.includes('RA') && !appliedPhenomena.includes('SNRA') && !appliedPhenomena.includes('RASN')) return false;
  } else {
    const hasAnyDescFilterActive = (appliedDescriptions && appliedDescriptions.length > 0);
    if (hasAnyDescFilterActive && !isNoneDescSelected) {
      if (ALL_PHENOMENA_CODES.some(code => t.includes(code))) return false;
    }
  }

  return true;
}

export default function PhenomenaTab({ data, reportInfo }) {
  const chartRef = useRef(null);
  const descRef = useRef(null);
  const phenomRef = useRef(null);
  const [intensity, setIntensity] = useState('All');
  const [includeVC, setIncludeVC] = useState(false);
  const [selectedDescriptions, setSelectedDescriptions] = useState([]);
  const [selectedPhenomena, setSelectedPhenomena] = useState([]);

  const [appliedIntensity, setAppliedIntensity] = useState('All');
  const [appliedIncludeVC, setAppliedIncludeVC] = useState(false);
  const [appliedDescriptions, setAppliedDescriptions] = useState(null);
  const [appliedPhenomena, setAppliedPhenomena] = useState(null);
  
  const [isDescOpen, setIsDescOpen] = useState(false);
  const [isPhenomenaOpen, setIsPhenomenaOpen] = useState(false);
  const [timeGroup, setTimeGroup] = useState('Hourly');

  useEffect(() => {
    function handleClickOutside(event) {
      if (descRef.current && !descRef.current.contains(event.target)) {
        setIsDescOpen(false);
      }
      if (phenomRef.current && !phenomRef.current.contains(event.target)) {
        setIsPhenomenaOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleClear = () => {
    setIntensity('All');
    setIncludeVC(false);
    setSelectedDescriptions([]);
    setSelectedPhenomena([]);
    setAppliedIntensity('All');
    setAppliedIncludeVC(false);
    setAppliedDescriptions(null);
    setAppliedPhenomena(null);
    setTimeGroup('Hourly');
  };

  const handleRun = () => {
    setAppliedIntensity(intensity);
    setAppliedIncludeVC(includeVC);
    setAppliedDescriptions([...selectedDescriptions]);
    setAppliedPhenomena([...selectedPhenomena]);
  };

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const filtered = data.filter(d => {
      const rawStr = (d.raw || '').replace(/\s+(TEMPO|BECMG|NOSIG|PROB30|PROB40)\b.*/i, '');
      const cleanStr = d.station ? rawStr.replace(new RegExp('\\b' + d.station + '\\b', 'gi'), '') : rawStr;
      const rawTokens = cleanStr.split(/\s+/);

      const hasMatchingToken = rawTokens.some(t => matchMetarToken(t, { appliedIntensity, appliedIncludeVC, appliedDescriptions, appliedPhenomena }));
      if (hasMatchingToken) return true;

      if (d.weather && d.weather.length > 0) {
        return d.weather.some(w => {
          const isVC = w.intensity === 'VC' || w.intensity === 'in the vicinity';
          if (appliedIncludeVC && !isVC) return false;
          if (!appliedIncludeVC && isVC) return false;

          const matchInt = appliedIntensity === 'All' 
            ? true 
            : (w.intensity === appliedIntensity || (appliedIntensity === 'moderate' && !w.intensity));

          const matchDesc = (!appliedDescriptions || appliedDescriptions.length === 0) || 
            appliedDescriptions.some(desc => {
              if (desc === 'none') return !w.descriptor;
              return w.descriptor === desc;
            });

          let matchPhen = true;
          if (appliedPhenomena && appliedPhenomena.length > 0) {
            matchPhen = appliedPhenomena.some(ph => {
              if (ph === 'RA') return w.precipitation === 'rain';
              if (ph === 'SN') return w.precipitation === 'snow';
              if (ph === 'FG') return w.obscuration === 'fog';
              if (ph === 'BR') return w.obscuration === 'mist';
              if (ph === 'HZ') return w.obscuration === 'haze';
              if (ph === 'DZ') return w.precipitation === 'drizzle';
              return true;
            });
          } else if (appliedDescriptions && appliedDescriptions.length > 0 && !appliedDescriptions.includes('none')) {
            if (appliedDescriptions.includes('thunderstorm') && w.descriptor === 'thunderstorm') {
              if (w.precipitation) return false;
            }
          }

          return matchInt && matchDesc && matchPhen;
        });
      }

      return false;
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
  }, [data, appliedIntensity, appliedDescriptions, appliedPhenomena, timeGroup]);

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

          <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <input 
              type="checkbox" 
              id="includeVC" 
              checked={includeVC} 
              onChange={e => setIncludeVC(e.target.checked)} 
              style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
            />
            <label htmlFor="includeVC" style={{ margin: 0, cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Include VC (Vicinity)</label>
          </div>

          <div className="form-group" ref={descRef} style={{ marginBottom: 0, position: 'relative' }}>
            <label>Description</label>
            <div 
              onClick={() => setIsDescOpen(!isDescOpen)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {selectedDescriptions.length === 0 ? (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>All Descriptions</span>
                ) : (
                  selectedDescriptions.map(desc => {
                    const labelStr = DESCRIPTORS.find(d => d.value === desc)?.label.split(' ')[0] || desc;
                    return (
                      <span key={desc} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }} onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDescriptions(prev => prev.filter(d => d !== desc));
                      }}>{labelStr} ✕</span>
                    );
                  })
                )}
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>▼</span>
            </div>
            {isDescOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1a1a1a', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {DESCRIPTORS.map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.8rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 'normal', color: '#e2e8f0' }}>
                    <input type="checkbox" checked={selectedDescriptions.includes(opt.value)} onChange={() => {
                      setSelectedDescriptions(prev => prev.includes(opt.value) ? prev.filter(d => d !== opt.value) : [...prev, opt.value]);
                    }} style={{ margin: 0 }} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="form-group" ref={phenomRef} style={{ marginBottom: 0, position: 'relative' }}>
            <label>Weather Phenomena</label>
            <div 
              onClick={() => setIsPhenomenaOpen(!isPhenomenaOpen)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {selectedPhenomena.length === 0 ? (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>All Phenomena</span>
                ) : (
                  selectedPhenomena.map(ph => (
                    <span key={ph} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }} onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhenomena(prev => prev.filter(p => p !== ph));
                    }}>{ph} ✕</span>
                  ))
                )}
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>▼</span>
            </div>
            {isPhenomenaOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1a1a1a', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {PHENOMENAS.map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.8rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 'normal', color: '#e2e8f0' }}>
                    <input type="checkbox" checked={selectedPhenomena.includes(opt.value)} onChange={() => {
                      setSelectedPhenomena(prev => prev.includes(opt.value) ? prev.filter(p => p !== opt.value) : [...prev, opt.value]);
                    }} style={{ margin: 0 }} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.2' }}>
              * Selections work independently (OR logic). To filter mixed precipitations, please explicitly select SNRA or RASN options.
            </div>
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
                  extraParams: { INTENSITY: appliedIntensity, DESCRIPTOR: appliedDescriptions ? appliedDescriptions.join(',') : 'All', PHENOMENA: appliedPhenomena ? appliedPhenomena.join(',') : 'All' },
                  filterFn: (d) => {
                    const rawStr = (d.raw || '').replace(/\s+(TEMPO|BECMG|NOSIG|PROB30|PROB40)\b.*/i, '');
                    const cleanStr = d.station ? rawStr.replace(new RegExp('\\b' + d.station + '\\b', 'gi'), '') : rawStr;
                    const rawTokens = cleanStr.split(/\s+/);

                    const hasMatchingToken = rawTokens.some(t => matchMetarToken(t, { appliedIntensity, appliedIncludeVC, appliedDescriptions, appliedPhenomena }));
                    if (hasMatchingToken) return true;

                    if (d.weather && d.weather.length > 0) {
                      return d.weather.some(w => {
                        const isVC = w.intensity === 'VC' || w.intensity === 'in the vicinity';
                        if (appliedIncludeVC && !isVC) return false;
                        if (!appliedIncludeVC && isVC) return false;

                        const matchInt = appliedIntensity === 'All' 
                          ? true 
                          : (w.intensity === appliedIntensity || (appliedIntensity === 'moderate' && !w.intensity));

                        const matchDesc = (!appliedDescriptions || appliedDescriptions.length === 0) || 
                          appliedDescriptions.some(desc => {
                            if (desc === 'none') return !w.descriptor;
                            return w.descriptor === desc;
                          });

                        let matchPhen = true;
                        if (appliedPhenomena && appliedPhenomena.length > 0) {
                          matchPhen = appliedPhenomena.some(ph => {
                            if (ph === 'RA') return w.precipitation === 'rain';
                            if (ph === 'SN') return w.precipitation === 'snow';
                            if (ph === 'FG') return w.obscuration === 'fog';
                            if (ph === 'BR') return w.obscuration === 'mist';
                            if (ph === 'HZ') return w.obscuration === 'haze';
                            if (ph === 'DZ') return w.precipitation === 'drizzle';
                            return true;
                          });
                        } else if (appliedDescriptions && appliedDescriptions.length > 0 && !appliedDescriptions.includes('none')) {
                          if (appliedDescriptions.includes('thunderstorm') && w.descriptor === 'thunderstorm') {
                            if (w.precipitation) return false;
                          }
                        }

                        return matchInt && matchDesc && matchPhen;
                      });
                    }

                    return false;
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
