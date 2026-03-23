"use client";
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';

export default function VisHeadTailPctTab({ data }) {
  const [visibilityInput, setVisibilityInput] = useState('1000');
  const [runwayInput, setRunwayInput] = useState('350');
  const [componentInput, setComponentInput] = useState('Tail'); // Head, Tail, Cross
  const [windTypeInput, setWindTypeInput] = useState('Wind'); // Wind, Gust
  const [minSpeedInput, setMinSpeedInput] = useState('0');
  const [maxSpeedInput, setMaxSpeedInput] = useState('40');
  
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [timeGroup, setTimeGroup] = useState('Hourly'); // 'Hourly', 'Monthly', 'Yearly'

  const handleRun = () => {
    setAppliedFilters({
      visibility: parseInt(visibilityInput, 10) || 0,
      runway: parseInt(runwayInput, 10) || 0,
      component: componentInput,
      windType: windTypeInput,
      minSpeed: parseFloat(minSpeedInput) || 0,
      maxSpeed: parseFloat(maxSpeedInput) || 999
    });
  };

  const handleClear = () => {
    setVisibilityInput('1000');
    setRunwayInput('350');
    setComponentInput('Tail');
    setWindTypeInput('Wind');
    setMinSpeedInput('0');
    setMaxSpeedInput('40');
    setAppliedFilters(null);
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

        if (appliedFilters !== null) {
          const { visibility, runway, component, windType, minSpeed, maxSpeed } = appliedFilters;
          
          let matchesVisibility = false;
          if (d.visibility !== null && d.visibility !== undefined && d.visibility <= visibility) {
            matchesVisibility = true;
          }

          if (matchesVisibility && typeof d.windDirection === 'number') {
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
            
            // Criteria bounds
            if (valueToCheck >= minSpeed && valueToCheck <= maxSpeed) {
                // Noted that screenshot shows 0 parameter, so including bounds from 0 upwards instead of strictly > 0.
                if(valueToCheck >= 0){
                    buckets[key].criteriaRec++;
                }
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
  }, [data, appliedFilters, timeGroup]);

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Visibility (Metre) ≤ Threshold</label>
            <input 
              type="number" 
              value={visibilityInput} 
              onChange={e => setVisibilityInput(e.target.value)}
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
              placeholder="e.g. 0"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Wind Speed Second</label>
            <input 
              type="number" 
              value={maxSpeedInput} 
              onChange={e => setMaxSpeedInput(e.target.value)}
              placeholder="e.g. 40"
            />
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
              Visibility Head Tail Wind % (Totals For: Records / Criteria / Metar: {totalRecords} / {totalCriteria} / {totalMetar})
            </div>
          </div>
          
          {appliedFilters === null ? (
            <div style={{ height: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
              Lütfen sol panelden Visibility ve Wind kriterlerini belirleyip Run butonuna basın.
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
