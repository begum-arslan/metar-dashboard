"use client";
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO } from 'date-fns';
import { generateOpsmetPctReport } from '@/utils/excelExport';
import { exportGraphAsPNG } from '@/utils/exportGraph';

const INTENSITIES = [
  { value: 'All', label: 'All Intensities' },
  { value: 'light', label: '(-) Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'heavy', label: '(+) Heavy' }
];

const DESCRIPTORS = [
  { value: 'none', label: '(None) No Description' },
  { value: 'blowing', label: '(BL) Blowing' },
  { value: 'shallow', label: '(MI) Shallow' },
  { value: 'patches', label: '(BC) Patches' },
  { value: 'freezing', label: '(FZ) Freezing' },
  { value: 'partial', label: '(PR) Partial' },
  { value: 'shower', label: '(SH) Showers' },
  { value: 'low drifting', label: '(DR) Drifting' },
  { value: 'thunderstorm', label: '(TS) Thunderstorm' }
];

const DESC_TO_CODE = {
  'blowing': 'BL', 'shallow': 'MI', 'patches': 'BC', 'freezing': 'FZ',
  'partial': 'PR', 'shower': 'SH', 'low drifting': 'DR', 'thunderstorm': 'TS'
};

const PHENOMENAS = [
  { value: 'All', label: 'All Phenomena' },
  { value: 'SN', label: 'SN' },
  { value: 'RA', label: 'RA' },
  { value: 'FG', label: 'FG' },
  { value: 'IC', label: 'IC' },
  { value: 'SS', label: 'SS' },
  { value: 'SG', label: 'SG' },
  { value: 'GR', label: 'GR' },
  { value: 'BR', label: 'BR' },
  { value: 'DZ', label: 'DZ' },
  { value: 'SA', label: 'SA' },
  { value: 'SQ', label: 'SQ' },
  { value: 'FC', label: 'FC' },
  { value: 'DU', label: 'DU' },
  { value: 'PL', label: 'PL' },
  { value: 'VA', label: 'VA' },
  { value: 'GS', label: 'GS' },
  { value: 'HZ', label: 'HZ' },
  { value: 'PO', label: 'PO' },
  { value: 'FU', label: 'FU' },
  { value: 'DS', label: 'DS' }
];

// Known combined phenomena tokens
const COMBINED_TOKENS = ['SNRA', 'RASN', 'DZRA', 'RADZ'];

function getEffectivePhenomena(selectedList, isCombine) {
  if (!isCombine || selectedList.length < 2) return selectedList;
  // Combine all selected codes in order into a single token
  const combined = selectedList.join('');
  return [combined];
}

const ALL_DESCRIPTOR_CODES = ['TS', 'SH', 'FZ', 'BL', 'MI', 'BC', 'PR', 'DR'];
const ALL_PHENOMENA_CODES = ['RA', 'SN', 'DZ', 'FG', 'BR', 'HZ', 'SQ', 'FC', 'SS', 'DS', 'GR', 'GS', 'PL', 'SG', 'IC', 'DU', 'SA', 'VA', 'PO', 'FU'];

function matchMetarToken(rawToken, { appliedIntensity, appliedIncludeVC, appliedDescriptions, appliedPhenomena }) {
  let t = rawToken.trim().toUpperCase();
  if (!t || t.startsWith('RE')) return false;

  const isVC = t.startsWith('VC');
  if (appliedIncludeVC && !isVC) return false;
  if (!appliedIncludeVC && isVC) return false;

  if (t.startsWith('+') || t.startsWith('-')) {
    const prefix = t[0];
    if (appliedIntensity === 'light' && prefix !== '-') return false;
    if (appliedIntensity === 'heavy' && prefix !== '+') return false;
    if (appliedIntensity === 'moderate') return false;
    t = t.slice(1);
  } else if (isVC) {
    t = t.slice(2);
  } else {
    if (appliedIntensity === 'light' || appliedIntensity === 'heavy') return false;
  }

  const selectedDescCodes = (appliedDescriptions || []).map(d => DESC_TO_CODE[d]).filter(Boolean);
  const isNoneDescSelected = (appliedDescriptions || []).includes('none');
  const hasAnySelectedDesc = selectedDescCodes.length > 0;

  if (hasAnySelectedDesc && !isNoneDescSelected) {
    if (!selectedDescCodes.some(code => t.includes(code))) return false;
  } else if (isNoneDescSelected && !hasAnySelectedDesc) {
    if (ALL_DESCRIPTOR_CODES.some(code => t.includes(code))) return false;
  } else if (hasAnySelectedDesc && isNoneDescSelected) {
    const hasSelected = selectedDescCodes.some(code => t.includes(code));
    const hasAnyDesc = ALL_DESCRIPTOR_CODES.some(code => t.includes(code));
    if (hasAnyDesc && !hasSelected) return false;
  }

  const hasSelectedPhenomena = appliedPhenomena && appliedPhenomena.length > 0;

  if (hasSelectedPhenomena) {
    let phenomMatch = appliedPhenomena.some(phenom => {
      // Check if this is a combined token (e.g. SNRA, RASN, DZRA, RADZ)
      if (COMBINED_TOKENS.includes(phenom) || phenom.length > 2) {
        return t.includes(phenom);
      }
      // Single phenomena: exclude combined tokens that contain this code
      if (phenom === 'RA') return t.includes('RA') && !t.includes('RASN') && !t.includes('SNRA') && !t.includes('DZRA') && !t.includes('RADZ');
      if (phenom === 'SN') return t.includes('SN') && !t.includes('RASN') && !t.includes('SNRA');
      if (phenom === 'DZ') return t.includes('DZ') && !t.includes('DZRA') && !t.includes('RADZ');
      return t.includes(phenom);
    });
    if (!phenomMatch) return false;

    // Prevent false positives: if token contains SN/RA/DZ but those aren't in the filter, reject
    if (t.includes('SN') && !appliedPhenomena.includes('SN') && !appliedPhenomena.some(p => p.includes('SN'))) return false;
    if (t.includes('RA') && !appliedPhenomena.includes('RA') && !appliedPhenomena.some(p => p.includes('RA'))) return false;
    if (t.includes('DZ') && !appliedPhenomena.includes('DZ') && !appliedPhenomena.some(p => p.includes('DZ'))) return false;
  } else {
    const hasAnyDescFilterActive = (appliedDescriptions && appliedDescriptions.length > 0);
    if (hasAnyDescFilterActive && !isNoneDescSelected) {
      if (ALL_PHENOMENA_CODES.some(code => t.includes(code))) return false;
    }
  }

  return true;
}

export default function PhenomenaPctTab({ data, reportInfo }) {
  const chartRef = useRef(null);
  const descRef = useRef(null);
  const phenomRef = useRef(null);
  const [intensity, setIntensity] = useState('All');
  const [includeVC, setIncludeVC] = useState(false);
  const [selectedDescriptions, setSelectedDescriptions] = useState([]);
  const [selectedPhenomena, setSelectedPhenomena] = useState([]);
  const [combineMode, setCombineMode] = useState(false);
  
  const [appliedIntensity, setAppliedIntensity] = useState('All');
  const [appliedIncludeVC, setAppliedIncludeVC] = useState(false);
  const [appliedDescriptions, setAppliedDescriptions] = useState(null);
  const [appliedPhenomena, setAppliedPhenomena] = useState(null);
  
  const [isDescOpen, setIsDescOpen] = useState(false);
  const [isPhenomenaOpen, setIsPhenomenaOpen] = useState(false);
  const [timeGroup, setTimeGroup] = useState('Hourly'); // 'Hourly', 'Monthly', 'Yearly'

  // Preview of combined phenomena string
  const combinedPreview = combineMode && selectedPhenomena.length >= 2
    ? selectedPhenomena.join('')
    : null;

  useEffect(() => {
    function handleClickOutside(event) {
      if (descRef.current && !descRef.current.contains(event.target)) {
        setIsDescOpen(false);
      }
      if (phenomRef.current && !phenomRef.current.contains(event.target)) {
        setIsPhenomenaOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleRun = () => {
    setAppliedIntensity(intensity);
    setAppliedIncludeVC(includeVC);
    setAppliedDescriptions([...selectedDescriptions]);
    setAppliedPhenomena(getEffectivePhenomena([...selectedPhenomena], combineMode));
  };

  const handleClear = () => {
    setIntensity('All');
    setIncludeVC(false);
    setSelectedDescriptions([]);
    setSelectedPhenomena([]);
    setCombineMode(false);
    setAppliedIntensity('All');
    setAppliedIncludeVC(false);
    setAppliedDescriptions(null);
    setAppliedPhenomena(null);
  };

  const { chartData, totalRecords, totalCriteria, totalMetar } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], totalRecords: 0, totalCriteria: 0, totalMetar: 0 };

    // Parse dates
    const parsed = data.map(d => {
      try {
        const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
        const dt = parseISO(dateStr);
        if (isNaN(dt.getTime())) return null;
        
        // Exact Phenomenon Check via raw tokens
        let phenomPass = true;
        if (appliedPhenomena && appliedPhenomena.length > 0) {
          const rawStr = (d.raw || '').replace(/\s+(TEMPO|BECMG|NOSIG|PROB30|PROB40)\b.*/i, '');
          const cleanStr = d.station ? rawStr.replace(new RegExp('\\b' + d.station + '\\b', 'gi'), '') : rawStr;
          const rawTokens = cleanStr.split(/\s+/);
          phenomPass = rawTokens.some(t => {
            if (t.startsWith('RE')) return false;
            const phenomMatch = appliedPhenomena.some(phenom => {
              // Check if this is a combined token (e.g. SNRA, RASN, DZRA, RADZ)
              if (COMBINED_TOKENS.includes(phenom) || phenom.length > 2) {
                return t.includes(phenom);
              }
              if (phenom === 'RA') return t.includes('RA') && !t.includes('RASN') && !t.includes('SNRA') && !t.includes('DZRA') && !t.includes('RADZ');
              if (phenom === 'SN') return t.includes('SN') && !t.includes('RASN') && !t.includes('SNRA');
              if (phenom === 'DZ') return t.includes('DZ') && !t.includes('DZRA') && !t.includes('RADZ');
              return t.includes(phenom);
            });
            if (!phenomMatch) return false;
            if (appliedDescriptions && appliedDescriptions.length > 0) {
              const descCodes = appliedDescriptions.map(d => DESC_TO_CODE[d]).filter(Boolean);
              if (descCodes.length > 0 && !appliedDescriptions.includes('none')) {
                return descCodes.some(code => t.includes(code));
              }
              if (appliedDescriptions.includes('none')) {
                const allCodes = Object.values(DESC_TO_CODE);
                const hasNoDesc = !allCodes.some(code => t.includes(code));
                if (hasNoDesc) return true;
                if (descCodes.length > 0) return descCodes.some(code => t.includes(code));
              }
            }
            return true;
          });
        }
        
        let meetsCriteria = false;
        if (phenomPass) {
          if (!d.weather || d.weather.length === 0) {
            // If metar-parser didn't parse anything, but we already matched the raw phenom (e.g. SS, PL, DS)
            if (appliedPhenomena && appliedPhenomena.length > 0 && appliedIntensity === 'All' && (!appliedDescriptions || appliedDescriptions.length === 0 || appliedDescriptions.includes('none'))) {
              meetsCriteria = true;
            }
          } else {
            meetsCriteria = d.weather.some(w => {
              const isVC = w.intensity === 'VC' || w.intensity === 'in the vicinity';
              const matchInt = appliedIntensity === 'All' 
                ? (appliedIncludeVC ? true : !isVC) 
                : (appliedIntensity === 'VC' ? isVC : (w.intensity === appliedIntensity || (appliedIntensity === 'moderate' && !w.intensity && !isVC)));
              const matchDesc = (!appliedDescriptions || appliedDescriptions.length === 0) || 
                appliedDescriptions.some(desc => {
                  if (desc === 'none') return !w.descriptor;
                  return w.descriptor === desc;
                });
              // If appliedPhenom is set, we already verified it exists in raw tokens.
              return matchInt && matchDesc;
            });
          }
        }
        
        return { ...d, _dt: dt, _meetsCriteria: meetsCriteria };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    const records = parsed.length;

    // Initialize buckets
    let buckets = {};
    if (timeGroup === 'Hourly') {
      for (let i = 0; i < 24; i++) {
        buckets[i] = { label: String(i), metarRec: 0, criteriaRec: 0 };
      }
    } else if (timeGroup === 'Monthly') {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      for (let i = 0; i < 12; i++) {
        buckets[i] = { label: months[i], metarRec: 0, criteriaRec: 0 };
      }
    }
    // Yearly created dynamically

    parsed.forEach(d => {
      let key = null;
      if (timeGroup === 'Hourly') {
        key = d._dt.getUTCHours();
      } else if (timeGroup === 'Monthly') {
        key = d._dt.getUTCMonth();
      } else if (timeGroup === 'Yearly') {
        key = d._dt.getUTCFullYear();
        if (!buckets[key]) {
          buckets[key] = { label: String(key), metarRec: 0, criteriaRec: 0 };
        }
      }

      if (key !== null) {
        buckets[key].metarRec++;

        // Criteria check
        let criteriaMet = false;
        const rawStr = (d.raw || '').replace(/\s+(TEMPO|BECMG|NOSIG|PROB30|PROB40)\b.*/i, '');
        const cleanStr = d.station ? rawStr.replace(new RegExp('\\b' + d.station + '\\b', 'gi'), '') : rawStr;
        const rawTokens = cleanStr.split(/\s+/);

        const hasMatchingToken = rawTokens.some(t => matchMetarToken(t, { appliedIntensity, appliedIncludeVC, appliedDescriptions, appliedPhenomena }));
        if (hasMatchingToken) {
          criteriaMet = true;
        } else if (d.weather && d.weather.length > 0) {
          criteriaMet = d.weather.some(w => {
            const isVC = w.intensity === 'VC' || w.intensity === 'in the vicinity';
            if (appliedIncludeVC && !isVC) return false;
            if (!appliedIncludeVC && isVC) return false;

            const matchInt = appliedIntensity === 'All' 
              ? true 
              : (w.intensity === appliedIntensity || (appliedIntensity === 'moderate' && !w.intensity));

            const matchDesc = (!appliedDescriptions || appliedDescriptions.length === 0) || 
              appliedDescriptions.some(desc => {
                if (desc === 'none') return !w.descriptor;
                return w.descriptor === desc;
              });

            let matchPhen = true;
            if (appliedPhenomena && appliedPhenomena.length > 0) {
              matchPhen = appliedPhenomena.some(ph => {
                if (ph === 'RA') return w.precipitation === 'rain';
                if (ph === 'SN') return w.precipitation === 'snow';
                if (ph === 'FG') return w.obscuration === 'fog';
                if (ph === 'BR') return w.obscuration === 'mist';
                if (ph === 'HZ') return w.obscuration === 'haze';
                if (ph === 'DZ') return w.precipitation === 'drizzle';
                // Combined tokens (SNRA, RASN, DZRA, RADZ etc.) are handled via raw token matching
                if (ph.length > 2) return false;
                return true;
              });
            } else if (appliedDescriptions && appliedDescriptions.length > 0 && !appliedDescriptions.includes('none')) {
              if (appliedDescriptions.includes('thunderstorm') && w.descriptor === 'thunderstorm') {
                if (w.precipitation) return false;
              }
            }

            return matchInt && matchDesc && matchPhen;
          });
        }
        
        if (criteriaMet) {
          buckets[key].criteriaRec++;
        }
      }
    });

    // Build result
    const keys = Object.keys(buckets).sort((a, b) => parseInt(a) - parseInt(b));
    
    let critTotal = 0;
    let metTotal = 0;

    const result = keys.map(keyStr => {
      const mRec = buckets[keyStr].metarRec;
      const cRec = buckets[keyStr].criteriaRec;
      
      const rate = mRec > 0 ? parseFloat((cRec / mRec).toFixed(4)) : 0;
      
      critTotal += cRec;
      metTotal += mRec;

      return {
        label: buckets[keyStr].label,
        Rate: rate,
        criteriaRec: cRec,
        metarRec: mRec
      };
    });

    return { chartData: result, totalRecords: records, totalCriteria: critTotal, totalMetar: metTotal };
  }, [data, appliedIntensity, appliedDescriptions, appliedPhenomena, timeGroup]);

  return (
    <div style={{ marginTop: '16px' }}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" style={{ marginBottom: '24px' }}>
        
        {/* Sidebar Filters */}
        <div className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="intensityPct">Intensity</label>
            <select id="intensityPct" className={intensity === 'All' ? 'select-default' : ''} value={intensity} onChange={e => setIntensity(e.target.value)}>
              {INTENSITIES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
            <input 
              type="checkbox" 
              id="includeVCPct" 
              checked={includeVC} 
              onChange={e => setIncludeVC(e.target.checked)} 
              style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
            />
            <label htmlFor="includeVCPct" style={{ margin: 0, cursor: 'pointer', fontSize: '0.8rem' }}>Include VC (Vicinity)</label>
          </div>
          
          <div className="form-group" ref={descRef} style={{ marginBottom: 0, position: 'relative' }}>
            <label>Description</label>
            <div 
              onClick={() => setIsDescOpen(!isDescOpen)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {selectedDescriptions.length === 0 ? (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>All Descriptions</span>
                ) : (
                  selectedDescriptions.map(desc => {
                    const labelStr = DESCRIPTORS.find(d => d.value === desc)?.label.split(' ')[0] || desc;
                    return (
                      <span key={desc} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }} onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDescriptions(prev => prev.filter(d => d !== desc));
                      }}>{labelStr} ✕</span>
                    );
                  })
                )}
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>▼</span>
            </div>
            {isDescOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1a1a1a', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {DESCRIPTORS.map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.8rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 'normal', color: '#e2e8f0' }}>
                    <input type="checkbox" checked={selectedDescriptions.includes(opt.value)} onChange={() => {
                      setSelectedDescriptions(prev => prev.includes(opt.value) ? prev.filter(d => d !== opt.value) : [...prev, opt.value]);
                    }} style={{ margin: 0 }} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="form-group" ref={phenomRef} style={{ marginBottom: 0, position: 'relative' }}>
            <label>Weather Phenomena</label>
            <div 
              onClick={() => setIsPhenomenaOpen(!isPhenomenaOpen)}
              style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--card-border)', background: 'rgba(255, 255, 255, 0.05)', color: '#ffffff', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {selectedPhenomena.length === 0 ? (
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>All Phenomena</span>
                ) : (
                  selectedPhenomena.map(ph => (
                    <span key={ph} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }} onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPhenomena(prev => prev.filter(p => p !== ph));
                    }}>{ph} ✕</span>
                  ))
                )}
              </div>
              <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>▼</span>
            </div>
            {isPhenomenaOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1a1a1a', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '8px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {PHENOMENAS.map(opt => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontSize: '0.8rem', textTransform: 'none', letterSpacing: 'normal', fontWeight: 'normal', color: '#e2e8f0' }}>
                    <input type="checkbox" checked={selectedPhenomena.includes(opt.value)} onChange={() => {
                      setSelectedPhenomena(prev => prev.includes(opt.value) ? prev.filter(p => p !== opt.value) : [...prev, opt.value]);
                    }} style={{ margin: 0 }} />
                    <span>{opt.label}</span>
                    {combineMode && selectedPhenomena.includes(opt.value) && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#60a5fa', fontWeight: 600 }}>
                        {selectedPhenomena.indexOf(opt.value) + 1}.
                      </span>
                    )}
                  </label>
                ))}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 0, marginTop: '8px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
              <input 
                type="checkbox" 
                id="combineModeP" 
                checked={combineMode} 
                onChange={e => { setCombineMode(e.target.checked); setIsPhenomenaOpen(false); }} 
                style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
              />
              <label htmlFor="combineModeP" style={{ margin: 0, cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap', color: combineMode ? '#60a5fa' : 'inherit' }}>Combine</label>
            </div>

            {combinedPreview && (
              <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '4px', padding: '6px 10px', background: 'rgba(52, 211, 153, 0.1)', borderRadius: '6px', border: '1px solid rgba(52, 211, 153, 0.2)' }}>
                → Search for: <strong>{combinedPreview}</strong>
              </div>
            )}

            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.2' }}>
              {combineMode 
                ? '* In Combine mode, selection order matters. Selected phenomena are concatenated in order.' 
                : '* In normal mode, selections are searched independently (OR logic).'
              }
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn-primary" style={{ flex: 1, minWidth: 0 }} onClick={handleRun}>▶ Run</button>
            <button className="btn-primary" style={{ flex: 1, minWidth: 0, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }} onClick={handleClear}>✕ Clear</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button 
              className="btn-primary" 
              style={{ flex: 1, minWidth: 0, padding: '6px 12px', fontSize: '13px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', color: '#ffffff', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
              onClick={() => exportGraphAsPNG(chartRef, 'PhenomenaPctTab.png')}
            >
              📈 Export Graph
            </button>
            <button 
              className="btn-primary" 
              style={{ flex: 1, minWidth: 0, padding: '6px 12px', fontSize: '13px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#ffffff', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
              onClick={() => {
                if (!reportInfo) return;
              generateOpsmetPctReport({
                analysis: 'Phenomena',
                airport: reportInfo.airport,
                begin: reportInfo.begin,
                end: reportInfo.end,
                selectedMonths: reportInfo.selectedMonths,
                data,
                extraParams: { INTENSITY: appliedIntensity, DESCRIPTOR: appliedDescriptions ? appliedDescriptions.join(',') : 'All', PHENOMENA: appliedPhenomena ? appliedPhenomena.join(',') : 'All' },
                criteriaFn: (d) => {
                  const rawStr = (d.raw || '').replace(/\s+(TEMPO|BECMG|NOSIG|PROB30|PROB40)\b.*/i, '');
                  const cleanStr = d.station ? rawStr.replace(new RegExp('\\b' + d.station + '\\b', 'gi'), '') : rawStr;
                  const rawTokens = cleanStr.split(/\s+/);

                  const hasMatchingToken = rawTokens.some(t => matchMetarToken(t, { appliedIntensity, appliedIncludeVC, appliedDescriptions, appliedPhenomena }));
                  if (hasMatchingToken) return true;

                  if (d.weather && d.weather.length > 0) {
                    return d.weather.some(w => {
                      const isVC = w.intensity === 'VC' || w.intensity === 'in the vicinity';
                      if (appliedIncludeVC && !isVC) return false;
                      if (!appliedIncludeVC && isVC) return false;

                      const matchInt = appliedIntensity === 'All' 
                        ? true 
                        : (w.intensity === appliedIntensity || (appliedIntensity === 'moderate' && !w.intensity));

                      const matchDesc = (!appliedDescriptions || appliedDescriptions.length === 0) || 
                        appliedDescriptions.some(desc => {
                          if (desc === 'none') return !w.descriptor;
                          return w.descriptor === desc;
                        });

                      let matchPhen = true;
                      if (appliedPhenomena && appliedPhenomena.length > 0) {
                        matchPhen = appliedPhenomena.some(ph => {
                          if (ph === 'RA') return w.precipitation === 'rain';
                          if (ph === 'SN') return w.precipitation === 'snow';
                          if (ph === 'FG') return w.obscuration === 'fog';
                          if (ph === 'BR') return w.obscuration === 'mist';
                          if (ph === 'HZ') return w.obscuration === 'haze';
                          if (ph === 'DZ') return w.precipitation === 'drizzle';
                          // Combined tokens are handled via raw token matching
                          if (ph.length > 2) return false;
                          return true;
                        });
                      } else if (appliedDescriptions && appliedDescriptions.length > 0 && !appliedDescriptions.includes('none')) {
                        if (appliedDescriptions.includes('thunderstorm') && w.descriptor === 'thunderstorm') {
                          if (w.precipitation) return false;
                        }
                      }

                      return matchInt && matchDesc && matchPhen;
                    });
                  }

                  return false;
                },
              });
              }}
            >
              📊 Export Report
            </button>
          </div>
        </div>
        
        {/* Chart Area */}
        <div ref={chartRef} className="glass-container md:col-span-3" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div className="tabs-container" style={{ borderBottom: 'none', paddingBottom: 0, margin: 0 }}>
              {['Hourly', 'Monthly', 'Yearly'].map(tg => (
                <button 
                  key={tg} 
                  className={`tab-btn sub-tab-btn ${timeGroup === tg ? 'active' : ''}`}
                  onClick={() => setTimeGroup(tg)}
                >
                  {tg}
                </button>
              ))}
            </div>
            <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Phenomena Query % (Totals For: Records / Criteria / Metar: {totalRecords} / {totalCriteria} / {totalMetar})
            </div>
          </div>
          
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 25, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke="var(--text-muted)" 
                  tick={{ fill: 'var(--text-muted)' }} 
                  label={{ value: timeGroup === 'Hourly' ? 'Hours' : timeGroup === 'Monthly' ? 'Months' : 'Years', position: 'insideBottom', offset: -10, fill: 'var(--text-muted)' }}
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  tick={{ fill: 'var(--text-muted)' }} 
                  tickFormatter={(val) => parseFloat((val * 100).toFixed(2))}
                  label={{ value: 'Ratio(Criteria Rec./Metar Rec.)', angle: -90, position: 'insideLeft', offset: -15, fill: 'var(--text-muted)', style: { textAnchor: 'middle' } }}
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--card-border)', borderRadius: '8px' }} 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  formatter={(value, name, props) => [
                    `${(value * 100).toFixed(2)}% (${props.payload.criteriaRec}/${props.payload.metarRec})`, 
                    'Ratio'
                  ]}
                />
                <Legend verticalAlign="top" height={36} iconType="rect" align="center" wrapperStyle={{ marginBottom: '16px' }} />
                
                <Bar dataKey="Rate" fill="#fb7185" name="Ratio" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

        </div>
      </div>
    </div>
  );
}
