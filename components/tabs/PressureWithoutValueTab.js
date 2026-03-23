"use client";
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';

export default function PressureWithoutValueTab({ data }) {
  const [percentileInput, setPercentileInput] = useState('100'); // 100 means all data
  const [appliedPercentile, setAppliedPercentile] = useState(100);

  const [timeGroup, setTimeGroup] = useState('Hourly'); // Hourly, Monthly, Yearly

  const handleRun = () => {
    setAppliedPercentile(parseInt(percentileInput, 10));
  };

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // 1. Initialize buckets
    let buckets = {};
    if (timeGroup === 'Hourly') {
      for (let i = 0; i < 24; i++) {
        buckets[i] = { label: String(i), vals: [] };
      }
    } else if (timeGroup === 'Monthly') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      for (let i = 0; i < 12; i++) {
        buckets[i] = { label: months[i], vals: [] };
      }
    }

    // 2. Populate buckets with all valid pressures
    data.forEach(d => {
      const hpa = d.pressureHpa;
      if (typeof hpa !== 'number') return;
      
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
            buckets[key] = { label: String(key), vals: [] };
          }
        }
        
        if (key !== null && buckets[key]) {
          buckets[key].vals.push(hpa);
        }
      } catch (e) {
        // skip invalid
      }
    });

    // 3. Process buckets to calculate Min, Avg, Max based on the Percentile filter
    let result = [];
    const keys = Object.keys(buckets).sort((a,b) => parseInt(a) - parseInt(b));
    
    keys.forEach(k => {
      const b = buckets[k];
      if (b.vals.length === 0) {
        result.push({
          label: b.label,
          Max: null,
          Avg: null,
          Min: null
        });
        return;
      }
      
      // Sort ascending
      let sorted = [...b.vals].sort((x, y) => x - y);
      
      if (appliedPercentile < 100) {
        const dropPercent = (100 - appliedPercentile) / 2 / 100;
        const dropCount = Math.floor(sorted.length * dropPercent);
        if (dropCount > 0 && sorted.length > dropCount * 2) {
          sorted = sorted.slice(dropCount, sorted.length - dropCount);
        }
      }

      const minV = sorted[0];
      const maxV = sorted[sorted.length - 1];
      const sum = sorted.reduce((a, b) => a + b, 0);
      const avgV = parseFloat((sum / sorted.length).toFixed(1));

      result.push({
        label: b.label,
        Max: maxV,
        Avg: avgV,
        Min: minV
      });
    });

    return result;
  }, [data, appliedPercentile, timeGroup]);

  // Aggregate totals
  const totalObs = (data || []).filter(d => typeof d.pressureHpa === 'number').length;

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Percentile</label>
            <select 
              value={percentileInput} 
              onChange={e => setPercentileInput(e.target.value)}
              className="glass-input"
            >
              <option value="100">%100 (Tümü)</option>
              <option value="90">%90</option>
              <option value="75">%75</option>
              <option value="50">%50</option>
            </select>
            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Seçilen yüzde dışındaki uç değerler hesaplamaya katılmaz.
            </small>
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
              Pressure Without Value (Rec. Total: {totalObs})
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
                  domain={['auto', 'auto']}
                  label={{ value: 'Pressure (hPa)', angle: -90, position: 'insideLeft', offset: -15, fill: 'var(--text-muted)', style: { textAnchor: 'middle' } }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Legend verticalAlign="top" height={36} iconType="rect" align="center" wrapperStyle={{ marginBottom: '16px' }} />
                
                {/* Max: Pink, Avg: Yellow, Min: Blue */}
                <Bar 
                  dataKey="Max" 
                  fill="rgba(251, 113, 133, 0.2)" 
                  stroke="#fb7185" 
                  strokeWidth={1} 
                  name="Max" 
                  radius={[2, 2, 0, 0]} 
                />
                <Bar 
                  dataKey="Avg" 
                  fill="rgba(250, 204, 21, 0.2)" 
                  stroke="#facc15" 
                  strokeWidth={1} 
                  name="Avg" 
                  radius={[2, 2, 0, 0]} 
                />
                <Bar 
                  dataKey="Min" 
                  fill="rgba(96, 165, 250, 0.2)" 
                  stroke="#60a5fa" 
                  strokeWidth={1} 
                  name="Min" 
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
