"use client";
import { findAirport } from '@/data/airports';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { parseISO, format } from 'date-fns';

export default function ControlPanel({ onFetch, loading, station, setStation, startDate, setStartDate, endDate, setEndDate }) {

  const startDateObj = startDate ? parseISO(startDate) : null;
  const endDateObj = endDate ? parseISO(endDate) : null;

  const handleStartChange = (date) => {
    if (date) setStartDate(format(date, 'yyyy-MM-dd'));
  };
  const handleEndChange = (date) => {
    if (date) setEndDate(format(date, 'yyyy-MM-dd'));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (new Date(startDate) > new Date(endDate)) {
      alert("Start Date cannot be later than End Date.");
      return;
    }
    const stationsArray = station.split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    if (stationsArray.length === 0) return;
    onFetch(stationsArray, startDate, endDate);
  };

  // Resolve input to show the user what will be queried
  const inputStations = station.split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(s => s.length >= 3);
  const resolvedList = inputStations.map(s => {
    const res = findAirport(s);
    return res && res.airport ? res.airport : { icao: s, name: 'Unknown' };
  });

  return (
    <form onSubmit={handleSubmit} className="compact-form">
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="station">Airports (ICAO / IATA)</label>
        <input 
          type="text" 
          id="station" 
          value={station} 
          onChange={e => {
            e.target.setCustomValidity('');
            setStation(e.target.value.toUpperCase());
          }} 
          onInvalid={e => e.target.setCustomValidity('Please fill out this field.')}
          placeholder="e.g. LTFM LTBA EGLL" 
          required 
        />
        {resolvedList.length > 0 && (
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {resolvedList.map((res, i) => (
              <span key={i}>
                → {res.icao} {res.iata && res.iata !== res.icao ? `/ ${res.iata}` : ''} · {res.name}
              </span>
            ))}
          </div>
        )}
        {inputStations.length > 10 && (
          <div style={{
            marginTop: '8px',
            padding: '10px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(217, 119, 6, 0.15)', // Amber transparent
            border: '1px solid rgba(245, 158, 11, 0.4)', // Amber border
            color: '#fcd34d', // Amber text
            fontSize: '0.75rem',
            lineHeight: '1.4'
          }}>
            <strong>Performance Warning:</strong> You have entered more than 10 stations. Querying a large number of stations at once, especially over long date ranges, may result in long loading times or server timeouts from the data provider. Consider splitting your query into smaller batches.
          </div>
        )}
      </div>

      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="start">Start Date</label>
          <DatePicker
            id="start"
            selected={startDateObj}
            onChange={handleStartChange}
            dateFormat="yyyy-MM-dd"
            className="date-picker-input"
            minDate={parseISO('1998-01-01')}
            maxDate={endDateObj}
            showYearDropdown
            showMonthDropdown
            dropdownMode="select"
            calendarStartDay={1}
            fixedHeight
            required
            autoComplete="off"
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="end">End Date</label>
          <DatePicker
            id="end"
            selected={endDateObj}
            onChange={handleEndChange}
            dateFormat="yyyy-MM-dd"
            className="date-picker-input"
            minDate={startDateObj || parseISO('1998-01-01')}
            showYearDropdown
            showMonthDropdown
            dropdownMode="select"
            calendarStartDay={1}
            fixedHeight
            required
            autoComplete="off"
          />
        </div>
      </div>

      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? <div className="loader"></div> : 'Analyze'}
      </button>
    </form>
  );
}
