"use client";
import React, { useState, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';
import { generateOpsmetReport } from '@/utils/excelExport';
import { exportGraphAsPNG } from '@/utils/exportGraph';

export default function PressureWithoutValueTab({ data, reportInfo }) {
  const chartRef = useRef(null);
  const [percentileInput, setPercentileInput] = useState(''); // 100 means all data
  const [appliedPercentile, setAppliedPercentile] = useState(100);

  const [timeGroup, setTimeGroup] = useState('Hourly'); // Hourly, Monthly, Yearly

  
  const handleClear = () => {
    setPercentileInput('');
    setAppliedPercentile(100);
    setTimeGroup('Hourly');
  };

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
              <option value="100">100% (All)</option>
              <option value="90">%90</option>
              <option value="75">%75</option>
              <option value="50">%50</option>
            </select>
            <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
              Outliers outside the selected percentile are excluded from calculations.
            </small>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleRun}>▶ Run</button>
            <button className="btn-primary" style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }} onClick={handleClear}>✕ Clear</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button 
              className="btn-primary" 
              style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', color: '#ffffff', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
              onClick={() => exportGraphAsPNG(chartRef, 'PressureWithoutValueTab.png')}
            >
              📈 Export Graph
            </button>
            <button 
              className="btn-primary" 
              style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#ffffff', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
              onClick={() => {
                if (!reportInfo) return;
              generateOpsmetReport({
                analysis: 'Pressure (Without Value)',
                airport: reportInfo.airport,
                begin: reportInfo.begin,
                end: reportInfo.end,
                selectedMonths: reportInfo.selectedMonths,
                data,
                extraParams: { PERCENTILE: appliedPercentile },
                filterFn: (d) => typeof d.pressureHpa === 'number',
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
                
                {/* Max: Pink, Avg: Amber, Min: Blue */}
                <Bar dataKey="Max" fill="#fb7185" name="Max" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Avg" fill="#fbbf24" name="Avg" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Min" fill="#60a5fa" name="Min" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      </div>
    </div>
  );
}
