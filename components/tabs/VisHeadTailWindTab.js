"use client";
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';

export default function VisHeadTailWindTab({ data }) {
  // Visibility Filter
  const [visThresholdInput, setVisThresholdInput] = useState('1000');
  
  // Wind Filters
  const [runwayInput, setRunwayInput] = useState('350');
  const [componentInput, setComponentInput] = useState('Head'); // Head, Tail, Cross
  const [windTypeInput, setWindTypeInput] = useState('Wind'); // Wind, Gust
  const [minSpeedInput, setMinSpeedInput] = useState('0');
  const [maxSpeedInput, setMaxSpeedInput] = useState('60');

  const [appliedFilters, setAppliedFilters] = useState({
    visThreshold: 1000,
    runway: 350,
    component: 'Head',
    windType: 'Wind',
    minSpeed: 0,
    maxSpeed: 60
  });

  const [timeGroup, setTimeGroup] = useState('Hourly'); // Hourly, Monthly, Yearly

  const handleRun = () => {
    setAppliedFilters({
      visThreshold: parseInt(visThresholdInput, 10) || 0,
      runway: parseInt(runwayInput, 10) || 0,
      component: componentInput,
      windType: windTypeInput,
      minSpeed: parseInt(minSpeedInput, 10) || 0,
      maxSpeed: parseInt(maxSpeedInput, 10) || 999
    });
  };

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const { visThreshold, runway, component, windType, minSpeed, maxSpeed } = appliedFilters;
    
    // 1. Filter data based on both Visibility AND Wind calculations
    const filtered = data.filter(d => {
      // Visibility Check
      if (d.visibility === null || d.visibility > visThreshold) return false;

      // Wind Check
      if (typeof d.windDirection !== 'number') return false;
      const speed = windType === 'Gust' ? (d.windGust || 0) : (d.windSpeed || 0);
      
      const angleDiffRad = (d.windDirection - runway) * Math.PI / 180;
      const headwind = speed * Math.cos(angleDiffRad);
      const crosswind = Math.abs(speed * Math.sin(angleDiffRad));
      const tailwind = -headwind;

      let valueToCheck = 0;
      if (component === 'Head') {
        valueToCheck = headwind;
      } else if (component === 'Tail') {
        valueToCheck = tailwind;
      } else if (component === 'Cross') {
        valueToCheck = crosswind;
      }
      
      // Allow valueToCheck >= 0 if minSpeed is 0
      return valueToCheck >= 0 && valueToCheck >= minSpeed && valueToCheck <= maxSpeed;
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
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Visibility</label>
            <input 
              type="number" 
              value={visThresholdInput} 
              onChange={e => setVisThresholdInput(e.target.value)}
              placeholder="e.g. 1000"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Runway</label>
            <input 
              type="number" 
              value={runwayInput} 
              onChange={e => setRunwayInput(e.target.value)}
              placeholder="e.g. 350"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Wind Component</label>
            <select value={componentInput} onChange={e => setComponentInput(e.target.value)}>
              <option value="Head">Head</option>
              <option value="Tail">Tail</option>
              <option value="Cross">Cross</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Wind Type</label>
            <select value={windTypeInput} onChange={e => setWindTypeInput(e.target.value)}>
              <option value="Wind">Wind</option>
              <option value="Gust">Gust</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Wind Speed First</label>
            <input 
              type="number" 
              value={minSpeedInput} 
              onChange={e => setMinSpeedInput(e.target.value)}
              placeholder="Min Speed"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Wind Speed Second</label>
            <input 
              type="number" 
              value={maxSpeedInput} 
              onChange={e => setMaxSpeedInput(e.target.value)}
              placeholder="Max Speed"
            />
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
              Visibility Head-Tail Wind (Rec. Total: {totalObs})
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
