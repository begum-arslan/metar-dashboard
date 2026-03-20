"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import ControlPanel from '@/components/ControlPanel';
import Charts from '@/components/Charts';
import ObservationsView from '@/components/ObservationsView';
import { getAllAirports, findAirport } from '@/data/airports';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

const AIRPORTS = getAllAirports();

const OBSERVATION_TABS = [
  { id: 'visibility', label: 'Visibility' },
  { id: 'phenomena', label: 'Phenomena' },
  { id: 'prevailing_wind', label: 'Prevailing Wind' },
  { id: 'ceiling', label: 'Ceiling' },
  { id: 'head_tail_wind', label: 'Head-Tail Wind' },
  { id: 'vis_head_tail_wind', label: 'Vis. + Head-Tail Wind' },
  { id: 'cloud_type', label: 'Cloud Type' },
  { id: 'temperature', label: 'Temperature' },
  { id: 'temp_without_value', label: 'Temp. Without Value' },
  { id: 'pressure', label: 'Pressure' },
  { id: 'pressure_without_value', label: 'Pressure Without Value' }
];

const PERCENTAGE_TABS = [
  { id: 'visibility_pct', label: 'Visibility %' },
  { id: 'visibility_stations_pct', label: 'Visibility Stations %' },
  { id: 'phenomena_query_pct', label: 'Phenomena Query %' },
  { id: 'ceiling_pct', label: 'Ceiling %' },
  { id: 'head_tail_wind_pct', label: 'Head -Tail Wind %' },
  { id: 'vis_head_tail_wind_pct', label: 'Visibility + Head -Tail Wind %' },
  { id: 'cloud_type_pct', label: 'Cloud Type %' },
  { id: 'temperature_pct', label: 'Temperature %' },
  { id: 'pressure_pct', label: 'Pressure %' }
];

