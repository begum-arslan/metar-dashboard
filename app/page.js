"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import ControlPanel from '@/components/ControlPanel';
import Charts from '@/components/Charts';
import ObservationsView from '@/components/ObservationsView';
import PercentageView from '@/components/PercentageView';
import { getAllAirports, findAirport } from '@/data/airports';

const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

// ─── Solar position helpers (avoid importing solar-calculator at module level for SSR) ───
function getSunPosition(date) {
  // Calculate the sub-solar point (lat, lng) for a given Date
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  // Solar declination (approximate, Spencer formula simplified)
  const B = (2 * Math.PI / 365) * (dayOfYear - 1);
  const decl = 0.006918
    - 0.399912 * Math.cos(B)
    + 0.070257 * Math.sin(B)
    - 0.006758 * Math.cos(2 * B)
    + 0.000907 * Math.sin(2 * B)
    - 0.002697 * Math.cos(3 * B)
    + 0.00148 * Math.sin(3 * B);

  // Equation of time (minutes)
  const eot = 229.18 * (
    0.000075
    + 0.001868 * Math.cos(B)
    - 0.032077 * Math.sin(B)
    - 0.014615 * Math.cos(2 * B)
    - 0.04089 * Math.sin(2 * B)
  );

  // Sub-solar longitude: based on UTC time and equation of time
  const solarNoonOffsetMinutes = eot;
  const lng = -(utcHours - 12) * 15 + solarNoonOffsetMinutes * (15 / 60);

  // Sub-solar latitude: declination in degrees
  const lat = decl * (180 / Math.PI);

  return { lat, lng: ((lng + 540) % 360) - 180 }; // normalize lng to [-180, 180]
}

