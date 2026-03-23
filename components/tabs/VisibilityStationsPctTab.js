"use client";
import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';

const MONTHS_OPTIONS = [
  { value: 0, label: 'January' },
  { value: 1, label: 'February' },
  { value: 2, label: 'March' },
  { value: 3, label: 'April' },
  { value: 4, label: 'May' },
  { value: 5, label: 'June' },
  { value: 6, label: 'July' },
  { value: 7, label: 'August' },
  { value: 8, label: 'September' },
  { value: 9, label: 'October' },
  { value: 10, label: 'November' },
  { value: 11, label: 'December' }
];

const COLORS = ['#3b82f6', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export default function VisibilityStationsPctTab() {
  const [stationsInput, setStationsInput] = useState('LTBA, LTFM, LTCG');
  
  const today = new Date();
  const past = new Date();
  past.setFullYear(today.getFullYear() - 1);
  const [startDate, setStartDate] = useState(past.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  
  const [thresholdInput, setThresholdInput] = useState('1000');
  const [appliedThreshold, setAppliedThreshold] = useState(1000);
  
  const [timeGroup, setTimeGroup] = useState('Hourly'); // 'Hourly', 'Monthly', 'Yearly'

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggleMonth = (val) => {
    setSelectedMonths(prev => 
      prev.includes(val) ? prev.filter(m => m !== val) : [...prev, val]
    );
  };

  const handleRun = async () => {
    const val = parseInt(thresholdInput, 10);
    if (!isNaN(val)) setAppliedThreshold(val);
    
    window.dispatchEvent(new CustomEvent('metar-loading', { detail: true }));

    setLoading(true);
    setError(null);
    setData([]);

    try {
      const cleanStations = stationsInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).join(',');
      
      const res = await fetch(`/api/metar?station=${cleanStations}&start=${startDate}&end=${endDate}`);
      if (!res.ok) {
        throw new Error('Failed to fetch data');
      }
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      
      setData(json.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      window.dispatchEvent(new CustomEvent('metar-loading', { detail: false }));
    }
  };

  const handleClear = () => {
    setStationsInput('LTBA, LTFM, LTCG');
    setStartDate(past.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
    setSelectedMonths([]);
    setThresholdInput('1000');
    setAppliedThreshold(1000);
    setData([]);
  };

  const { chartData, tableData, uniqueStations, timeKeys } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], tableData: [], uniqueStations: [], timeKeys: [] };

    // Parse and filter
    const parsed = data.map(d => {
      try {
        const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
        const dt = parseISO(dateStr);
        if (isNaN(dt.getTime())) return null;
        if (selectedMonths.length > 0 && !selectedMonths.includes(dt.getUTCMonth())) return null;
        
        const dayStr = dt.toISOString().split('T')[0];
        return { ...d, _dt: dt, _dayStr: dayStr };
      } catch (e) { return null; }
    }).filter(Boolean);

    const uniqueStations = Array.from(new Set(parsed.map(d => d.station))).sort();
    
    let timeKeys = [];
    if (timeGroup === 'Hourly') {
      timeKeys = Array.from({ length: 24 }, (_, i) => String(i));
    } else if (timeGroup === 'Monthly') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      timeKeys = months;
    }

    const buckets = {}; 
    uniqueStations.forEach(st => { buckets[st] = {}; });

    parsed.forEach(d => {
      const st = d.station;
      
      let key = null;
      if (timeGroup === 'Hourly') key = String(d._dt.getUTCHours());
      else if (timeGroup === 'Monthly') {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        key = months[d._dt.getUTCMonth()];
      } else if (timeGroup === 'Yearly') {
        key = String(d._dt.getUTCFullYear());
        if (!timeKeys.includes(key)) timeKeys.push(key);
      }
      
      if (key !== null) {
        if (!buckets[st][key]) {
             buckets[st][key] = { metar: new Set(), crit: new Set() };
        }
        
        buckets[st][key].metar.add(d._dayStr);
        if (d.visibility !== null && d.visibility <= appliedThreshold) {
          buckets[st][key].crit.add(d._dayStr);
        }
      }
    });
    
    if (timeGroup === 'Yearly') timeKeys.sort();

    // Build Table Data
    const tableData = uniqueStations.map(st => {
      const row = { station: st, totalMetar: 0, totalCrit: 0 };
      timeKeys.forEach(tk => {
        const b = buckets[st][tk];
        if (!b) { row[tk] = 0; return; }
        const m = b.metar.size;
        const c = b.crit.size;
        row[tk] = m > 0 ? parseFloat((c / m).toFixed(4)) : 0;
        row.totalMetar += m;
        row.totalCrit += c;
      });
      return row;
    });

    // Build Chart Data
    const chartData = timeKeys.map(tk => {
      const point = { label: tk };
      uniqueStations.forEach(st => {
        const b = buckets[st][tk];
        if (!b) { point[st] = 0; } else {
          const m = b.metar.size;
          const c = b.crit.size;
          point[st] = m > 0 ? parseFloat((c / m).toFixed(4)) : 0;
        }
      });
      return point;
    });

    return { chartData, tableData, uniqueStations, timeKeys };
  }, [data, appliedThreshold, selectedMonths, timeGroup]);

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="stationsInput">ICAO/IATA (Comma separated)</label>
            <input 
              id="stationsInput" 
              type="text" 
              value={stationsInput} 
              onChange={e => setStationsInput(e.target.value)}
              placeholder="e.g. LTBA, LTFM, LTCG"
            />
          </div>

          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="startDt">Start Date</label>
              <input type="date" id="startDt" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="endDt">End Date</label>
              <input type="date" id="endDt" value={endDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Months</label>
            <div className="month-dropdown-container" style={{ position: 'relative' }}>
              <button 
                type="button"
                className="month-dropdown-toggle bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-white p-2 rounded w-full text-left flex justify-between items-center"
                onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
              >
                <span className="truncate">
                  {selectedMonths.length === 0 ? 'Select Months (All)' : `${selectedMonths.length} month(s) selected`}
                </span>
                <span style={{ fontSize: '0.8rem' }}>▼</span>
              </button>
              
              {isMonthDropdownOpen && (
                <div className="month-dropdown-menu absolute z-50 mt-1 w-full bg-[#1e293b] border border-[rgba(255,255,255,0.1)] rounded shadow-xl max-h-60 overflow-y-auto">
                  {MONTHS_OPTIONS.map(m => (
                    <label key={m.value} className="flex items-center p-2 hover:bg-[rgba(255,255,255,0.05)] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedMonths.includes(m.value)}
                        onChange={() => toggleMonth(m.value)}
                        className="mr-3"
                      />
                      <span className="text-sm text-white">{m.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

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

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleRun} disabled={loading}>
              {loading ? '...' : '▶ Run'}
            </button>
            <button 
              className="btn-primary" 
              style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }} 
              onClick={handleClear}
            >
              ✕ Clear
            </button>
          </div>
          
          {error && <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</div>}
        </div>
        
        {/* Main Content Area */}
        <div className="md:col-span-3" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="glass-container" style={{ padding: '24px' }}>
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
                Visibility Stations %
              </div>
            </div>
            
            {loading ? (
               <div style={{ height: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                 Fetching reports...
               </div>
            ) : chartData.length === 0 ? (
               <div style={{ height: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
                 Run a query to see the comparison.
               </div>
            ) : (
              <div style={{ height: '350px', width: '100%' }}>
                <ResponsiveContainer>
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 25, bottom: 20 }}>
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
                    <Legend verticalAlign="top" height={36} iconType="circle" align="center" wrapperStyle={{ marginBottom: '16px' }} />
                    
                    {uniqueStations.map((st, i) => (
                      <Line 
                        key={st}
                        type="monotone" 
                        dataKey={st} 
                        name={st}
                        stroke={COLORS[i % COLORS.length]} 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: 'var(--secondary)', strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Raw Data Table Matrix (Excel Style) */}
          {tableData.length > 0 && !loading && (
            <div className="glass-container" style={{ padding: '24px', overflowX: 'auto' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 600 }}>Station Ratio Query Description</h3>
              <table style={{ width: '100%', textAlign: 'center', borderCollapse: 'collapse', fontSize: '0.85rem', color: '#e2e8f0' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <th style={{ padding: '8px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>ICAO</th>
                    {timeKeys.map(tk => (
                      <th key={tk} style={{ padding: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>{tk}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map(row => (
                    <tr key={row.station} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 600, textAlign: 'left' }}>{row.station}</td>
                      {timeKeys.map(tk => (
                        <td key={tk} style={{ padding: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                          {row[tk] > 0 ? row[tk] : '0'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
