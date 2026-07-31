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
  { id: 'vis_head_tail_wind', label: 'Visibility + Head-Tail Wind' },
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
  el.style.width = '48px';
  el.style.height = '48px';
  el.style.position = 'relative';
  el.style.pointerEvents = 'none';

  const isDay = d.isDayTime;

  if (d.type === 'hub') {
    // Hub (Istanbul) — premium gradient marker with concentric pulse rings
    const hubPrimary = isDay ? '#c9913c' : '#60a5fa';
    const hubSecondary = isDay ? '#a67525' : '#3b82f6';
    const hubGlow = isDay ? 'rgba(201, 145, 60, 0.6)' : 'rgba(96, 165, 250, 0.6)';
    const hubGlowOuter = isDay ? 'rgba(201, 145, 60, 0.15)' : 'rgba(96, 165, 250, 0.15)';
    const hubGradient = isDay
      ? 'linear-gradient(135deg, #e8b04a, #a67525)'
      : 'linear-gradient(135deg, #93c5fd, #3b82f6)';
    const hubRingColor = isDay ? 'rgba(201, 145, 60,' : 'rgba(96, 165, 250,';

    el.innerHTML = `
      <!-- Outer pulse ring 1 -->
      <div style="
        position: absolute; left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: 40px; height: 40px;
        border: 1.5px solid ${hubPrimary};
        border-radius: 50%;
        animation: pin-pulse-1 2.4s infinite ease-out;
        pointer-events: none;
      "></div>
      <!-- Outer pulse ring 2 (delayed) -->
      <div style="
        position: absolute; left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: 40px; height: 40px;
        border: 1px solid ${hubPrimary};
        border-radius: 50%;
        animation: pin-pulse-1 2.4s 0.8s infinite ease-out;
        pointer-events: none;
      "></div>
      <!-- Static glow halo -->
      <div style="
        position: absolute; left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: 22px; height: 22px;
        border-radius: 50%;
        background: radial-gradient(circle, ${hubGlow} 0%, ${hubGlowOuter} 50%, transparent 70%);
        animation: pin-breathe 3s infinite ease-in-out;
        pointer-events: none;
      "></div>
      <!-- Central marker -->
      <div style="
        position: absolute; left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: 18px; height: 18px;
        background: ${hubGradient};
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.35);
        box-shadow: 0 0 12px ${hubGlow}, inset 0 1px 2px rgba(255,255,255,0.3);
        display: flex; align-items: center; justify-content: center;
        pointer-events: none;
      ">
        <svg viewBox="0 0 24 24" width="10px" height="10px" style="filter: drop-shadow(0 0 1px rgba(255,255,255,0.8));">
          <path fill="#ffffff" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L14 19v-5.5l8 2.5z"/>
        </svg>
      </div>
      <!-- Label -->
      <div style="
        position: absolute; left: 50%; top: -8px;
        transform: translate(-50%, -100%);
        background: rgba(10, 10, 10, 0.85);
        backdrop-filter: blur(8px);
        border: 1px solid ${hubRingColor} 0.3);
        border-radius: 6px;
        padding: 3px 8px;
        white-space: nowrap;
        pointer-events: none;
        animation: pin-float-label 3s infinite ease-in-out;
      ">
        <span style="
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 9px; font-weight: 700;
          letter-spacing: 1.5px;
          color: ${hubPrimary};
          text-shadow: 0 0 8px ${hubGlow};
        ">IST</span>
      </div>
    `;
  } else {
    // Destination — sleek glowing dot with label
    const destPrimary = isDay ? '#d5c295' : '#93c5fd';
    const destGlow = isDay ? 'rgba(213, 194, 149, 0.5)' : 'rgba(147, 197, 253, 0.5)';
    const destGlowOuter = isDay ? 'rgba(213, 194, 149, 0.1)' : 'rgba(147, 197, 253, 0.1)';
    const destGradient = isDay
      ? 'linear-gradient(135deg, #e8d5a8, #c9a96e)'
      : 'linear-gradient(135deg, #bfdbfe, #60a5fa)';
    const destRingColor = isDay ? 'rgba(213, 194, 149,' : 'rgba(147, 197, 253,';
    const destCode = d.iata || '';

    el.innerHTML = `
      <!-- Outer pulse ring -->
      <div style="
        position: absolute; left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: 32px; height: 32px;
        border: 1px solid ${destPrimary};
        border-radius: 50%;
        animation: pin-pulse-1 2s infinite ease-out;
        pointer-events: none;
      "></div>
      <!-- Glow halo -->
      <div style="
        position: absolute; left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: 18px; height: 18px;
        border-radius: 50%;
        background: radial-gradient(circle, ${destGlow} 0%, ${destGlowOuter} 50%, transparent 70%);
        animation: pin-breathe 2.5s infinite ease-in-out;
        pointer-events: none;
      "></div>
      <!-- Central marker -->
      <div style="
        position: absolute; left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: 14px; height: 14px;
        background: ${destGradient};
        border-radius: 50%;
        border: 1.5px solid rgba(255,255,255,0.3);
        box-shadow: 0 0 10px ${destGlow}, inset 0 1px 2px rgba(255,255,255,0.25);
        display: flex; align-items: center; justify-content: center;
        pointer-events: none;
      ">
        <svg viewBox="0 0 24 24" width="8px" height="8px" style="filter: drop-shadow(0 0 1px rgba(255,255,255,0.6));">
          <path fill="#ffffff" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L14 19v-5.5l8 2.5z"/>
        </svg>
      </div>
      <!-- Label -->
      <div style="
        position: absolute; left: 50%; top: -6px;
        transform: translate(-50%, -100%);
        background: rgba(10, 10, 10, 0.8);
        backdrop-filter: blur(8px);
        border: 1px solid ${destRingColor} 0.25);
        border-radius: 5px;
        padding: 2px 7px;
        white-space: nowrap;
        pointer-events: none;
        animation: pin-float-label 2.8s 0.3s infinite ease-in-out;
      ">
        <span style="
          font-family: 'Inter', system-ui, sans-serif;
          font-size: 8px; font-weight: 600;
          letter-spacing: 1.2px;
          color: ${destPrimary};
          text-shadow: 0 0 6px ${destGlow};
        ">${destCode}</span>
      </div>
    `;
  }

  if (typeof document !== 'undefined' && !document.getElementById('globe-pin-styles')) {
    const style = document.createElement('style');
    style.id = 'globe-pin-styles';
    style.textContent = `
      @keyframes pin-pulse-1 {
        0% {
          transform: translate(-50%, -50%) scale(0.5);
          opacity: 0.8;
        }
        100% {
          transform: translate(-50%, -50%) scale(2.8);
          opacity: 0;
        }
      }
      @keyframes pin-breathe {
        0%, 100% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0.7;
        }
        50% {
          transform: translate(-50%, -50%) scale(1.3);
          opacity: 1;
        }
      }
      @keyframes pin-float-label {
        0%, 100% {
          transform: translate(-50%, -100%) translateY(0px);
          opacity: 0.9;
        }
        50% {
          transform: translate(-50%, -100%) translateY(-2px);
          opacity: 1;
        }
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
  const [globeReady, setGlobeReady] = useState(false);
  const [globeSize, setGlobeSize] = useState({ width: 0, height: 0 });

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null);

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



  // Date range state (lifted from ControlPanel for report export)
  const today = new Date();
  const past = new Date();
  past.setDate(today.getDate() - 2);
  const [startDate, setStartDate] = useState(past.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  // Data state
  const [multiData, setMultiData] = useState({});
  const [stationList, setStationList] = useState([]);
  const [activeStationTab, setActiveStationTab] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCharts, setShowCharts] = useState(false);
  const [activeStation, setActiveStation] = useState(null);
  const [resolvedCoords, setResolvedCoords] = useState(null); // { lat, lng, code } for airports not in local DB

  // Tab state
  const [mainTab, setMainTab] = useState('observations');
  const [observationTab, setObservationTab] = useState('visibility');
  const [percentageTab, setPercentageTab] = useState('visibility_pct');
  const [resetKey, setResetKey] = useState(0);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [stationInput, setStationInput] = useState('');
  const [isDayTime, setIsDayTime] = useState(false);
  const [sunPos, setSunPos] = useState(() => getSunPosition(new Date()));

  const activeAirportObj = useMemo(() => {
    if (!activeStation) return null;
    const { airport } = findAirport(activeStation);
    
    if (airport) {
      if (airport.lat != null && airport.lng != null) return airport;
      // If airport is found but missing coords, merge resolvedCoords
      if (resolvedCoords) {
        return { ...airport, lat: resolvedCoords.lat, lng: resolvedCoords.lng };
      }
      // If we still have no coords, we can't show it on the globe
      return null;
    }
    
    // Fallback to API-resolved coordinates for entirely unknown airports
    if (resolvedCoords) {
      return {
        lat: resolvedCoords.lat,
        lng: resolvedCoords.lng,
        iata: resolvedCoords.code,
        icao: resolvedCoords.code,
        name: `${resolvedCoords.code}`
      };
    }
    return null;
  }, [activeStation, resolvedCoords]);

  const activeRoute = useMemo(() => {
    if (!activeAirportObj || activeAirportObj.lat == null) return [];
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
    if (activeAirportObj && activeAirportObj.lat != null && activeAirportObj.iata !== 'IST' && activeAirportObj.icao !== 'LTFM') {
      elements.push({
        lat: activeAirportObj.lat,
        lng: activeAirportObj.lng,
        type: 'destination',
        name: activeAirportObj.name,
        iata: activeAirportObj.iata || activeAirportObj.icao || '',
        isDayTime
      });
    }
    return elements;
  }, [activeAirportObj, isDayTime]);

  const data = activeStationTab ? multiData[activeStationTab] || [] : [];
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
            globeRef.current.pointOfView({ lat: 30, lng: 20, altitude: 2.5 }, 4000);
            startControlsLoop();
            clearInterval(interval);
            // Mark globe as ready after a short delay for smooth transition
            setTimeout(() => setGlobeReady(true), 800);
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
  // Accepts optional fallback coordinates { lat, lng } for airports not in local DB
  const zoomToAirport = useCallback((code, fallbackCoords) => {
    const { airport } = findAirport(code);
    const targetLat = airport?.lat ?? fallbackCoords?.lat;
    const targetLng = airport?.lng ?? fallbackCoords?.lng;

    if (targetLat != null && targetLng != null && globeRef.current) {
      // Stop auto-rotation during zoom
      try {
        globeRef.current.controls().autoRotate = false;
      } catch (e) { }
      // Zoom to the airport location
      globeRef.current.pointOfView(
        { lat: targetLat, lng: targetLng, altitude: 1.2 },
        2000
      );
      // After zoom completes, blur globe and show charts
      setTimeout(() => {
        setShowCharts(true);
      }, 2200);
    } else {
      // No coordinates available — just show charts directly
      setShowCharts(true);
    }
  }, []);

  // Close the analysis overlay and return to the globe
  const closeAnalysis = useCallback(() => {
    setShowCharts(false);
    // Resume auto-rotation after closing
    if (globeRef.current) {
      try {
        const controls = globeRef.current.controls();
        if (controls) {
          controls.autoRotate = true;
          controls.autoRotateSpeed = 0.12;
        }
        globeRef.current.pointOfView({ lat: 30, lng: 20, altitude: 2.5 }, 1500);
      } catch (e) { }
    }
  }, []);

  const fetchData = async (stationsArray, start, end) => {
    setStartDate(start);
    setEndDate(end);
    setLoading(true);
    setError(null);
    setShowCharts(false);

    try {
      const stationQueries = stationsArray.map(st => {
        const { icao } = findAirport(st);
        return icao || st.toUpperCase();
      });
      let allData = [];
      const chunkSize = 3;
      for (let i = 0; i < stationQueries.length; i += chunkSize) {
        const chunk = stationQueries.slice(i, i + chunkSize);
        const chunkString = chunk.join(',');
        const res = await fetch(`/api/metar?station=${chunkString}&start=${start}&end=${end}`);
        if (!res.ok) throw new Error('Failed to fetch data for some stations');
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        allData = allData.concat(json.data || []);
      }

      const newMultiData = {};
      stationsArray.forEach((st, idx) => {
        const searchCode = stationQueries[idx];
        newMultiData[st] = allData.filter(d => {
          if (!d.station) return true;
          const ds = d.station.toUpperCase();
          const sc = searchCode.toUpperCase();
          const rawSt = st.toUpperCase();
          return ds === sc || ds === rawSt || (sc.startsWith('K') && ds === sc.slice(1)) || (rawSt.startsWith('K') && ds === rawSt.slice(1)) || (ds.startsWith('K') && ds.slice(1) === rawSt);
        });
      });

      setMultiData(newMultiData);
      setStationList(stationsArray);
      setSelectedMonths([]); // Reset months filter on new data load
      
      const firstStation = stationsArray[0];
      setActiveStationTab(firstStation);
      setActiveStation(firstStation);

      // Extract lat/lon from API response for airports not in local DB or missing coords
      const firstData = newMultiData[firstStation];
      const { airport } = findAirport(firstStation);
      let fallbackCoords = null;
      if ((!airport || airport.lat == null) && firstData && firstData.length > 0) {
        const firstWithCoords = firstData.find(d => d.lat != null && d.lon != null);
        if (firstWithCoords) {
          fallbackCoords = { lat: firstWithCoords.lat, lng: firstWithCoords.lon };
          setResolvedCoords({ lat: firstWithCoords.lat, lng: firstWithCoords.lon, code: firstStation.toUpperCase() });
        }
      } else {
        setResolvedCoords(null);
      }

      // Zoom to the first airport
      zoomToAirport(firstStation, fallbackCoords);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoClick = () => {
    setMultiData({});
    setStationList([]);
    setActiveStationTab(null);
    setActiveStation(null);
    setResolvedCoords(null);
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
              <span className="top-title-brand">AeroNova</span>
              <span className="top-title-accent">Aviation Meteorology Analytics</span>
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
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
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
                      <span 
                        key={m} 
                        style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMonth(m);
                        }}
                      >
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
                onClick={() => { setMainTab('observations'); if (hasData) setShowCharts(true); }}
              >
                📋 Observations
              </button>
              <button
                className={`tab-btn ${mainTab === 'percentage' ? 'active' : ''}`}
                onClick={() => { setMainTab('percentage'); if (hasData) setShowCharts(true); }}
              >
                % Percentage
              </button>
              <button
                className={`tab-btn ${mainTab === 'charts' ? 'active' : ''}`}
                onClick={() => { setMainTab('charts'); if (hasData) setShowCharts(true); }}
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
                    onClick={() => { setObservationTab(tab.id); if (hasData) setShowCharts(true); }}
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
                    onClick={() => { setPercentageTab(tab.id); if (hasData) setShowCharts(true); }}
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
          {/* Top Right Navigation (Hamburger Menu) */}
          {(!showCharts || !hasData) && (
            <div style={{
              position: 'absolute',
              top: '24px',
              right: '32px',
              zIndex: 100,
              pointerEvents: 'auto'
            }}>
              {/* Hamburger Button */}
              <button 
                className="floating-pill-btn" 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                style={{ width: '48px', height: '48px', padding: 0, justifyContent: 'center' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <span style={{ width: '20px', height: '2px', background: '#fff', transition: '0.3s', transform: isMenuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
                  <span style={{ width: '20px', height: '2px', background: '#fff', transition: '0.3s', opacity: isMenuOpen ? 0 : 1 }} />
                  <span style={{ width: '20px', height: '2px', background: '#fff', transition: '0.3s', transform: isMenuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
                </div>
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: '56px',
                  right: 0,
                  background: 'rgba(20, 20, 20, 0.7)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: '160px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  animation: 'fadeIn 0.2s ease-out'
                }}>
                  <button 
                    className="dropdown-item"
                    onClick={() => { setActiveModal('guide'); setIsMenuOpen(false); }}
                    style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>📖</span> User Guide
                  </button>
                  <button 
                    className="dropdown-item"
                    onClick={() => { setActiveModal('contact'); setIsMenuOpen(false); }}
                    style={{ whiteSpace: 'nowrap', fontWeight: 'bold' }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>✉️</span> Contact
                  </button>
                </div>
              )}
            </div>
          )}


          {/* Loading Screen — only covers the globe area */}
          <div className={['loading-screen', globeReady && 'hidden'].filter(Boolean).join(' ')}>
            <div className="loading-content">
              <div className="loading-plane-track">
                <svg className="loading-plane" viewBox="0 0 24 24" width="40" height="40">
                  <path fill="currentColor" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L14 19v-5.5l8 2.5z"/>
                </svg>
                <div className="loading-plane-trail"></div>
              </div>
              <div className="loading-text">Preparing Globe</div>
              <div className="loading-dots">
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
                <span className="loading-dot"></span>
              </div>
            </div>
          </div>
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

          {/* Close Button — outside overlay so it doesn't scroll with content */}
          {showCharts && hasData && (
            <button
              className="chart-overlay-close"
              onClick={closeAnalysis}
              aria-label="Close analysis"
              title="Close"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          <div
            className={['chart-overlay', showCharts && hasData ? 'visible' : ''].filter(Boolean).join(' ')}
            onClick={(e) => {
              // Close when clicking the backdrop (not the content)
              if (e.target === e.currentTarget) closeAnalysis();
            }}
          >
            <div className="chart-overlay-content" onClick={(e) => e.stopPropagation()}>
              {hasData && stationList.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', overflowX: 'auto' }}>
                  {stationList.map(st => (
                    <button
                      key={st}
                      className={`tab-btn ${activeStationTab === st ? 'active' : ''}`}
                      onClick={() => {
                        setActiveStationTab(st);
                        setActiveStation(st);
                        const dataForSt = multiData[st];
                        const { airport } = findAirport(st);
                        let fallbackCoords = null;
                        if ((!airport || airport.lat == null) && dataForSt && dataForSt.length > 0) {
                          const firstWithCoords = dataForSt.find(d => d.lat != null && d.lon != null);
                          if (firstWithCoords) {
                            fallbackCoords = { lat: firstWithCoords.lat, lng: firstWithCoords.lon };
                            setResolvedCoords({ lat: firstWithCoords.lat, lng: firstWithCoords.lon, code: st });
                          }
                        } else {
                          setResolvedCoords(null);
                        }
                        zoomToAirport(st, fallbackCoords);
                      }}
                      style={{ padding: '6px 16px', fontSize: '14px', flexShrink: 0 }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}
              
              {hasData && mainTab === 'charts' && (
                <Charts data={processedData} startDate={startDate} endDate={endDate} />
              )}
              {hasData && mainTab === 'observations' && (
                <ObservationsView data={processedData} activeTab={observationTab} reportInfo={{ airport: activeStation, begin: startDate, end: endDate, selectedMonths }} />
              )}
              {hasData && mainTab === 'percentage' && (
                <PercentageView data={processedData} activeTab={percentageTab} reportInfo={{ airport: activeStation, begin: startDate, end: endDate, selectedMonths }} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {activeModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setActiveModal(null)}>
          <div 
            className="glass-container" 
            style={{ width: '90%', maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto', position: 'relative', padding: '24px' }}
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setActiveModal(null)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', zIndex: 10 }}
            >
              ✕
            </button>
            
            {activeModal === 'guide' && (
              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '20px', color: '#7dd3fc', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '2px solid rgba(125, 211, 252, 0.3)', paddingBottom: '10px' }}>
                  📖 AeroNova User Guide & Operational Manual
                </h2>
                
                <div style={{ color: '#e2e8f0', lineHeight: '1.7', fontSize: '0.92rem', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* Section 1 */}
                  <section style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 style={{ color: '#93c5fd', marginBottom: '8px', fontSize: '1.15rem', fontWeight: 600 }}>
                      1. What is AeroNova & What Does It Do?
                    </h3>
                    <p style={{ marginBottom: '8px' }}>
                      <strong>AeroNova</strong> is a comprehensive operational decision support system designed for aviation meteorology that processes, visualizes, and converts historical <strong>METAR (Meteorological Aerodrome Report)</strong> data into statistical analyses.
                    </p>
                    <p>
                      Critical parameters directly affecting flight safety—such as wind limits, visibility constraints, hazardous weather phenomena, and cloud ceiling—are presented via hourly, monthly, and yearly periodic charts and Excel reports.
                    </p>
                  </section>

                  {/* Section 2 */}
                  <section style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 style={{ color: '#93c5fd', marginBottom: '8px', fontSize: '1.15rem', fontWeight: 600 }}>
                      2. Basic Query & Filtering Logic
                    </h3>
                    <p style={{ marginBottom: '10px' }}>
                      Use the control panel on the left to set your analysis parameters:
                    </p>
                    <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <li>
                        <strong>Station (Airport Code):</strong> Enter the 4-letter <strong>ICAO</strong> code (e.g., <code>LTFM</code>, <code>LTAI</code>) or 3-letter <strong>IATA</strong> code (e.g., <code>IST</code>, <code>AYT</code>) of the airport you want to analyze.
                      </li>
                      <li>
                        <strong>Date Range (Start / End Date):</strong> Select the start and end dates from the calendar. Dropdown menus (<code>dropdownMode="select"</code>) are available for quick year and month navigation.
                      </li>
                      <li>
                        <strong>Months (Month Filter):</strong> Filter specific months of the year (e.g. Winter months: December, January, February). You can clear any selected month by clicking the <strong>✕ badge icon</strong>.
                      </li>
                      <li>
                        <strong>Mode Selection (Observations vs. Percentage %):</strong> 
                        <ul style={{ paddingLeft: '20px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <li>• <strong>Observations:</strong> Examines actual recorded values (temperature, wind speed, visibility) via trend graphs.</li>
                          <li>• <strong>Percentage (%):</strong> Calculates the percentage and probability of selected critical limits (e.g. Visibility &lt; 1000m or Wind &gt; 15kt) occurring out of the total METAR count.</li>
                        </ul>
                      </li>
                    </ul>
                  </section>

                  {/* Section 3 */}
                  <section style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 style={{ color: '#93c5fd', marginBottom: '8px', fontSize: '1.15rem', fontWeight: 600 }}>
                      3. Observations Tab Logic
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <strong style={{ color: '#f3f4f6' }}>• General Charts:</strong> Provides a high-level overview of thunderstorm (TSRA), high wind (&gt;50kt), low visibility, and temperature climatology for the airport.
                      </div>
                      <div>
                        <strong style={{ color: '#f3f4f6' }}>• Prevailing Wind (Wind Rose):</strong> Displays wind direction (0-360°) and speed distribution. Checking <em>Include Gusts</em> incorporates gust speeds into the analysis.
                      </div>
                      <div>
                        <strong style={{ color: '#f3f4f6' }}>• Visibility & Visibility Stations:</strong> Analyzes prevailing visibility trends over time. The <em>Visibility Stations</em> tab allows side-by-side comparison of multiple airports.
                      </div>
                      <div>
                        <strong style={{ color: '#f3f4f6' }}>• Temperature & Temp Without Value:</strong> 
                        Displays temperature trends. The <strong>Percentile (100%, 90%, 75%, 50%)</strong> filter in the <em>Temp Without Value</em> tab trims extreme outlier temperatures to reveal the airport's typical temperature regime. Chart labels are ordered from left to right as <code>Min</code>, <code>Avg</code>, <code>Max</code>.
                      </div>
                      <div>
                        <strong style={{ color: '#f3f4f6' }}>• Pressure & Pressure Without Value:</strong> Analyzes QNH (station pressure) variations and outlier trimming.
                      </div>
                      <div>
                        <strong style={{ color: '#f3f4f6' }}>• Phenomena (Weather Events & Precise Filtering):</strong> 
                        Scans weather codes (RA, SN, FG, TS, etc.) in raw METAR text. 
                        <br />
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                          * Precise Filtering Logic: For example, selecting <strong>TS</strong> and <strong>RA</strong> only matches METARs containing <strong>TSRA</strong>. If <strong>VC (Vicinity)</strong> is also selected, only <strong>VCTS</strong> reports are retrieved, excluding pure TSRA. Past weather events (RETSRA) are automatically filtered out.
                        </span>
                      </div>
                      <div>
                        <strong style={{ color: '#f3f4f6' }}>• Cloud Type & Ceiling:</strong> 
                        Analyzes hazardous cloud types such as <strong>CB (Cumulonimbus)</strong> and <strong>TCU (Towering Cumulus)</strong>, coverage amounts (<code>FEW</code>, <code>SCT</code>, <code>BKN</code>, <code>OVC</code>), and cloud ceiling constraints below specific altitudes (e.g., 1500ft).
                      </div>
                      <div>
                        <strong style={{ color: '#f3f4f6' }}>• Head-Tail Wind (Wind Components):</strong> 
                        Calculates <strong>Headwind</strong>, <strong>Tailwind</strong>, and <strong>Crosswind</strong> vector components relative to the selected runway orientation (e.g., 06R/24L).
                      </div>
                    </div>
                  </section>

                  {/* Section 4 */}
                  <section style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 style={{ color: '#93c5fd', marginBottom: '12px', fontSize: '1.15rem', fontWeight: 600 }}>
                      4. Risk & Percentage (%) Calculation Formulas
                    </h3>
                    
                    {/* Percentage Tabs Formulas */}
                    <div style={{ marginBottom: '16px', background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      <h4 style={{ color: '#6ee7b7', fontSize: '0.98rem', fontWeight: 600, marginBottom: '6px' }}>
                        📈 A) Percentage (%) Tabs Calculation Formulas (Hourly, Monthly, Yearly):
                      </h4>
                      <p style={{ fontSize: '0.88rem', color: '#cbd5e1', marginBottom: '10px' }}>
                        Calculations in Percentage tabs are performed across 3 dimensions based on the selected Time Group:
                      </p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.86rem' }}>
                        <div>
                          <strong style={{ color: '#a7f3d0' }}>1. Hourly Percentage (%):</strong>
                          <code style={{ display: 'block', background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: '4px', color: '#6ee7b7', marginTop: '3px' }}>
                            Hourly Percentage (%) = (Number of METAR/SPECI reports with phenomenon at specific hour (00..23) / Total METAR/SPECI reports published at that hour) × 100
                          </code>
                        </div>

                        <div>
                          <strong style={{ color: '#a7f3d0' }}>2. Monthly Percentage (%):</strong>
                          <code style={{ display: 'block', background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: '4px', color: '#6ee7b7', marginTop: '3px' }}>
                            Monthly Percentage (%) = (Number of days with phenomenon observed in a specific month (Jan..Dec) / Total days with METAR/SPECI published in that month) × 100
                          </code>
                        </div>

                        <div>
                          <strong style={{ color: '#a7f3d0' }}>3. Yearly Percentage (%):</strong>
                          <code style={{ display: 'block', background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: '4px', color: '#6ee7b7', marginTop: '3px' }}>
                            Yearly Percentage (%) = (Number of days with phenomenon observed in a specific year / Total days with METAR/SPECI published in that year) × 100
                          </code>
                        </div>
                      </div>
                    </div>

                    {/* General Charts Risk Formula */}
                    <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                      <h4 style={{ color: '#7dd3fc', fontSize: '0.98rem', fontWeight: 600, marginBottom: '6px' }}>
                        📊 B) General Charts Risk Formula (Day-Based Probability):
                      </h4>
                      <p style={{ fontSize: '0.88rem', color: '#cbd5e1', marginBottom: '8px' }}>
                        Used in <em>Visibility Risk</em>, <em>High Wind Risk (&gt;50KT)</em>, and <em>TSRA Risk</em> charts in General Charts. It is based on the number of days in a month where the adverse condition occurred at least once:
                      </p>
                      <code style={{ display: 'block', background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '6px', color: '#7dd3fc', fontSize: '0.85rem', textAlign: 'center', fontWeight: 600 }}>
                        Monthly Risk (%) = (Number of days with at least 1 METAR exceeding threshold in month / Total days with observations in that month) × 100
                      </code>
                    </div>

                    <div style={{ marginTop: '14px', fontSize: '0.88rem', color: '#cbd5e1' }}>
                      <strong style={{ color: '#f3f4f6' }}>Analysis Tabs Summary:</strong>
                      <ul style={{ listStyle: 'disc', paddingLeft: '20px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <li><strong>% Phenomena:</strong> Indicates the percentage of total time weather phenomena (fog, rain, snow, thunderstorm) occur.</li>
                        <li><strong>% Cloud Type & Ceiling:</strong> Displays the probability of hazardous clouds or low cloud ceilings constraining operations.</li>
                        <li><strong>% Head-Tail Wind:</strong> Presents the risk percentage of tailwind or crosswind limits being exceeded on a selected runway.</li>
                        <li><strong>% Vis + Head-Tail Wind:</strong> Calculates the percentage ratio of critical scenarios where wind limits are exceeded while visibility drops simultaneously.</li>
                      </ul>
                    </div>
                  </section>

                  {/* Section 5 */}
                  <section style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <h3 style={{ color: '#93c5fd', marginBottom: '8px', fontSize: '1.15rem', fontWeight: 600 }}>
                      5. Exporting Capabilities
                    </h3>
                    <ul style={{ listStyle: 'disc', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <li>
                        <strong>📈 Export Graph:</strong> Saves the currently displayed graph as a high-resolution PNG image on your device.
                      </li>
                      <li>
                        <strong>📊 Export Report:</strong> 
                        Downloads all data for the active tab as an Excel file (.xlsx) formatted with yearly and monthly cross-tables (<code>{'{YEAR}'}/Months</code>). A query parameter summary header is placed at the top of the file.
                      </li>
                    </ul>
                  </section>

                </div>
              </div>
            )}

            {activeModal === 'contact' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '16px', color: '#fff' }}>✉️ Contact Us</h2>
                <div style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.95rem' }}>
                  <p style={{ marginBottom: '16px' }}>
                    For your feedback, suggestions, and questions, you can contact us at the following email addresses:
                  </p>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '1.2rem' }}>📧</span>
                      <a href="mailto:METAR@THY.COM" style={{ color: '#749bed', textDecoration: 'none', fontWeight: 500, letterSpacing: '0.5px' }}>METAR@THY.COM</a>
                    </div>
                    
                    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '1.2rem' }}>📧</span>
                      <a href="mailto:BEGUMA@THY.COM" style={{ color: '#749bed', textDecoration: 'none', fontWeight: 500, letterSpacing: '0.5px' }}>BEGUMA@THY.COM</a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </main>
  );
}
