"use client";
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';

export default function PressurePctTab({ data }) {
  const [minPressureInput, setMinPressureInput] = useState('');
  const [maxPressureInput, setMaxPressureInput] = useState('');
  
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [timeGroup, setTimeGroup] = useState('Hourly'); // 'Hourly', 'Monthly', 'Yearly'

  const handleRun = () => {
    const minVal = parseFloat(minPressureInput);
    const maxVal = parseFloat(maxPressureInput);
    
    if (!isNaN(minVal) && !isNaN(maxVal)) {
      setAppliedFilters({ minPressure: minVal, maxPressure: maxVal });
    } else {
      setAppliedFilters(null);
    }
  };

  const handleClear = () => {
    setMinPressureInput('');
    setMaxPressureInput('');
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
          const { minPressure, maxPressure } = appliedFilters;
          if (typeof d.pressureHpa === 'number') {
            if (d.pressureHpa >= minPressure && d.pressureHpa <= maxPressure) {
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
  }, [data, appliedFilters, timeGroup]);

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Min. Pressure (hPa)</label>
            <input 
              type="number" 
              value={minPressureInput} 
              onChange={e => setMinPressureInput(e.target.value)}
              placeholder="e.g. 1000"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Max. Pressure (hPa)</label>
            <input 
              type="number" 
              value={maxPressureInput} 
              onChange={e => setMaxPressureInput(e.target.value)}
              placeholder="e.g. 1008"
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
              Pressure % (Totals For: Records / Criteria / Metar: {totalRecords} / {totalCriteria} / {totalMetar})
            </div>
          </div>
          
          {appliedFilters === null ? (
            <div style={{ height: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
              Lütfen sol panelden minimum ve maksimum basınç (hPa) değerlerini girip Run butonuna basın.
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