export default function Home() {
  const globeRef = useRef();
  const rafRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  // Data state
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCharts, setShowCharts] = useState(false);
  const [activeStation, setActiveStation] = useState(null);

  // Tab state
  const [mainTab, setMainTab] = useState('observations');
  const [observationTab, setObservationTab] = useState('visibility');
  const [percentageTab, setPercentageTab] = useState('visibility_pct');

  const hasData = data && data.length > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  // rAF loop that calls controls.update() every frame so autoRotate works
  const startControlsLoop = useCallback(() => {
    if (rafRef.current) return; // already running
    const tick = () => {
      if (globeRef.current) {
        try { globeRef.current.controls().update(); } catch(e) {}
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Poll until globe controls are available, then enable autoRotate
  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(() => {
      if (globeRef.current) {
        try {
          const controls = globeRef.current.controls();
          if (controls) {
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.4;
            controls.enableZoom = false;
            globeRef.current.pointOfView({ lat: 30, lng: 20, altitude: 2.5 }, 0);
            startControlsLoop();
            clearInterval(interval);
          }
        } catch(e) { /* controls not ready yet, keep polling */ }
      }
    }, 500);

    return () => {
      clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mounted, startControlsLoop]);

  // Zoom to airport and then show charts
  const zoomToAirport = useCallback((code) => {
    const { airport } = findAirport(code);
    if (airport && globeRef.current) {
      // Stop auto-rotation during zoom
      try {
        globeRef.current.controls().autoRotate = false;
      } catch(e) {}
      // Zoom to the airport location
      globeRef.current.pointOfView(
        { lat: airport.lat, lng: airport.lng, altitude: 1.2 },
        2000
      );
      // After zoom completes, blur globe and show charts
      setTimeout(() => {
        setShowCharts(true);
      }, 2200);
    } else {
      // Airport not in our database — just show charts directly
      setShowCharts(true);
    }
  }, []);

  const fetchData = async (stationInput, start, end) => {
    setLoading(true);
    setError(null);
    setShowCharts(false);

    // Resolve IATA → ICAO if needed
    const { icao } = findAirport(stationInput);
    const station = icao || stationInput.toUpperCase();

    try {
      const res = await fetch(`/api/metar?station=${station}&start=${start}&end=${end}`);
      if (!res.ok) throw new Error('Failed to fetch data');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data);
      setActiveStation(stationInput.toUpperCase());
      // Zoom to the airport
      zoomToAirport(stationInput);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#050505' }}>
      
      <div className="main-layout">
        
        {/* LEFT PANEL — Controls & Tabs */}
        <div className="left-panel">
          {/* Title */}
          <div>
            <h1 className="top-title">
              Operational Dashboard
              <span className="top-title-accent">METAR / SPECI Tracking</span>
            </h1>
          </div>

          {/* Divider */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} />

          {/* Control Panel */}
          <div>
            <div className="section-label">Station & Date Range</div>
            <ControlPanel onFetch={fetchData} loading={loading} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ color: '#ef4444', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', fontSize: '0.85rem' }}>
              Error: {error}
            </div>
          )}

          {/* Data Status */}
          <div className={`data-status ${hasData ? 'has-data' : ''}`}>
            <span className="dot" />
            {hasData
              ? `${data.length} observations — ${activeStation}`
              : 'No data loaded'}
          </div>

          {/* Divider */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} />

          {/* Main View Tabs */}
          <div>
            <div className="section-label">View</div>
            <div className="vertical-tabs">
              <button
                className={`tab-btn ${mainTab === 'observations' ? 'active' : ''}`}
                onClick={() => setMainTab('observations')}
              >
                📋 Observations
              </button>
              <button
                className={`tab-btn ${mainTab === 'percentage' ? 'active' : ''}`}
                onClick={() => setMainTab('percentage')}
              >
                % Percentage
              </button>
              <button
                className={`tab-btn ${mainTab === 'charts' ? 'active' : ''}`}
                onClick={() => setMainTab('charts')}
              >
                📊 General Charts
              </button>
            </div>
          </div>

          {/* Observation Sub-tabs */}
          {mainTab === 'observations' && (
            <div>
              <div className="section-label">Observation Category</div>
              <div className="vertical-tabs">
                {OBSERVATION_TABS.map(tab => (
                  <button
                    key={tab.id}
                    className={`tab-btn ${observationTab === tab.id ? 'active' : ''}`}
                    onClick={() => setObservationTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Percentage Sub-tabs */}
          {mainTab === 'percentage' && (
            <div>
              <div className="section-label">Percentage Category</div>
              <div className="vertical-tabs">
                {PERCENTAGE_TABS.map(tab => (
                  <button
                    key={tab.id}
                    className={`tab-btn ${percentageTab === tab.id ? 'active' : ''}`}
                    onClick={() => setPercentageTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Footer removed */}
        </div>

        {/* RIGHT PANEL — Globe + Chart Overlay */}
        <div className="right-panel">
          {/* Globe */}
          <div className={`globe-wrapper ${showCharts && hasData ? 'blurred' : ''}`}>
            {mounted && (
              <Globe
                ref={globeRef}
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                backgroundColor="rgba(0,0,0,0)"
                
                pointsData={AIRPORTS}
                pointLat="lat"
                pointLng="lng"
                pointColor={() => 'rgba(255, 255, 255, 0.8)'}
                pointAltitude={0.01}
                pointRadius={0.3}

                labelsData={AIRPORTS}
                labelLat="lat"
                labelLng="lng"
                labelText="iata"
                labelSize={1.2}
                labelDotRadius={0.3}
                labelColor={() => 'rgba(255, 255, 255, 0.85)'}
                labelResolution={2}
                labelAltitude={0.015}
              />
            )}
          </div>

          {/* Chart Overlay */}
          <div className={`chart-overlay ${showCharts && hasData ? 'visible' : ''}`}>
            {hasData && mainTab === 'charts' && (
              <Charts data={data} />
            )}
            {hasData && mainTab === 'observations' && (
              <ObservationsView data={data} activeTab={observationTab} />
            )}
            {hasData && mainTab === 'percentage' && (
              <div className="glass-container" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <h3 style={{ color: '#ffffff', marginBottom: '8px' }}>
                  {PERCENTAGE_TABS.find(t => t.id === percentageTab)?.label} Seçenekleri
                </h3>
                <p>Percentage hesaplamaları ve grafikleri buraya eklenecektir...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