// Day/Night custom shader
const DAY_NIGHT_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Pass object-space position (the sphere is centered at origin)
    vWorldPosition = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const DAY_NIGHT_FRAGMENT_SHADER = `
  #define PI 3.141592653589793
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec2 sunPosition; // [lng, lat] in degrees
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  // Color grading helpers
  vec3 adjustSaturation(vec3 color, float saturation) {
    float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
    return mix(vec3(grey), color, saturation);
  }

  vec3 adjustContrast(vec3 color, float contrast) {
    return (color - 0.5) * contrast + 0.5;
  }

  void main() {
    // Convert sun position (lng, lat) to cartesian direction
    float sunLng = sunPosition.x * PI / 180.0;
    float sunLat = sunPosition.y * PI / 180.0;
    vec3 sunDir = vec3(
      cos(sunLat) * cos(sunLng),
      sin(sunLat),
      cos(sunLat) * sin(sunLng)
    );

    // Reconstruct surface direction from UV coordinates
    float fragLng = (vUv.x - 0.5) * 2.0 * PI;
    float fragLat = (vUv.y - 0.5) * PI;
    vec3 surfaceDir = vec3(
      cos(fragLat) * cos(fragLng),
      sin(fragLat),
      cos(fragLat) * sin(fragLng)
    );

    // Dot product: 1.0 = full sun, -1.0 = full night
    float intensity = dot(normalize(surfaceDir), normalize(sunDir));

    // Clean transition at terminator (no extra glow)
    float blend = smoothstep(-0.08, 0.12, intensity);

    // === Day texture — brighter, slightly desaturated premium look ===
    vec4 dayRaw = texture2D(dayTexture, vUv);
    vec3 dayGraded = dayRaw.rgb;
    dayGraded = adjustSaturation(dayGraded, 0.75);
    dayGraded *= 0.85;
    dayGraded = adjustContrast(dayGraded, 1.08);

    // === Night texture ===
    vec4 nightRaw = texture2D(nightTexture, vUv);
    vec3 nightGraded = nightRaw.rgb;
    // Boost city lights
    nightGraded *= 2.8;
    
    // Moonlight ambient: Use the daytime map to reveal continents/oceans at night
    // Tint the daytime colors with a deep cool blue for a realistic night look
    vec3 moonlightTint = vec3(0.12, 0.22, 0.45);
    vec3 nightAmbient = dayRaw.rgb * moonlightTint * 0.9;
    
    // Combine city lights with the ambient geography
    nightGraded = max(nightGraded, nightAmbient);

    // Final blend — clean transition
    vec3 finalColor = mix(nightGraded, dayGraded, blend);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

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

const getHtmlElement = (d) => {
  const el = document.createElement('div');
  el.style.width = '32px';
  el.style.height = '32px';
  el.style.position = 'relative';
  el.style.pointerEvents = 'none';

  const isDay = d.isDayTime;

  if (d.type === 'hub') {
    const hubColor = isDay ? '#8c6239' : '#3b82f6';
    const hubBg = isDay ? 'rgba(140, 98, 57, 0.2)' : 'rgba(59, 130, 246, 0.2)';

    el.innerHTML = `
      <!-- Pulsing ring centered at coordinate -->
      <div style="
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 20px;
        height: 20px;
        background: ${hubBg};
        border: 2px solid ${hubColor};
        border-radius: 50%;
        animation: pulse-ring 1.8s infinite ease-in-out;
        pointer-events: none;
      "></div>
      <!-- Teardrop Pin with bottom tip pointing to coordinate -->
      <div style="
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -100%);
        width: 22px;
        height: 22px;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: none;
      ">
        <svg viewBox="0 0 24 24" width="22px" height="22px" style="filter: drop-shadow(0 0 4px ${hubColor});">
          <path fill="${hubColor}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <path fill="#ffffff" transform="matrix(0.42 0 0 0.42 7 4)" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L14 19v-5.5l8 2.5z"/>
        </svg>
      </div>
    `;
  } else {
    const destColor = isDay ? '#d5c295' : '#93c5fd';
    const destBg = isDay ? 'rgba(213, 194, 149, 0.2)' : 'rgba(147, 197, 253, 0.2)';

    el.innerHTML = `
      <!-- Pulsing ring centered at coordinate -->
      <div style="
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 24px;
        height: 24px;
        background: ${destBg};
        border: 2px solid ${destColor};
        border-radius: 50%;
        animation: pulse-ring 1.5s infinite ease-in-out;
        pointer-events: none;
      "></div>
      <!-- Teardrop Pin with bottom tip pointing to coordinate -->
      <div style="
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -100%);
        width: 24px;
        height: 24px;
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: none;
      ">
        <svg viewBox="0 0 24 24" width="24px" height="24px" style="filter: drop-shadow(0 0 6px ${destColor});">
          <path fill="${destColor}" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <path fill="#ffffff" transform="matrix(0.42 0 0 0.42 7 4)" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L14 19v-5.5l8 2.5z"/>
        </svg>
      </div>
    `;
  }

  if (typeof document !== 'undefined' && !document.getElementById('globe-pin-styles')) {
    const style = document.createElement('style');
    style.id = 'globe-pin-styles';
    style.textContent = `
      @keyframes pulse-ring {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  return el;
};

