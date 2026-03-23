"use client";
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';

export default function VisibilityPctTab({ data }) {
  const [thresholdInput, setThresholdInput] = useState('1000');
  const [appliedThreshold, setAppliedThreshold] = useState(1000);
  const [timeGroup, setTimeGroup] = useState('Hourly'); // 'Hourly', 'Monthly', 'Yearly'

  const handleRun = () => {
    const val = parseInt(thresholdInput, 10);
    if (!isNaN(val)) {
      setAppliedThreshold(val);
    }
  };

  const handleClear = () => {
    setThresholdInput('1000');
    setAppliedThreshold(1000);
  };

  const { chartData, totalRecords, totalCriteria, totalMetar } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], totalRecords: 0, totalCriteria: 0, totalMetar: 0 };

    // Parse all records with valid dates
    const parsed = data.map(d => {
      try {
        const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
        const dt = parseISO(dateStr);
        if (isNaN(dt.getTime())) return null;
        const dayStr = dt.toISOString().split('T')[0];
        return { ...d, _dt: dt, _dayStr: dayStr };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    const records = parsed.length;

    // Initialize buckets
    let metarBuckets = {}; // total METAR/SPECI unique days per bucket
    let criteriaBuckets = {}; // criteria-matching unique days per bucket

    if (timeGroup === 'Hourly') {
      for (let i = 0; i < 24; i++) {
        metarBuckets[i] = { label: String(i), uniqueDays: new Set() };
        criteriaBuckets[i] = { label: String(i), uniqueDays: new Set() };
      }
    } else if (timeGroup === 'Monthly') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      for (let i = 0; i < 12; i++) {
        metarBuckets[i] = { label: months[i], uniqueDays: new Set() };
        criteriaBuckets[i] = { label: months[i], uniqueDays: new Set() };
      }
    }
    // Yearly: created dynamically

    // Pass 1: populate METAR buckets (ALL data) and criteria buckets (filtered)
    parsed.forEach(d => {
      let key = null;
      if (timeGroup === 'Hourly') {
        key = d._dt.getUTCHours();
      } else if (timeGroup === 'Monthly') {
        key = d._dt.getUTCMonth();
      } else if (timeGroup === 'Yearly') {
        key = d._dt.getUTCFullYear();
        if (!metarBuckets[key]) {
          metarBuckets[key] = { label: String(key), uniqueDays: new Set() };
          criteriaBuckets[key] = { label: String(key), uniqueDays: new Set() };
        }
      }

      if (key !== null) {
        // Every METAR record counts towards total METAR days
        metarBuckets[key].uniqueDays.add(d._dayStr);

        // Criteria: visibility <= threshold
        if (d.visibility !== null && d.visibility <= appliedThreshold) {
          criteriaBuckets[key].uniqueDays.add(d._dayStr);
        }
      }
    });

    // Build result
    const keys = Object.keys(metarBuckets).sort((a, b) => parseInt(a) - parseInt(b));
    
    let critTotal = 0;
    let metTotal = 0;

    const result = keys.map(keyStr => {
      const metarDays = metarBuckets[keyStr].uniqueDays.size;
      const criteriaDays = criteriaBuckets[keyStr].uniqueDays.size;
      const rate = metarDays > 0 ? parseFloat((criteriaDays / metarDays).toFixed(4)) : 0;
      
      critTotal += criteriaDays;
      metTotal += metarDays;

      return {
        label: metarBuckets[keyStr].label,
        Rate: rate
      };
    });

    return { chartData: result, totalRecords: records, totalCriteria: critTotal, totalMetar: metTotal };
  }, [data, appliedThreshold, timeGroup]);

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="visPctThreshold">Visibility (m)</label>
            <input 
              id="visPctThreshold" 
              type="number" 
              value={thresholdInput} 
              onChange={e => setThresholdInput(e.target.value)}
              placeholder="e.g. 1000"
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
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
            <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Visibility % (Totals For: Records / Criteria / Metar: {totalRecords} / {totalCriteria} / {totalMetar})
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
                  label={{ value: 'Ratio(Criteria Day/Metar Day)', angle: -90, position: 'insideLeft', offset: -15, fill: 'var(--text-muted)', style: { textAnchor: 'middle' } }}
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  formatter={(value) => [(value * 100).toFixed(2) + '%', 'Rate']}
                />
                <Legend verticalAlign="top" height={36} iconType="rect" align="center" wrapperStyle={{ marginBottom: '16px' }} />
                
                <Bar 
                  dataKey="Rate" 
                  fill="rgba(251, 113, 133, 0.25)" 
                  stroke="#fb7185" 
                  strokeWidth={1} 
                  name="Rate" 
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
