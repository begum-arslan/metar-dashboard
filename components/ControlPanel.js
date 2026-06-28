"use client";
import { useState } from 'react';
import { findAirport } from '@/data/airports';

export default function ControlPanel({ onFetch, loading, station, setStation }) {
  
  const today = new Date();
  const past = new Date();
  past.setDate(today.getDate() - 2);

  const [start, setStart] = useState(past.toISOString().split('T')[0]);
  const [end, setEnd] = useState(today.toISOString().split('T')[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onFetch(station, start, end);
  };

  // Resolve input to show the user what will be queried
  const resolved = station.length >= 3 ? findAirport(station) : null;
  const isIATA = station.length === 3 && resolved?.airport;

  return (
    <form onSubmit={handleSubmit} className="compact-form">
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="station">Airport (ICAO or IATA)</label>
        <input 
          type="text" 
          id="station" 
          value={station} 
          onChange={e => setStation(e.target.value.toUpperCase())} 
          placeholder="e.g. KJFK, JFK, LTFM, IST" 
          maxLength={4}
          required 
        />
        {station.length >= 3 && (
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
            {resolved && resolved.airport 
              ? `→ ${resolved.airport.icao} ${resolved.airport.iata ? `/ ${resolved.airport.iata}` : ''} · ${resolved.airport.name}`
              : `→ ${station.toUpperCase()}`}
          </span>
        )}
      </div>

      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="start">Start Date</label>
          <input type="date" id="start" value={start} onChange={e => setStart(e.target.value)} min="1998-01-01" required />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="end">End Date</label>
          <input type="date" id="end" value={end} onChange={e => setEnd(e.target.value)} min="1998-01-01" required />
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? <div className="loader"></div> : 'Analyze'}
      </button>
    </form>
  );
}
