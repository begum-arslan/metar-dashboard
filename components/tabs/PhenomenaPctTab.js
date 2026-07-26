"use client";
import React, { useState, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';
import { generateOpsmetPctReport } from '@/utils/excelExport';
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
  { value: 'thunderstorm', label: '(TS) Thunderstorm' },
  { value: 'shower', label: '(SH) Showers' },
  { value: 'freezing', label: '(FZ) Freezing' },
  { value: 'shallow', label: '(MI) Shallow' },
  { value: 'patches', label: '(BC) Patches' },
  { value: 'partial', label: '(PR) Partial' }
];

const PHENOMENAS = [
  { value: 'All', label: 'All Phenomena' },
  { value: 'rain', label: '(RA) Rain' },
  { value: 'snow', label: '(SN) Snow' },
  { value: 'rasn', label: '(RASN) Rain and Snow' },
  { value: 'snra', label: '(SNRA) Snow and Rain' },
  { value: 'drizzle', label: '(DZ) Drizzle' },
  { value: 'fog', label: '(FG) Fog' },
  { value: 'mist', label: '(BR) Mist' },
  { value: 'haze', label: '(HZ) Haze' },
  { value: 'sand', label: '(SA) Sand' },
  { value: 'dust', label: '(DU) Dust' },
  { value: 'hail', label: '(GR) Hail' },
  { value: 'squalls', label: '(SQ) Squalls' }
];

