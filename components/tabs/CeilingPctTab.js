"use client";
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';

export default function CeilingPctTab({ data }) {
  const [thresholdInput, setThresholdInput] = useState('');
  const [appliedThreshold, setAppliedThreshold] = useState(null);
  
  const COVERAGES = ['FEW', 'SCT', 'BKN', 'OVC', 'VV'];
  const [selectedCoverages, setSelectedCoverages] = useState([]); // Empty implies all
  const [appliedCoverages, setAppliedCoverages] = useState([]);
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [timeGroup, setTimeGroup] = useState('Hourly'); // 'Hourly', 'Monthly', 'Yearly'

  const handleRun = () => {
    const val = parseInt(thresholdInput, 10);
    if (!isNaN(val)) {
      setAppliedThreshold(val);
    } else {
      setAppliedThreshold(null);
    }
    setAppliedCoverages([...selectedCoverages]);
  };

  const handleClear = () => {
    setThresholdInput('');
    setAppliedThreshold(null);
    setSelectedCoverages([]);
    setAppliedCoverages([]);
  };

  const toggleCoverage = (cov) => {
    setSelectedCoverages(prev => 
      prev.includes(cov) ? prev.filter(c => c !== cov) : [...prev, cov]
    );
  };

  const { chartData, totalRecords, totalCriteria, totalMetar } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], totalRecords: 0, totalCriteria: 0, totalMetar: 0 };
    
    // Parse Dates
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
    const targetCoverages = appliedCoverages.length > 0 ? appliedCoverages : COVERAGES;

    const processedData = parsed.map(d => {
      let ceiling = null;
      if (d.clouds && Array.isArray(d.clouds)) {
        const ceilingLayers = d.clouds.filter(c => targetCoverages.includes(c.code));
        if (ceilingLayers.length > 0) {
          ceiling = Math.min(...ceilingLayers.map(c => c.altitude));
        }
      }
      return { ...d, _ceiling: ceiling };
    });

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

    processedData.forEach(d => {
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
        // Criteria: if appliedThreshold is not set, we don't count any valid criteria? 
        // Or if it's set, check d._ceiling <= appliedThreshold
        if (appliedThreshold !== null && d._ceiling !== null && d._ceiling <= appliedThreshold) {
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
  }, [data, appliedThreshold, appliedCoverages, timeGroup]);

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="ceilPctThreshold">Ceiling (ft) ≤ Threshold</label>
            <input 
              id="ceilPctThreshold" 
              type="number" 
              value={thresholdInput} 
              onChange={e => setThresholdInput(e.target.value)}
              placeholder="e.g. 600"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
            <label>Closure Rate (Bulut Kapalılığı)</label>
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', fontSize: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {selectedCoverages.length === 0 ? (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>Tümü (All)</span>
                ) : (
                  selectedCoverages.map(cov => (
                    <span key={cov} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.85rem' }}>
                      {cov} ✕
                    </span>
                  ))
                )}
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>▼</span>
            </div>
            
            {isDropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1a1a1a', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {COVERAGES.map(cov => (
                  <label key={cov} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                    <input 
                      type="checkbox" 
                      checked={selectedCoverages.includes(cov)}
                      onChange={() => toggleCoverage(cov)}
                      style={{ margin: 0 }}
                    />
                    <span>{cov}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleRun}>
              ▶ Run
            </button>
            <button 
              className="btn-primary" 
              style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }} 
              onClick={handleClear}
            >
              ✕ Clear
            </button>
          </div>
        </div>
        
        {/* Chart Area */}
        <div className="glass-container md:col-span-3" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          
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
              Ceiling % (Totals For: Records / Criteria / Metar: {totalRecords} / {totalCriteria} / {totalMetar})
            </div>
          </div>
          
          {appliedThreshold === null ? (
            <div style={{ height: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
              Lütfen sol panelden Tavan Yüksekliği (Ceiling) girip Run butonuna basın.
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
                  
                  <Bar 
                    dataKey="Rate" 
                    fill="rgba(251, 113, 133, 0.25)" 
                    stroke="#fb7185" 
                    strokeWidth={1} 
                    name="Ratio" 
                    radius={[2, 2, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
