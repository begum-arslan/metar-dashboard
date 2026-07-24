"use client";
import { findAirport } from '@/data/airports';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { parseISO, format } from 'date-fns';

export default function ControlPanel({ onFetch, loading, station, setStation, startDate, setStartDate, endDate, setEndDate }) {

  // Convert string dates (yyyy-MM-dd) to Date objects for react-datepicker
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
            scrollableYearDropdown
            yearDropdownItemNumber={30}
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
            scrollableYearDropdown
            yearDropdownItemNumber={30}
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
