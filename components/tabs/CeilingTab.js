"use client";
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';

export default function CeilingTab({ data }) {
  const [thresholdInput, setThresholdInput] = useState('1000');
  const [appliedThreshold, setAppliedThreshold] = useState(1000);
  
  const COVERAGES = ['FEW', 'SCT', 'BKN', 'OVC', 'VV'];
  const [selectedCoverages, setSelectedCoverages] = useState([]); // Empty implies all
  const [appliedCoverages, setAppliedCoverages] = useState([]);
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [timeGroup, setTimeGroup] = useState('Hourly'); // 'Hourly', 'Monthly', 'Yearly'

  const handleRun = () => {
    const val = parseInt(thresholdInput, 10);
    if (!isNaN(val)) {
      setAppliedThreshold(val);
    }
    setAppliedCoverages([...selectedCoverages]);
  };

  const toggleCoverage = (cov) => {
    setSelectedCoverages(prev => 
      prev.includes(cov) ? prev.filter(c => c !== cov) : [...prev, cov]
    );
  };

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // 1. Process data for ceiling (based on applied coverages)
    const targetCoverages = appliedCoverages.length > 0 ? appliedCoverages : COVERAGES;

    const processedData = data.map(d => {
      let ceiling = null;
      if (d.clouds && Array.isArray(d.clouds)) {
        const ceilingLayers = d.clouds.filter(c => targetCoverages.includes(c.code));
        if (ceilingLayers.length > 0) {
          ceiling = Math.min(...ceilingLayers.map(c => c.altitude));
        }
      }
      return { ...d, ceiling };
    });

    // 2. Filter data based on ceiling threshold <= appliedThreshold
    const filtered = processedData.filter(d => d.ceiling !== null && d.ceiling <= appliedThreshold);
    
    // 3. Initialize buckets based on timeGroup
    let buckets = {};
    
    if (timeGroup === 'Hourly') {
      for (let i = 0; i < 24; i++) {
        buckets[i] = { label: String(i), obs: 0, uniqueDays: new Set() };
      }
    } else if (timeGroup === 'Monthly') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      for (let i = 0; i < 12; i++) {
        buckets[i] = { label: months[i], obs: 0, uniqueDays: new Set() };
      }
    }
    // For Yearly, buckets created dynamically.
    
    // 4. Populate buckets
    filtered.forEach(d => {
      try {
        const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
        const dt = parseISO(dateStr);
        if (isNaN(dt.getTime())) return;
        
        let key = null;
        if (timeGroup === 'Hourly') {
          key = dt.getUTCHours();
        } else if (timeGroup === 'Monthly') {
          key = dt.getUTCMonth();
        } else if (timeGroup === 'Yearly') {
          key = dt.getUTCFullYear();
          if (!buckets[key]) {
            buckets[key] = { label: String(key), obs: 0, uniqueDays: new Set() };
          }
        }
        
        const dayStr = dt.toISOString().split('T')[0]; // "YYYY-MM-DD"
        if (key !== null && buckets[key]) {
          buckets[key].obs++;
          buckets[key].uniqueDays.add(dayStr);
        }
      } catch (e) {
        // skip invalid rows
      }
    });

    // 5. Format into array to pass to Recharts
    let result = [];
    if (timeGroup === 'Hourly' || timeGroup === 'Monthly') {
      // sort numerically by integer key
      result = Object.keys(buckets).sort((a,b) => parseInt(a) - parseInt(b)).map(k => ({
        label: buckets[k].label,
        Observations: buckets[k].obs,
        Days: buckets[k].uniqueDays.size
      }));
    } else if (timeGroup === 'Yearly') {
      result = Object.keys(buckets).sort((a,b) => parseInt(a) - parseInt(b)).map(k => ({
        label: buckets[k].label,
        Observations: buckets[k].obs,
        Days: buckets[k].uniqueDays.size
      }));
    }
    return result;
  }, [data, appliedThreshold, appliedCoverages, timeGroup]);

  // Aggregate totals
  const totalObs = chartData.reduce((acc, curr) => acc + curr.Observations, 0);

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="ceilThreshold">Ceiling (ft) ≤ Threshold</label>
            <input 
              id="ceilThreshold" 
              type="number" 
              value={thresholdInput} 
              onChange={e => setThresholdInput(e.target.value)}
              placeholder="e.g. 1000"
            />
            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Minimum altitude of selected cloud layer.
            </small>
          </div>

          <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
            <label>Closure Rate (Bulut Kapalılığı)</label>
            <div 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--card-border)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#ffffff',
                fontSize: '1rem',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
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
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 25,
                right: 0,
                marginTop: '4px',
                background: '#1a1a1a',
                border: '1px solid var(--card-border)',
                borderRadius: '8px',
                padding: '8px',
                zIndex: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
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

          <button className="btn-primary" style={{ width: '100%' }} onClick={handleRun}>Run / Create Report</button>
        </div>
        
        {/* Chart Area */}
        <div className="glass-container md:col-span-3" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          
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
              Ceiling Matches (Rec. Total: {totalObs})
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
                  label={{ value: 'Sum(Observations/Days)', angle: -90, position: 'insideLeft', offset: -15, fill: 'var(--text-muted)', style: { textAnchor: 'middle' } }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Legend verticalAlign="top" height={36} iconType="rect" align="center" wrapperStyle={{ marginBottom: '16px' }} />
                
                {/* Match mockup colors exactly: light fill with solid border */}
                <Bar 
                  dataKey="Observations" 
                  fill="rgba(251, 113, 133, 0.2)" 
                  stroke="#fb7185" 
                  strokeWidth={1} 
                  name="Observations" 
                  radius={[2, 2, 0, 0]} 
                />
                <Bar 
                  dataKey="Days" 
                  fill="rgba(96, 165, 250, 0.2)" 
                  stroke="#60a5fa" 
                  strokeWidth={1} 
                  name="Days" 
                  radius={[2, 2, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      </div>
    </div>
  );
}
