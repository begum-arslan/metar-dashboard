"use client";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';
import { generateOpsmetPctReport } from '@/utils/excelExport';
import { exportGraphAsPNG } from '@/utils/exportGraph';

const COVERAGES = ['FEW', 'SCT', 'BKN', 'OVC', 'VV'];
const TYPES = ['CB', 'TCU'];

export default function CloudTypePctTab({ data, reportInfo }) {
  const chartRef = useRef(null);
  const coverageRef = useRef(null);
  const typeRef = useRef(null);

  const [selectedCoverages, setSelectedCoverages] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState([]);

  const [appliedCoverages, setAppliedCoverages] = useState([]);
  const [appliedTypes, setAppliedTypes] = useState([]);

  const [isCoverageOpen, setIsCoverageOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  
  const [timeGroup, setTimeGroup] = useState('Hourly'); // 'Hourly', 'Monthly', 'Yearly'

  useEffect(() => {
    function handleClickOutside(event) {
      if (coverageRef.current && !coverageRef.current.contains(event.target)) {
        setIsCoverageOpen(false);
      }
      if (typeRef.current && !typeRef.current.contains(event.target)) {
        setIsTypeOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleRun = () => {
    setAppliedCoverages([...selectedCoverages]);
    setAppliedTypes([...selectedTypes]);
  };

  const handleClear = () => {
    setSelectedCoverages([]);
    setSelectedTypes([]);
    setAppliedCoverages(null);
    setAppliedTypes(null);
  };

  const toggleCoverage = (cov) => {
    setSelectedCoverages(prev => 
      prev.includes(cov) ? prev.filter(c => c !== cov) : [...prev, cov]
    );
  };

  const toggleType = (type) => {
    setSelectedTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const { chartData, totalRecords, totalCriteria, totalMetar } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], totalRecords: 0, totalCriteria: 0, totalMetar: 0 };
    
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

        if (appliedCoverages !== null && appliedTypes !== null) {
          const targetCoverages = appliedCoverages.length > 0 ? appliedCoverages : COVERAGES;
          const targetTypes = appliedTypes.length > 0 ? appliedTypes : TYPES;

          if (d.clouds && Array.isArray(d.clouds)) {
            const hasMatchingLayer = d.clouds.some(c => {
              const matchCoverage = targetCoverages.includes(c.code);
              const matchType = c.type && targetTypes.includes(c.type);
              return matchCoverage && matchType;
            });

            if (hasMatchingLayer) {
              buckets[key].criteriaRec++;
            }
          }
        }
      }
    });

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
  }, [data, appliedCoverages, appliedTypes, timeGroup]);

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="form-group" ref={coverageRef} style={{ marginBottom: 0, position: 'relative' }}>
            <label>Cloud Coverage</label>
            <div 
              onClick={() => setIsCoverageOpen(!isCoverageOpen)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {selectedCoverages.length === 0 ? (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>e.g. BKN, OVC</span>
                ) : (
                  selectedCoverages.map(cov => (
                    <span 
                      key={cov} 
                      style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCoverage(cov);
                      }}
                    >
                      {cov} ✕
                    </span>
                  ))
                )}
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>▼</span>
            </div>
            {isCoverageOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1a1a1a', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {COVERAGES.map(cov => (
                  <label key={cov} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.8rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 'normal', color: '#e2e8f0' }}>
                    <input type="checkbox" checked={selectedCoverages.includes(cov)} onChange={() => toggleCoverage(cov)} style={{ margin: 0 }} />
                    <span>{cov}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="form-group" ref={typeRef} style={{ marginBottom: 0, position: 'relative' }}>
            <label>Cloud Type</label>
            <div 
              onClick={() => setIsTypeOpen(!isTypeOpen)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {selectedTypes.length === 0 ? (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>e.g. CB</span>
                ) : (
                  selectedTypes.map(typ => (
                    <span 
                      key={typ} 
                      style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleType(typ);
                      }}
                    >
                      {typ} ✕
                    </span>
                  ))
                )}
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>▼</span>
            </div>
            {isTypeOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1a1a1a', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', zIndex: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {TYPES.map(typ => (
                  <label key={typ} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.8rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 'normal', color: '#e2e8f0' }}>
                    <input type="checkbox" checked={selectedTypes.includes(typ)} onChange={() => toggleType(typ)} style={{ margin: 0 }} />
                    <span>{typ}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn-primary" style={{ flex: 1, minWidth: 0 }} onClick={handleRun}>▶ Run</button>
            <button className="btn-primary" style={{ flex: 1, minWidth: 0, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }} onClick={handleClear}>✕ Clear</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button 
              className="btn-primary" 
              style={{ flex: 1, minWidth: 0, padding: '6px 12px', fontSize: '13px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', color: '#ffffff', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
              onClick={() => exportGraphAsPNG(chartRef, 'CloudTypePctTab.png')}
            >
              📈 Export Graph
            </button>
            <button 
              className="btn-primary" 
              style={{ flex: 1, minWidth: 0, padding: '6px 12px', fontSize: '13px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#ffffff', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
              onClick={() => {
                if (!reportInfo) return;
                const targetCovs = appliedCoverages.length > 0 ? appliedCoverages : COVERAGES;
                const targetTps = appliedTypes.length > 0 ? appliedTypes : TYPES;
                generateOpsmetPctReport({
                  analysis: 'Cloud Type',
                  airport: reportInfo.airport,
                  begin: reportInfo.begin,
                  end: reportInfo.end,
                  selectedMonths: reportInfo.selectedMonths,
                  data,
                  extraParams: { COVERAGE: targetCovs.join(','), TYPE: targetTps.join(',') },
                  criteriaFn: (d) => {
                    if (!d.clouds || !Array.isArray(d.clouds)) return false;
                    return d.clouds.some(c => targetCovs.includes(c.code) && c.type && targetTps.includes(c.type));
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
              Cloud Type % (Totals For: Records / Criteria / Metar: {totalRecords} / {totalCriteria} / {totalMetar})
            </div>
          </div>
          
          {appliedCoverages === null ? (
            <div style={{ height: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
              Please set Cloud Type criteria from the left panel and press Run.
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
