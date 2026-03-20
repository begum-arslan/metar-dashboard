"use client";
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';

export default function CloudTypeTab({ data }) {
  const COVERAGES = ['FEW', 'SCT', 'BKN', 'OVC', 'VV'];
  const TYPES = ['CB', 'TCU'];

  const [selectedCoverages, setSelectedCoverages] = useState(['BKN', 'OVC']);
  const [selectedTypes, setSelectedTypes] = useState(['CB']);

  const [appliedCoverages, setAppliedCoverages] = useState(['BKN', 'OVC']);
  const [appliedTypes, setAppliedTypes] = useState(['CB']);

  const [isCoverageOpen, setIsCoverageOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [timeGroup, setTimeGroup] = useState('Hourly'); // Hourly, Monthly, Yearly

  const handleRun = () => {
    setAppliedCoverages([...selectedCoverages]);
    setAppliedTypes([...selectedTypes]);
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

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const targetCoverages = appliedCoverages.length > 0 ? appliedCoverages : COVERAGES;
    const targetTypes = appliedTypes.length > 0 ? appliedTypes : TYPES;

    const filtered = data.filter(d => {
      if (!d.clouds || !Array.isArray(d.clouds)) return false;
      
      // Check if any cloud layer matches BOTH applied coverage AND applied type
      const hasMatchingLayer = d.clouds.some(c => {
        const matchCoverage = targetCoverages.includes(c.code);
        // Sometimes type is null if neither CB nor TCU. We only care if c.type matches.
        const matchType = c.type && targetTypes.includes(c.type);
        return matchCoverage && matchType;
      });

      return hasMatchingLayer;
    });

    // 2. Initialize buckets
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

    // 3. Populate buckets
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
        
        const dayStr = dt.toISOString().split('T')[0];
        if (key !== null && buckets[key]) {
          buckets[key].obs++;
          buckets[key].uniqueDays.add(dayStr);
        }
      } catch (e) {
        // skip invalid
      }
    });

    // 4. Format for Recharts
    let result = [];
    if (timeGroup === 'Hourly' || timeGroup === 'Monthly') {
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
  }, [data, appliedCoverages, appliedTypes, timeGroup]);

  const totalObs = chartData.reduce((acc, curr) => acc + curr.Observations, 0);

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
            <label>Closure Rate (Bulut Kapalılığı)</label>
            <div 
              onClick={() => setIsCoverageOpen(!isCoverageOpen)}
              style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', fontSize: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {selectedCoverages.length === 0 ? (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>Tümü</span>
                ) : (
                  selectedCoverages.map(cov => (
                    <span key={cov} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.85rem' }}>{cov} ✕</span>
                  ))
                )}
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>▼</span>
            </div>
            {isCoverageOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1a1a1a', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {COVERAGES.map(cov => (
                  <label key={cov} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                    <input type="checkbox" checked={selectedCoverages.includes(cov)} onChange={() => toggleCoverage(cov)} style={{ margin: 0 }} />
                    <span>{cov}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 0, position: 'relative' }}>
            <label>Cloud Type (Bulut Tipi)</label>
            <div 
              onClick={() => setIsTypeOpen(!isTypeOpen)}
              style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', fontSize: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {selectedTypes.length === 0 ? (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>Tümü</span>
                ) : (
                  selectedTypes.map(typ => (
                    <span key={typ} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.85rem' }}>{typ} ✕</span>
                  ))
                )}
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>▼</span>
            </div>
            {isTypeOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1a1a1a', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', zIndex: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {TYPES.map(typ => (
                  <label key={typ} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                    <input type="checkbox" checked={selectedTypes.includes(typ)} onChange={() => toggleType(typ)} style={{ margin: 0 }} />
                    <span>{typ}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button className="btn-primary" style={{ width: '100%', marginTop: '8px' }} onClick={handleRun}>Run / Create Report</button>
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
              Cloud Type (Rec. Total: {totalObs})
            </div>
          </div>
          
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
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
                  label={{ value: 'Sum(Observations/Days)', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)' }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Legend verticalAlign="top" height={36} iconType="rect" align="center" wrapperStyle={{ marginBottom: '16px' }} />
                
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
