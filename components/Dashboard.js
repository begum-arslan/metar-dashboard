"use client";
import { useState } from 'react';
import ControlPanel from './ControlPanel';
import Charts from './Charts';
import ObservationsView from './ObservationsView';

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mainTab, setMainTab] = useState('observations');

  const fetchData = async (station, start, end) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metar?station=${station}&start=${start}&end=${end}`);
      if (!res.ok) {
        throw new Error('Failed to fetch data');
      }
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4">
      <ControlPanel onFetch={fetchData} loading={loading} />
      {error && <div style={{ color: '#ef4444', padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>Error: {error}</div>}
      {data && data.length > 0 ? (
        <>
          <div className="tabs-container" style={{ marginTop: '8px', marginBottom: '8px' }}>
            <button className={`tab-btn ${mainTab === 'observations' ? 'active' : ''}`} onClick={() => setMainTab('observations')}>Observations</button>
            <button className={`tab-btn ${mainTab === 'charts' ? 'active' : ''}`} onClick={() => setMainTab('charts')}>General Charts</button>
          </div>
          
          {mainTab === 'charts' && <Charts data={data} />}
          {mainTab === 'observations' && <ObservationsView data={data} />}
        </>
      ) : (
        !loading && !error && <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Type an airport code and select dates to load data.</div>
      )}
    </div>
  );
}
