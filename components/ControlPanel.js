"use client";
import { findAirport } from '@/data/airports';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { parseISO, format } from 'date-fns';

export default function ControlPanel({ onFetch, loading, station, setStation, startDate, setStartDate, endDate, setEndDate }) {

  const startDateObj = startDate ? parseISO(startDate) : null;
  const endDateObj = endDate ? parseISO(endDate) : null;

  // Auto-format date input: insert dashes as user types (YYYY-MM-DD)
  const autoFormatDate = (e, setter) => {
    if (!e || !e.target || typeof e.target.value !== 'string') return;
    const input = e.target;
    // Only digits and dashes allowed
    let raw = input.value.replace(/[^\d]/g, '');
    // Limit to 8 digits (YYYYMMDD)
    raw = raw.slice(0, 8);
    // Build formatted string
    let formatted = '';
    if (raw.length > 4) {
      formatted = raw.slice(0, 4) + '-' + raw.slice(4);
    } else {
      formatted = raw;
    }
    if (raw.length > 6) {
      formatted = raw.slice(0, 4) + '-' + raw.slice(4, 6) + '-' + raw.slice(6);
    }
    // Auto-add dash after year (4 digits) or month (7 chars = YYYY-MM)
    if (raw.length === 4 && input.value.length > (input._prevLen || 0)) {
      formatted = raw + '-';
    }
    if (raw.length === 6 && input.value.length > (input._prevLen || 0)) {
      formatted = raw.slice(0, 4) + '-' + raw.slice(4) + '-';
    }
    input._prevLen = formatted.length;
    input.value = formatted;
    // If we have a complete date, update state
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
      const parsed = parseISO(formatted);
      if (!isNaN(parsed.getTime())) {
        setter(formatted);
      }
    }
  };

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
        {inputStations.length > 15 && (
          <div style={{
            marginTop: '8px',
            padding: '10px 12px',
            borderRadius: '6px',
            backgroundColor: 'rgba(56, 189, 248, 0.15)', // Blue transparent
            border: '1px solid rgba(14, 165, 233, 0.4)', // Blue border
            color: '#7dd3fc', // Blue text
            fontSize: '0.75rem',
            lineHeight: '1.4'
          }}>
            <strong>Large Query Info:</strong> You have selected a large number of stations. Our system will automatically process these in batches to ensure successful data retrieval without timeouts. Please note that downloading years of data for this many airports may take a short while.
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
            onChangeRaw={(e) => autoFormatDate(e, setStartDate)}
            dateFormat="yyyy-MM-dd"
            className="date-picker-input"
            minDate={parseISO('1998-01-01')}
            maxDate={endDateObj || new Date()}
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
            onChangeRaw={(e) => autoFormatDate(e, setEndDate)}
            dateFormat="yyyy-MM-dd"
            className="date-picker-input"
            minDate={startDateObj || parseISO('1998-01-01')}
            maxDate={new Date()}
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