export default function PhenomenaPctTab({ data, reportInfo }) {
  const chartRef = useRef(null);
  const [intensity, setIntensity] = useState('All');
  const [description, setDescription] = useState('All');
  const [phenomena, setPhenomena] = useState('All');
  
  const [appliedIntensity, setAppliedIntensity] = useState('All');
  const [appliedDesc, setAppliedDesc] = useState('All');
  const [appliedPhenom, setAppliedPhenom] = useState('All');
  
  const [timeGroup, setTimeGroup] = useState('Hourly'); // 'Hourly', 'Monthly', 'Yearly'

  const handleRun = () => {
    setAppliedIntensity(intensity);
    setAppliedDesc(description);
    setAppliedPhenom(phenomena);
  };

  const handleClear = () => {
    setIntensity('All');
    setDescription('All');
    setPhenomena('All');
    setAppliedIntensity('All');
    setAppliedDesc('All');
    setAppliedPhenom('All');
  };

  const { chartData, totalRecords, totalCriteria, totalMetar } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], totalRecords: 0, totalCriteria: 0, totalMetar: 0 };

    // Parse dates
    const parsed = data.map(d => {
      try {
        const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
        const dt = parseISO(dateStr);
        if (isNaN(dt.getTime())) return null;
        return { ...d, _dt: dt };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    const records = parsed.length;

    // Initialize buckets
    let buckets = {};
    if (timeGroup === 'Hourly') {
      for (let i = 0; i < 24; i++) {
        buckets[i] = { label: String(i), metarRec: 0, criteriaRec: 0 };
      }
    } else if (timeGroup === 'Monthly') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      for (let i = 0; i < 12; i++) {
        buckets[i] = { label: months[i], metarRec: 0, criteriaRec: 0 };
      }
    }
    // Yearly created dynamically

    parsed.forEach(d => {
      let key = null;
      if (timeGroup === 'Hourly') {
        key = d._dt.getUTCHours();
      } else if (timeGroup === 'Monthly') {
        key = d._dt.getUTCMonth();
      } else if (timeGroup === 'Yearly') {
        key = d._dt.getUTCFullYear();
        if (!buckets[key]) {
          buckets[key] = { label: String(key), metarRec: 0, criteriaRec: 0 };
        }
      }

      if (key !== null) {
        buckets[key].metarRec++;

        // Criteria check
        let criteriaMet = false;
        if (d.weather && d.weather.length > 0) {
          if (appliedPhenom !== 'All') {
            const rawTokens = (d.raw || '').split(/\s+/);
            let phenomCode = '';
            if (appliedPhenom === 'rain') phenomCode = 'RA';
            else if (appliedPhenom === 'snow') phenomCode = 'SN';
            else if (appliedPhenom === 'rasn') phenomCode = 'RASN';
            else if (appliedPhenom === 'snra') phenomCode = 'SNRA';
            
            if (phenomCode) {
              const hasExactPhenom = rawTokens.some(t => {
                if (t.startsWith('RE')) return false;
                if (phenomCode === 'RA') return t.includes('RA') && !t.includes('RASN') && !t.includes('SNRA');
                if (phenomCode === 'SN') return t.includes('SN') && !t.includes('RASN') && !t.includes('SNRA');
                return t.includes(phenomCode);
              });
              if (!hasExactPhenom) return; // Skip rest of checks, this record doesn't meet exact criteria
            }
          }

          criteriaMet = d.weather.some(w => {
            const matchInt = appliedIntensity === 'All' || w.intensity === appliedIntensity || (appliedIntensity === 'moderate' && !w.intensity);
            const matchDesc = appliedDesc === 'All' || w.descriptor === appliedDesc;
            const matchPhen = appliedPhenom === 'All' || 
              w.precipitation === appliedPhenom || w.obscuration === appliedPhenom || w.other === appliedPhenom ||
              ['rain', 'snow', 'rasn', 'snra'].includes(appliedPhenom);
            return matchInt && matchDesc && matchPhen;
          });
        }
        
        if (criteriaMet) {
          buckets[key].criteriaRec++;
        }
      }
    });

    // Build result
    const keys = Object.keys(buckets).sort((a, b) => parseInt(a) - parseInt(b));
    
    let critTotal = 0;
    let metTotal = 0;

    const result = keys.map(keyStr => {
      const mRec = buckets[keyStr].metarRec;
      const cRec = buckets[keyStr].criteriaRec;
      
      const rate = mRec > 0 ? parseFloat((cRec / mRec).toFixed(4)) : 0;
      
      critTotal += cRec;
      metTotal += mRec;

      return {
        label: buckets[keyStr].label,
        Rate: rate,
        criteriaRec: cRec,
        metarRec: mRec
      };
    });

    return { chartData: result, totalRecords: records, totalCriteria: critTotal, totalMetar: metTotal };
  }, [data, appliedIntensity, appliedDesc, appliedPhenom, timeGroup]);

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="intensityPct">Intensity</label>
            <select id="intensityPct" className={intensity === 'All' ? 'select-default' : ''} value={intensity} onChange={e => setIntensity(e.target.value)}>
              {INTENSITIES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="descriptionPct">Description</label>
            <select id="descriptionPct" className={description === 'All' ? 'select-default' : ''} value={description} onChange={e => setDescription(e.target.value)}>
              {DESCRIPTORS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="phenomenaPct">Weather Phenomena</label>
            <select id="phenomenaPct" className={phenomena === 'All' ? 'select-default' : ''} value={phenomena} onChange={e => setPhenomena(e.target.value)}>
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
              onClick={() => exportGraphAsPNG(chartRef, 'PhenomenaPctTab.png')}
            >
              📈 Export Graph
            </button>
            <button 
              className="btn-primary" 
              style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#ffffff', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
              onClick={() => {
                if (!reportInfo) return;
              generateOpsmetPctReport({
                analysis: 'Phenomena',
                airport: reportInfo.airport,
                begin: reportInfo.begin,
                end: reportInfo.end,
                selectedMonths: reportInfo.selectedMonths,
                data,
                extraParams: { INTENSITY: appliedIntensity, DESCRIPTOR: appliedDesc, PHENOMENA: appliedPhenom },
                criteriaFn: (d) => {
                  if (!d.weather || d.weather.length === 0) {
                    if (appliedIntensity === 'All' && appliedDesc === 'All' && appliedPhenom === 'All') return false;
                    return false;
                  }
                  if (appliedPhenom !== 'All') {
                    const rawTokens = (d.raw || '').split(/\s+/);
                    let phenomCode = '';
                    if (appliedPhenom === 'rain') phenomCode = 'RA';
                    else if (appliedPhenom === 'snow') phenomCode = 'SN';
                    else if (appliedPhenom === 'rasn') phenomCode = 'RASN';
                    else if (appliedPhenom === 'snra') phenomCode = 'SNRA';
                    
                    if (phenomCode) {
                      const hasExactPhenom = rawTokens.some(t => {
                        if (t.startsWith('RE')) return false;
                        if (phenomCode === 'RA') return t.includes('RA') && !t.includes('RASN') && !t.includes('SNRA');
                        if (phenomCode === 'SN') return t.includes('SN') && !t.includes('RASN') && !t.includes('SNRA');
                        return t.includes(phenomCode);
                      });
                      if (!hasExactPhenom) return false;
                    }
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
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="tabs-container" style={{ borderBottom: 'none', paddingBottom: 0, margin: 0 }}>
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
            <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Phenomena Query % (Totals For: Records / Criteria / Metar: {totalRecords} / {totalCriteria} / {totalMetar})
            </div>
          </div>
          
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 25, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke="var(--text-muted)" 
                  tick={{ fill: 'var(--text-muted)' }} 
                  label={{ value: timeGroup === 'Hourly' ? 'Hours' : timeGroup === 'Monthly' ? 'Months' : 'Years', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)' }}
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  tick={{ fill: 'var(--text-muted)' }} 
                  tickFormatter={(val) => (val * 100).toFixed(0)}
                  label={{ value: 'Ratio(Criteria Rec./Metar Rec.)', angle: -90, position: 'insideLeft', offset: -15, fill: 'var(--text-muted)', style: { textAnchor: 'middle' } }}
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  formatter={(value, name, props) => [
                    `${(value * 100).toFixed(2)}% (${props.payload.criteriaRec}/${props.payload.metarRec})`, 
                    'Ratio'
                  ]}
                />
                <Legend verticalAlign="top" height={36} iconType="rect" align="center" wrapperStyle={{ marginBottom: '16px' }} />
                
                <Bar dataKey="Rate" fill="#fb7185" name="Ratio" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      </div>
    </div>
  );
}
