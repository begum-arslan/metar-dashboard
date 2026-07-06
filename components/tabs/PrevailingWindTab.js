"use client";
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, LineChart, Line, ComposedChart, AreaChart, Area, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { parseISO } from 'date-fns';
import dynamic from 'next/dynamic';
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const DIRECTIONS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const getCardinal = (deg) => {
  if (deg === null || deg === undefined) return null;
  if (deg === 'VRB') return 'VRB';
  const val = Math.floor((deg / 22.5) + 0.5);
  return DIRECTIONS[(val % 16)];
};

const SPEED_BINS = [
  { label: '0-<5',  min: 0,  max: 5,   color: '#1a3c5c' },
  { label: '5-10',  min: 5,  max: 10,  color: '#2b7eb8' },
  { label: '10-15', min: 10, max: 15,  color: '#6cc4b4' },
  { label: '15-20', min: 15, max: 20,  color: '#a0d9a4' },
  { label: '20-25', min: 20, max: 25,  color: '#e8f098' },
  { label: '25-30', min: 25, max: 30,  color: '#f5d76e' },
  { label: '30-35', min: 30, max: 35,  color: '#f2994a' },
  { label: '35-40', min: 35, max: 40,  color: '#e74c3c' },
  { label: '40+',   min: 40, max: 999, color: '#7b1a2c' }
];

// 36 sectors at every 10° for the wind rose
const DEGREE_SECTORS = Array.from({ length: 36 }, (_, i) => (i + 1) * 10); // [10, 20, ..., 360]
const ORDERED_SECTORS = [360, ...DEGREE_SECTORS.filter(d => d !== 360)];   // [360, 10, 20, ..., 350]

