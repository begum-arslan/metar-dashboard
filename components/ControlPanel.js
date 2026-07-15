"use client";
import { findAirport } from '@/data/airports';

export default function ControlPanel({ onFetch, loading, station, setStation, startDate, setStartDate, endDate, setEndDate }) {

  const handleSubmit = (e) => {
    e.preventDefault();
    onFetch(station, startDate, endDate);
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
          onChange={e => {
            e.target.setCustomValidity('');
            setStation(e.target.value.toUpperCase());
          }} 
          onInvalid={e => e.target.setCustomValidity('Please fill out this field.')}
          placeholder="e.g. LTFM, IST" 
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
          <input type="date" id="start" value={startDate} onChange={e => setStartDate(e.target.value)} min="1998-01-01" required />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="end">End Date</label>
          <input type="date" id="end" value={endDate} onChange={e => setEndDate(e.target.value)} min="1998-01-01" required />
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? <div className="loader"></div> : 'Analyze'}
      </button>
    </form>
  );
}
