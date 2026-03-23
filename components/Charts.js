"use client";
import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area } from 'recharts';
import { format, parseISO } from 'date-fns';

export default function Charts({ data }) {
  const MAX_CHART_POINTS = 1000;
  const step = Math.max(1, Math.floor(data.length / MAX_CHART_POINTS));

  const chartData = data
    .filter((d, i) => d && d.valid && (i % step === 0))
    .map(d => {
      try {
        const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
        const date = parseISO(dateStr);
        return {
          ...d,
          timeLabel: isNaN(date.getTime()) ? d.valid : format(date, 'MMM dd HH:mm'),
          temp: d.temperature !== null ? parseFloat(d.temperature) : null,
          dew: d.dewpoint !== null ? parseFloat(d.dewpoint) : null,
          windSpd: d.windSpeed !== null ? parseFloat(d.windSpeed) : null,
          windGst: d.windGust !== null ? parseFloat(d.windGust) : null,
          press: d.altimeter !== null ? parseFloat(d.altimeter) : null
        };
      } catch (e) {
        return { ...d, timeLabel: d.valid };
      }
    });

  const tableData = data
    .filter(d => d && d.valid)
    .slice(0, 100);

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Temperature & Dewpoint */}
      <div className="glass-container">
        <h2 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 600 }}>Temperature & Dewpoint (°C)</h2>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="timeLabel" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} />
              <Legend />
              <Line type="monotone" dataKey="temp" name="Temperature" stroke="#f43f5e" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="dew" name="Dewpoint" stroke="#3b82f6" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Wind */}
      <div className="glass-container">
        <h2 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 600 }}>Wind Speed & Gusts (kt)</h2>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="timeLabel" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
              <YAxis stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} />
              <Legend />
              <Area type="monotone" dataKey="windGst" name="Gusts" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
              <Area type="monotone" dataKey="windSpd" name="Speed" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pressure */}
      <div className="glass-container">
        <h2 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 600 }}>Altimeter (inHg)</h2>
        <div style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="timeLabel" stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
              <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" tick={{ fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} />
              <Legend />
              <Line type="monotone" dataKey="press" name="Altimeter" stroke="#eab308" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Raw Data Table */}
      <div className="glass-container" style={{ overflowX: 'auto' }}>
        <h2 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: 600 }}>Raw Data Log</h2>
        {data.length > 100 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Showing latest 100 records (out of {data.length} total) to optimize performance.
          </p>
        )}
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
              <th style={{ padding: '8px' }}>Valid Time (UTC)</th>
              <th style={{ padding: '8px' }}>Raw METAR/SPECI</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((d, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.valid}</td>
                <td style={{ padding: '8px', fontFamily: 'monospace' }}>{d.raw}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