export default function Home() {
  const globeRef = useRef();
  const rightPanelRef = useRef(null);
  const rafRef = useRef(null);
  const rotationTimeoutRef = useRef(null);
  const globeMaterialRef = useRef(null);
  const [mounted, setMounted] = useState(false);
  const [globeSize, setGlobeSize] = useState({ width: 0, height: 0 });

  // Filter state for Months
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

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
  const [resetKey, setResetKey] = useState(0);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [stationInput, setStationInput] = useState('LTFM');
  const [isDayTime, setIsDayTime] = useState(false);
  const [sunPos, setSunPos] = useState(() => getSunPosition(new Date()));

  const activeAirportObj = useMemo(() => {
    if (!activeStation) return null;
    const { airport } = findAirport(activeStation);
    return airport;
  }, [activeStation]);

  const activeRoute = useMemo(() => {
    if (!activeAirportObj) return [];
    if (activeAirportObj.iata === 'IST' || activeAirportObj.icao === 'LTFM') return [];
    return [{
      startLat: 41.2608,
      startLng: 28.7418,
      endLat: activeAirportObj.lat,
      endLng: activeAirportObj.lng
    }];
  }, [activeAirportObj]);

  const htmlElements = useMemo(() => {
    const elements = [];
    // 1. Istanbul Hub
    elements.push({
      lat: 41.2608,
      lng: 28.7418,
      type: 'hub',
      name: 'Istanbul Airport (IST)',
      isDayTime
    });

    // 2. Active Destination
    if (activeAirportObj && activeAirportObj.iata !== 'IST' && activeAirportObj.icao !== 'LTFM') {
      elements.push({
        lat: activeAirportObj.lat,
        lng: activeAirportObj.lng,
        type: 'destination',
        name: `${activeAirportObj.name} (${activeAirportObj.iata})`,
        isDayTime
      });
    }
    return elements;
  }, [activeAirportObj, isDayTime]);

  const hasData = data && data.length > 0;

  const activeColor = isDayTime ? '#d5c295' : '#93c5fd';
  const activeRingRgb = isDayTime ? '213, 194, 149' : '147, 197, 253';
  const generalAirportColor = isDayTime ? 'rgba(213, 194, 149, 0.4)' : 'rgba(59, 130, 246, 0.4)';

  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (selectedMonths.length === 0) return data;

    return data.filter(d => {
      try {
        const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
        const dt = new Date(dateStr);
        if (isNaN(dt.getTime())) return false;
        return selectedMonths.includes(dt.getUTCMonth());
      } catch (e) {
        return false;
      }
    });
  }, [data, selectedMonths]);

  const toggleMonth = (val) => {
    setSelectedMonths(prev =>
      prev.includes(val) ? prev.filter(m => m !== val) : [...prev, val]
    );
  };

  useEffect(() => {
    setMounted(true);
    const hour = new Date().getHours();
    setIsDayTime(hour >= 8 && hour < 18);

    // Update sun position every 60 seconds
    const updateSun = () => setSunPos(getSunPosition(new Date()));
    updateSun();
    const sunInterval = setInterval(updateSun, 60000);
    return () => clearInterval(sunInterval);
  }, []);

  // Create and manage the globe material with day/night shader
  const globeMaterial = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    // Dynamically import Three.js on client side
    const THREE = require('three');

    const dayTex = new THREE.TextureLoader().load('/textures/earth-day-8k.jpg');
    const nightTex = new THREE.TextureLoader().load('/textures/earth-night-8k.jpg');

    // Ensure textures wrap correctly
    [dayTex, nightTex].forEach(tex => {
      tex.colorSpace = THREE.SRGBColorSpace;
    });

    const material = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayTex },
        nightTexture: { value: nightTex },
        sunPosition: { value: new THREE.Vector2(sunPos.lng, sunPos.lat) },
      },
      vertexShader: DAY_NIGHT_VERTEX_SHADER,
      fragmentShader: DAY_NIGHT_FRAGMENT_SHADER,
    });

    globeMaterialRef.current = material;
    return material;
  }, []); // only create once

  // Update shader sunPosition uniform whenever sunPos changes
  useEffect(() => {
    if (globeMaterialRef.current) {
      globeMaterialRef.current.uniforms.sunPosition.value.set(sunPos.lng, sunPos.lat);
    }
  }, [sunPos]);

  // Track right-panel size to pass exact responsive dimensions to Globe
  useEffect(() => {
    if (!mounted || !rightPanelRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries.length > 0) {
        setGlobeSize({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });
    observer.observe(rightPanelRef.current);
    return () => observer.disconnect();
  }, [mounted]);

  // rAF loop that calls controls.update() every frame so autoRotate works
  const startControlsLoop = useCallback(() => {
    if (rafRef.current) return; // already running
    const tick = () => {
      if (globeRef.current) {
        try { globeRef.current.controls().update(); } catch (e) { }
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
            controls.autoRotateSpeed = 0.12;
            controls.enableZoom = true;
            globeRef.current.pointOfView({ lat: 30, lng: 20, altitude: 2.5 }, 0);
            startControlsLoop();
            clearInterval(interval);
          }
        } catch (e) { /* controls not ready yet, keep polling */ }
      }
    }, 500);

    return () => {
      clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (rotationTimeoutRef.current) clearTimeout(rotationTimeoutRef.current);
    };
  }, [mounted, startControlsLoop]);

  // Zoom to airport and then show charts
  const zoomToAirport = useCallback((code) => {
    const { airport } = findAirport(code);
    if (airport && globeRef.current) {
      // Stop auto-rotation during zoom
      try {
        globeRef.current.controls().autoRotate = false;
      } catch (e) { }
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
      setSelectedMonths([]); // Reset months filter on new data load
      setActiveStation(stationInput.toUpperCase());
      // Zoom to the airport
      zoomToAirport(stationInput);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoClick = () => {
    setData([]);
    setActiveStation(null);
    setShowCharts(false);
    setSelectedMonths([]);
    setError(null);
    setMainTab('observations');
    setObservationTab('visibility');
    setPercentageTab('visibility_pct');
    setStationInput('LTFM');
    setResetKey(prev => prev + 1);

    // Reset globe rotation and point of view
    if (globeRef.current) {
      try {
        const controls = globeRef.current.controls();
        if (controls) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.12;
          controls.enableZoom = true;
        }
        globeRef.current.pointOfView({ lat: 30, lng: 20, altitude: 2.5 }, 1000);
      } catch (e) {
        // Globe controls might not be ready
      }
    }
  };

  const pauseRotationTemporarily = useCallback(() => {
    // Pause auto-rotation
    if (globeRef.current) {
      try {
        const controls = globeRef.current.controls();
        if (controls) {
          controls.autoRotate = false;
        }
      } catch (e) { }
    }

    // Clear any active timeout
    if (rotationTimeoutRef.current) {
      clearTimeout(rotationTimeoutRef.current);
    }

    // Set timeout to resume rotation after 3 seconds
    rotationTimeoutRef.current = setTimeout(() => {
      if (globeRef.current) {
        try {
          const controls = globeRef.current.controls();
          if (controls) {
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.12;
          }
        } catch (e) { }
      }
    }, 3000);
  }, []);

  const handlePointClick = useCallback((point) => {
    setStationInput(point.iata || point.icao);
    pauseRotationTemporarily();
  }, [pauseRotationTemporarily]);

  return (
    <main className="app-main">
      <div className="main-layout">

        {/* LEFT PANEL — Controls & Tabs */}
        <div className="left-panel">
          {/* Title */}
          <div>
            <h1 className="top-title" onClick={handleLogoClick}>
              Operational Dashboard
            </h1>
          </div>

          {/* Divider */}
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} />

          {/* Control Panel */}
          <div>
            <div className="section-label">Station & Date Range</div>
            <ControlPanel
              key={resetKey}
              onFetch={fetchData}
              loading={loading}
              station={stationInput}
              setStation={setStationInput}
            />
          </div>

          {/* Months Filter */}
          {hasData && (
            <div style={{ marginTop: '16px', position: 'relative' }}>
              <div className="section-label">Filter by Months</div>
              <div
                onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--card-border)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {selectedMonths.length === 0 ? (
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>All Months (No Filter)</span>
                  ) : (
                    selectedMonths.map(m => (
                      <span key={m} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>
                        {MONTHS_OPTIONS.find(mo => mo.value === m)?.label.substring(0, 3)} ✕
                      </span>
                    ))
                  )}
                </div>
                <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>▼</span>
              </div>

              {isMonthDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  background: '#1a1a1a',
                  border: '1px solid var(--card-border)',
                  borderRadius: '8px',
                  padding: '8px',
                  zIndex: 50,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {MONTHS_OPTIONS.map(opt => (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.9rem', color: '#fff' }}>
                      <input
                        type="checkbox"
                        checked={selectedMonths.includes(opt.value)}
                        onChange={() => toggleMonth(opt.value)}
                        style={{ margin: 0 }}
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* Error */}
          {error && (
            <div style={{ color: '#ef4444', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', fontSize: '0.85rem' }}>
              Error: {error}
            </div>
          )}

          {/* Data Status */}
          <div className={['data-status', hasData ? 'has-data' : ''].filter(Boolean).join(' ')}>
            <span className="dot" />
            {hasData
              ? `${processedData.length} observations (of ${data.length}) — ${activeStation}`
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

        {/* RIGHT PANEL — Chart Overlay */}
        <div className="right-panel" ref={rightPanelRef}>
          {/* Globe */}
          <div className={['globe-wrapper', showCharts && hasData ? 'blurred' : ''].filter(Boolean).join(' ')}>
            {mounted && globeSize.width > 0 && (
              <Globe
                ref={globeRef}
                width={globeSize.width}
                height={globeSize.height}
                globeImageUrl="/textures/earth-day-8k.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
                globeMaterial={globeMaterial}
                backgroundColor="rgba(0,0,0,0)"
                atmosphereColor="#4b7b9c"
                atmosphereAltitude={0.25}
                autoRotate={true}
                autoRotateSpeed={0.12}

                pointsData={AIRPORTS}
                pointLat="lat"
                pointLng="lng"
                pointColor={d => {
                  if (d === hoveredPoint) return '#ffffff';
                  if (activeStation && (d.iata === activeStation || d.icao === activeStation)) return activeColor;
                  return generalAirportColor;
                }}
                pointAltitude={d => d === hoveredPoint ? 0.03 : (activeStation && (d.iata === activeStation || d.icao === activeStation) ? 0.02 : 0.008)}
                pointRadius={d => d === hoveredPoint ? 0.6 : (activeStation && (d.iata === activeStation || d.icao === activeStation) ? 0.5 : 0.18)}
                onPointHover={setHoveredPoint}
                pointLabel={d => `
                  <div style="
                    background: rgba(10, 10, 10, 0.9);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 8px;
                    padding: 8px 12px;
                    font-family: var(--font-sans), system-ui, -apple-system, sans-serif;
                    color: #fff;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    pointer-events: none;
                    text-align: left;
                  ">
                    <div style="font-weight: 700; font-size: 0.9rem; margin-bottom: 2px;">
                      ${d.iata} / ${d.icao}
                    </div>
                    <div style="font-size: 0.75rem; color: rgba(255,255,255,0.7);">
                      ${d.name}
                    </div>
                  </div>
                `}

                labelsData={activeStation ? AIRPORTS.filter(a => a.iata === activeStation || a.icao === activeStation) : []}
                labelLat="lat"
                labelLng="lng"
                labelText="iata"
                labelSize={1.5}
                labelDotRadius={0.4}
                labelColor={() => activeColor}
                labelResolution={2}
                labelAltitude={0.02}

                ringsData={activeStation ? AIRPORTS.filter(a => a.iata === activeStation || a.icao === activeStation) : []}
                ringColor={() => t => `rgba(${activeRingRgb}, ${1 - t})`}
                ringMaxRadius={2.5}
                ringPropagationSpeed={3}
                ringRepeatPeriod={800}

                htmlElementsData={htmlElements}
                htmlLat="lat"
                htmlLng="lng"
                htmlElement={getHtmlElement}
                htmlElementVisibilityModifier={(el, isVisible) => {
                  el.style.display = isVisible ? 'flex' : 'none';
                }}

                arcsData={activeRoute}
                arcStartLat="startLat"
                arcStartLng="startLng"
                arcEndLat="endLat"
                arcEndLng="endLng"
                arcColor={() => activeColor}
                arcAltitude={0.25}
                arcStroke={1.2}
                arcDashLength={0.15}
                arcDashGap={0.01}
                arcDashAnimateTime={3000}
                arcsTransitionDuration={0}

                onPointClick={handlePointClick}
                onGlobeClick={pauseRotationTemporarily}
              />
            )}
          </div>

          <div className={['chart-overlay', showCharts && hasData ? 'visible' : ''].filter(Boolean).join(' ')}>
            {hasData && mainTab === 'charts' && (
              <Charts data={processedData} />
            )}
            {hasData && mainTab === 'observations' && (
              <ObservationsView data={processedData} activeTab={observationTab} />
            )}
            {hasData && mainTab === 'percentage' && (
              <PercentageView data={processedData} activeTab={percentageTab} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