export default function PrevailingWindTab({ data }) {
  const [subTab, setSubTab] = useState('ObsMaxAvg'); // 'Wind Rose', 'ObsMaxAvg', 'Hourly Wind'
  const [hoursInput, setHoursInput] = useState(''); 
  const [appliedHours, setAppliedHours] = useState([]);

  const handleRun = () => {
    if (!hoursInput.trim()) {
      setAppliedHours([]);
    } else {
      const parsed = hoursInput.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      setAppliedHours(parsed);
    }
  };

  const { obsMaxAvgData, hourlyWindData, windRoseData, totals } = useMemo(() => {
    let totalsObj = { rec: 0, vrb: 0 };
    if (!data || data.length === 0) return { obsMaxAvgData: [], hourlyWindData: [], windRoseData: [], totals: totalsObj };

    const filtered = data.filter(d => {
      try {
        if (!d.windSpeed && d.windSpeed !== 0 && d.windDirection !== 'VRB') return false; 
        if (appliedHours.length > 0) {
          const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
          const dt = parseISO(dateStr);
          if (isNaN(dt.getTime())) return false;
          if (!appliedHours.includes(dt.getUTCHours())) return false;
        }
        return true;
      } catch(e) { return false; }
    });

    totalsObj.rec = filtered.length;

    let dirBuckets = {};
    for (let i = 1; i <= 36; i++) {
      dirBuckets[i * 10] = { dir: i * 10, obs: 0, sum: 0, max: 0 };
    }

    let hourBuckets = {};
    for (let i = 0; i < 24; i++) {
        hourBuckets[i] = { hour: `${String(i).padStart(2, '0')}:00` };
        DIRECTIONS.forEach(d => hourBuckets[i][d] = 0);
        hourBuckets[i]['VRB'] = 0;
    }

    let roseBuckets = {};
    DEGREE_SECTORS.forEach(deg => {
      roseBuckets[deg] = {};
      SPEED_BINS.forEach(b => roseBuckets[deg][b.label] = 0);
    });

    filtered.forEach(d => {
      const spd = d.windSpeed || 0;
      const deg = d.windDirection;
      
      const hr = parseISO(d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`).getUTCHours();
      
      if (deg === 'VRB') {
        totalsObj.vrb++;
        if (hourBuckets[hr]) hourBuckets[hr]['VRB']++;
      } else if (deg !== null && deg !== undefined && !isNaN(deg)) {
        let bin = Math.round(deg / 10) * 10;
        if (bin === 0) bin = 360;
        if (dirBuckets[bin]) {
          dirBuckets[bin].obs++;
          dirBuckets[bin].sum += spd;
          if (spd > dirBuckets[bin].max) dirBuckets[bin].max = spd;
        }

        const card = getCardinal(deg);
        if (hourBuckets[hr] && card !== 'VRB') hourBuckets[hr][card]++;

        // Wind rose: bucket by 10° degree bin directly (absolute counts)
        if (roseBuckets[bin]) {
          const matchedBin = SPEED_BINS.find(b => spd >= b.min && spd < b.max) || SPEED_BINS[SPEED_BINS.length - 1];
          roseBuckets[bin][matchedBin.label]++;
        }
      }
    });

    const obsMaxAvgDataResult = Object.keys(dirBuckets).map(k => ({
      direction: parseInt(k, 10),
      Observations: dirBuckets[k].obs,
      Max: dirBuckets[k].max,
      Avg: dirBuckets[k].obs > 0 ? parseFloat((dirBuckets[k].sum / dirBuckets[k].obs).toFixed(1)) : 0
    })).sort((a,b) => a.direction - b.direction);

    const hourlyWindDataResult = Object.keys(hourBuckets).map(k => hourBuckets[k]);
    // Wind rose data: ordered [360°, 10°, 20°, ..., 350°] with absolute observation counts
    const windRoseDataResult = ORDERED_SECTORS.map(deg => {
      let bucket = { direction: deg };
      SPEED_BINS.forEach(b => {
        bucket[b.label] = roseBuckets[deg]?.[b.label] || 0;
      });
      return bucket;
    });

    return { obsMaxAvgData: obsMaxAvgDataResult, hourlyWindData: hourlyWindDataResult, windRoseData: windRoseDataResult, totals: totalsObj };
  }, [data, appliedHours]);

  const toPercent = (decimal) => `${(decimal * 100).toFixed(0)}%`;

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="hours">Hours (UTC)</label>
            <input 
              id="hours" 
              type="text" 
              value={hoursInput} 
              onChange={e => setHoursInput(e.target.value)}
              placeholder="e.g. 3, 9, 15 (Comma separated)"
            />
            <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>Leave empty for all hours</small>
          </div>
          <button className="btn-primary" style={{ width: '100%' }} onClick={handleRun}>Run / Create Report</button>
        </div>
        
        {/* Chart Area */}
        <div className="glass-container md:col-span-3" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div className="tabs-container" style={{ borderBottom: 'none', paddingBottom: 0 }}>
              {['Wind Rose', 'Obs-Max-Avg', 'Hourly Wind'].map(tg => {
                const tabKey = tg.replace(/-/g, '');
                return (
                  <button 
                    key={tg} 
                    className={`tab-btn sub-tab-btn ${subTab === tabKey ? 'active' : ''}`}
                    onClick={() => setSubTab(tabKey)}
                  >
                    {tg}
                  </button>
                )
              })}
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Rec. Total: {totals.rec} / Vrb. Total: {totals.vrb} ({(totals.rec ? (totals.vrb/totals.rec)*100 : 0).toFixed(1)}%)
            </div>
          </div>
          
          <div style={{ height: subTab === 'Wind Rose' ? '540px' : '400px', width: '100%' }}>
            {subTab === 'Wind Rose' && (
              <ReactECharts 
                option={{
                  title: {
                    text: `Wind Rose (Rec. Total: ${totals.rec.toLocaleString()} / Vrb. Total: ${totals.vrb.toLocaleString()} (${(totals.rec ? (totals.vrb / totals.rec) * 100 : 0).toFixed(1)}%) )`,
                    left: 'center',
                    top: 5,
                    textStyle: { color: '#94a3b8', fontSize: 13, fontWeight: 500 }
                  },
                  tooltip: {
                    trigger: 'item',
                    backgroundColor: 'rgba(15, 15, 25, 0.92)',
                    borderColor: 'rgba(255,255,255,0.12)',
                    textStyle: { color: '#e2e8f0', fontSize: 12 },
                    formatter: (params) => {
                      const dir = typeof params.name === 'string' ? params.name.replace('°', '') : params.name;
                      
                      let cumulativeValue = 0;
                      const bucket = windRoseData.find(d => d.direction == dir);
                      if (bucket) {
                        for (let bin of SPEED_BINS) {
                          cumulativeValue += bucket[bin.label] || 0;
                          if (bin.label === params.seriesName) break;
                        }
                      }
                      
                      // Format with tr-TR to show dot as thousand separator like the legacy system
                      return `t: ${dir}, r: ${cumulativeValue.toLocaleString('tr-TR')}<br/><span style="color:${params.color}">■</span> ${params.seriesName} kt`;
                    }
                  },
                  legend: {
                    orient: 'vertical',
                    right: 8,
                    top: 40,
                    itemWidth: 12,
                    itemHeight: 12,
                    textStyle: { color: '#94a3b8', fontSize: 11 },
                    data: SPEED_BINS.map(b => b.label)
                  },
                  graphic: [{
                    type: 'text',
                    right: 5,
                    top: 24,
                    style: {
                      text: 'Wind Speed (knots)',
                      fill: '#94a3b8',
                      fontSize: 12,
                      fontWeight: 'bold'
                    }
                  }],
                  polar: {
                    radius: '68%',
                    center: ['44%', '54%']
                  },
                  angleAxis: {
                    type: 'category',
                    data: ORDERED_SECTORS.map(d => `${d}°`),
                    startAngle: 90,
                    clockwise: true,
                    boundaryGap: true,
                    axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
                    axisTick: { show: false },
                    splitLine: {
                      show: true,
                      interval: 2,
                      lineStyle: { color: 'rgba(255,255,255,0.08)' }
                    },
                    axisLabel: {
                      interval: 2,
                      color: '#94a3b8',
                      fontSize: 11,
                      margin: 8
                    }
                  },
                  radiusAxis: {
                    axisLine: { show: false },
                    axisTick: { show: false },
                    axisLabel: {
                      color: '#94a3b8',
                      fontSize: 10,
                      formatter: (val) => val >= 1000 ? val.toLocaleString() : (val === 0 ? '' : val)
                    },
                    splitLine: {
                      show: true,
                      lineStyle: { color: 'rgba(255,255,255,0.12)', type: 'solid' }
                    },
                    splitNumber: 4
                  },
                  series: SPEED_BINS.map(bin => ({
                    type: 'bar',
                    data: windRoseData.map(d => d[bin.label]),
                    coordinateSystem: 'polar',
                    name: bin.label,
                    stack: 'wind',
                    itemStyle: { color: bin.color, borderColor: bin.color, borderWidth: 0.5 },
                    emphasis: { focus: 'series', blurScope: 'coordinateSystem' },
                    barCategoryGap: '5%'
                  }))
                }}
                style={{ height: '540px', width: '100%' }}
              />
            )}
            
            {subTab !== 'Wind Rose' && (
              <ResponsiveContainer>
                {subTab === 'ObsMaxAvg' && (
                  <ComposedChart data={obsMaxAvgData} margin={{ top: 10, right: 30, left: 30, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="direction" type="category" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickFormatter={(val) => `${val}°`} label={{ value: 'Directions (°)', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)' }} />
                    <YAxis yAxisId="left" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} label={{ value: 'Wind Speed (KT)', angle: -90, position: 'insideLeft', offset: -15, fill: 'var(--text-muted)', style: { textAnchor: 'middle' } }} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} label={{ value: 'Sum(Observations)', angle: 90, position: 'insideRight', offset: -10, fill: 'var(--text-muted)', style: { textAnchor: 'middle' } }} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} cursor={{ fill: 'rgba(255,255,255,0.05)' }} formatter={(val, name) => [name === 'Observations' ? val : val + 'KT', name]} labelFormatter={(label) => `${label}°`} />
                    <Legend verticalAlign="top" height={36} iconType="rect" align="center" wrapperStyle={{ marginBottom: '16px' }} />
                    
                    <Bar yAxisId="right" dataKey="Observations" fill="#a78bfa" name="Observations" radius={[2, 2, 0, 0]} />
                    <Line yAxisId="left" type="monotone" dataKey="Max" stroke="#f43f5e" strokeWidth={2} dot={true} />
                    <Line yAxisId="left" type="monotone" dataKey="Avg" stroke="#3b82f6" strokeWidth={2} dot={true} />
                  </ComposedChart>
                )}

                {subTab === 'Hourly Wind' && (
                  <AreaChart data={hourlyWindData} stackOffset="expand" margin={{ top: 10, right: 10, left: 25, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="hour" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)', angle: -45, dx: -15, dy: 10 }} height={50} />
                    <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} tickFormatter={toPercent} label={{ value: 'Cumulative (%)', angle: -90, position: 'insideLeft', offset: -15, fill: 'var(--text-muted)', style: { textAnchor: 'middle' } }} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} formatter={(val, name) => [val + ' Obs', name]} />
                    <Legend verticalAlign="top" height={60} iconType="circle" wrapperStyle={{ marginBottom: '16px' }} />
                    {DIRECTIONS.map((d, i) => (
                      <Area key={d} type="monotone" dataKey={d} stackId="1" stroke={`hsl(${(i * 22.5)}, 70%, 50%)`} fill={`hsl(${(i * 22.5)}, 70%, 50%)`} fillOpacity={0.8} />
                    ))}
                    <Area dataKey="VRB" stackId="1" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.8} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
