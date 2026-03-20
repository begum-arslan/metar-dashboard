"use client";
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';

export default function PressureTab({ data }) {
  const [minPressureInput, setMinPressureInput] = useState('1030');
  const [maxPressureInput, setMaxPressureInput] = useState('1048');

  const [appliedFilters, setAppliedFilters] = useState({
    minPressure: 1030,
    maxPressure: 1048
  });

  const [timeGroup, setTimeGroup] = useState('Hourly'); // Hourly, Monthly, Yearly

  const handleRun = () => {
    setAppliedFilters({
      minPressure: parseInt(minPressureInput, 10) || 0,
      maxPressure: parseInt(maxPressureInput, 10) || 9999
    });
  };

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const { minPressure, maxPressure } = appliedFilters;

    const filtered = data.filter(d => {
      // Use the newly added pressureHpa property
      const hpa = d.pressureHpa;
      if (typeof hpa !== 'number') return false;
      return hpa >= minPressure && hpa <= maxPressure;
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
  }, [data, appliedFilters, timeGroup]);

  const totalObs = chartData.reduce((acc, curr) => acc + curr.Observations, 0);

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Min. Pressure (hPa)</label>
              <input 
                type="number" 
                value={minPressureInput} 
                onChange={e => setMinPressureInput(e.target.value)}
                placeholder="1030"
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Max. Pressure (hPa)</label>
              <input 
                type="number" 
                value={maxPressureInput} 
                onChange={e => setMaxPressureInput(e.target.value)}
                placeholder="1048"
              />
            </div>
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
              Pressure (Rec. Total: {totalObs})
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
                  label={{ value: 'Pressure (hPa)', angle: -90, position: 'insideLeft', fill: 'var(--text-muted)' }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Legend verticalAlign="top" height={36} iconType="rect" align="center" wrapperStyle={{ marginBottom: '16px' }} />
                
                <Bar 
                  dataKey="Days" 
                  fill="rgba(96, 165, 250, 0.2)" 
                  stroke="#60a5fa" 
                  strokeWidth={1} 
                  name="Days" 
                  radius={[2, 2, 0, 0]} 
                />
                <Bar 
                  dataKey="Observations" 
                  fill="rgba(251, 113, 133, 0.2)" 
                  stroke="#fb7185" 
                  strokeWidth={1} 
                  name="Observations" 
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
