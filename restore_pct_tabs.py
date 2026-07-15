import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

PCT_LOGIC = {
    'VisibilityPctTab.js': """if (!reportInfo) return;
              generateOpsmetPctReport({
                analysis: 'Visibility',
                airport: reportInfo.airport,
                begin: reportInfo.begin,
                end: reportInfo.end,
                selectedMonths: reportInfo.selectedMonths,
                data,
                extraParams: { VISIBILITY: appliedThreshold },
                criteriaFn: (d) => d.visibility !== null && d.visibility <= appliedThreshold,
              });""",
              
    'CeilingPctTab.js': """if (!reportInfo || appliedThreshold === null) return;
              const targetCovs = appliedCoverages.length > 0 ? appliedCoverages : COVERAGES;
              generateOpsmetPctReport({
                analysis: 'Ceiling',
                airport: reportInfo.airport,
                begin: reportInfo.begin,
                end: reportInfo.end,
                selectedMonths: reportInfo.selectedMonths,
                data,
                extraParams: { ALTITUDE: appliedThreshold, COVERAGE: targetCovs.join(',') },
                criteriaFn: (d) => {
                  if (!d.clouds || !Array.isArray(d.clouds)) return false;
                  const layers = d.clouds.filter(c => targetCovs.includes(c.code));
                  if (layers.length === 0) return false;
                  return Math.min(...layers.map(c => c.altitude)) <= appliedThreshold;
                },
              });""",
              
    'PhenomenaPctTab.js': """if (!reportInfo) return;
              generateOpsmetPctReport({
                analysis: 'Phenomena',
                airport: reportInfo.airport,
                begin: reportInfo.begin,
                end: reportInfo.end,
                selectedMonths: reportInfo.selectedMonths,
                data,
                extraParams: { INTENSITY: appliedIntensity, DESCRIPTOR: appliedDesc, PHENOMENA: appliedPhenom },
                criteriaFn: (d) => {
                  if (!d.weather || d.weather.length === 0) return false;
                  return d.weather.some(w => {
                    const matchInt = appliedIntensity === 'All' || w.intensity === appliedIntensity || (appliedIntensity === 'moderate' && !w.intensity);
                    const matchDesc = appliedDesc === 'All' || w.descriptor === appliedDesc;
                    const matchPhen = appliedPhenom === 'All' || w.precipitation === appliedPhenom || w.obscuration === appliedPhenom || w.other === appliedPhenom;
                    return matchInt && matchDesc && matchPhen;
                  });
                },
              });""",
              
    'HeadTailWindPctTab.js': """if (!reportInfo || !appliedFilters) return;
              const { runway, component, windType, minSpeed, maxSpeed } = appliedFilters;
              generateOpsmetPctReport({
                analysis: 'Head-Tail Wind',
                airport: reportInfo.airport,
                begin: reportInfo.begin,
                end: reportInfo.end,
                selectedMonths: reportInfo.selectedMonths,
                data,
                extraParams: { RUNWAY: runway, COMPONENT: component, WIND_TYPE: windType, MIN_SPEED: minSpeed, MAX_SPEED: maxSpeed },
                criteriaFn: (d) => {
                  if (typeof d.windDirection !== 'number') return false;
                  const speed = windType === 'Gust' ? (d.windGust || 0) : (d.windSpeed || 0);
                  const angleDiffRad = (d.windDirection - runway) * Math.PI / 180;
                  const headwind = speed * Math.cos(angleDiffRad);
                  const crosswind = Math.abs(speed * Math.sin(angleDiffRad));
                  const tailwind = -headwind;
                  let val = 0;
                  if (component === 'Head') val = headwind;
                  else if (component === 'Tail') val = tailwind;
                  else if (component === 'Cross') val = crosswind;
                  return val > 0 && val >= minSpeed && val <= maxSpeed;
                },
              });""",
              
    'VisHeadTailPctTab.js': """if (!reportInfo || !appliedFilters) return;
              const { visibility, runway, component, windType, minSpeed, maxSpeed } = appliedFilters;
              generateOpsmetPctReport({
                analysis: 'Vis+Head-Tail Wind',
                airport: reportInfo.airport,
                begin: reportInfo.begin,
                end: reportInfo.end,
                selectedMonths: reportInfo.selectedMonths,
                data,
                extraParams: { VISIBILITY: visibility, RUNWAY: runway, COMPONENT: component, WIND_TYPE: windType, MIN_SPEED: minSpeed, MAX_SPEED: maxSpeed },
                criteriaFn: (d) => {
                  if (d.visibility === null || d.visibility > visibility) return false;
                  if (typeof d.windDirection !== 'number') return false;
                  const speed = windType === 'Gust' ? (d.windGust || 0) : (d.windSpeed || 0);
                  const angleDiffRad = (d.windDirection - runway) * Math.PI / 180;
                  const headwind = speed * Math.cos(angleDiffRad);
                  const crosswind = Math.abs(speed * Math.sin(angleDiffRad));
                  const tailwind = -headwind;
                  let val = 0;
                  if (component === 'Head') val = headwind;
                  else if (component === 'Tail') val = tailwind;
                  else if (component === 'Cross') val = crosswind;
                  return val >= 0 && val >= minSpeed && val <= maxSpeed;
                },
              });""",
              
    'CloudTypePctTab.js': """if (!reportInfo || !appliedCoverages) return;
              const targetCovs = appliedCoverages.length > 0 ? appliedCoverages : COVERAGES;
              const targetTps = (appliedTypes && appliedTypes.length > 0) ? appliedTypes : TYPES;
              generateOpsmetPctReport({
                analysis: 'Cloud Type',
                airport: reportInfo.airport,
                begin: reportInfo.begin,
                end: reportInfo.end,
                selectedMonths: reportInfo.selectedMonths,
                data,
                extraParams: { COVERAGE: targetCovs.join(','), TYPE: targetTps.join(',') },
                criteriaFn: (d) => {
                  if (!d.clouds || !Array.isArray(d.clouds)) return false;
                  return d.clouds.some(c => targetCovs.includes(c.code) && c.type && targetTps.includes(c.type));
                },
              });""",
              
    'TemperaturePctTab.js': """if (!reportInfo || !appliedFilters) return;
              const { minTemp, maxTemp } = appliedFilters;
              generateOpsmetPctReport({
                analysis: 'Temperature',
                airport: reportInfo.airport,
                begin: reportInfo.begin,
                end: reportInfo.end,
                selectedMonths: reportInfo.selectedMonths,
                data,
                extraParams: { MIN_TEMP: minTemp, MAX_TEMP: maxTemp },
                criteriaFn: (d) => typeof d.temperature === 'number' && d.temperature >= minTemp && d.temperature <= maxTemp,
              });""",
              
    'PressurePctTab.js': """if (!reportInfo || !appliedFilters) return;
              const { minPressure, maxPressure } = appliedFilters;
              generateOpsmetPctReport({
                analysis: 'Pressure',
                airport: reportInfo.airport,
                begin: reportInfo.begin,
                end: reportInfo.end,
                selectedMonths: reportInfo.selectedMonths,
                data,
                extraParams: { MIN_PRESSURE: minPressure, MAX_PRESSURE: maxPressure },
                criteriaFn: (d) => typeof d.pressureHpa === 'number' && d.pressureHpa >= minPressure && d.pressureHpa <= maxPressure,
              });"""
}

for filename, logic in PCT_LOGIC.items():
    filepath = os.path.join(TABS_DIR, filename)
    if not os.path.exists(filepath): continue
    
    with open(filepath, 'r') as f:
        content = f.read()
        
    # 1. Restore Run/Clear buttons
    chart_area_idx = content.find('{/* Chart Area */}')
    if chart_area_idx != -1 and 'onClick={handleRun}' not in content:
        div_idx = content.rfind('</div>', 0, chart_area_idx)
        if div_idx != -1:
            run_btn = '''
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleRun}>
              ▶ Run
            </button>
            <button 
              className="btn-primary" 
              style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }} 
              onClick={handleClear}
            >
              ✕ Clear
            </button>
          </div>
'''
            content = content[:div_idx] + run_btn + content[div_idx:]
            
    # 2. Add Export buttons to Header
    # Need to match the header exactly. It might have flexWrap, gap, etc.
    header_match = re.search(r'(<div style=\{\{\s*display:\s*\'flex\',\s*justifyContent:\s*\'space-between\',\s*alignItems:\s*\'center\'[^\}]*?\}\}>.*?</div>)', content, re.DOTALL)
    if header_match and '📊 Export Report' not in content:
        header_full = header_match.group(0)
        
        button_group = f'''
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-primary" 
                style={{ padding: '6px 12px', fontSize: '13px', background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.4)', color: '#38bdf8' }}
                onClick={{() => exportGraphAsPNG(chartRef, '{filename.replace(".js", ".png")}')}}
              >
                📈 Export Graph
              </button>
              <button 
                className="btn-primary" 
                style={{ padding: '6px 12px', fontSize: '13px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80' }}
                onClick={{() => {{
{logic}
                }}}}
              >📊 Export Report</button>
            </div>'''
            
        new_header = header_full[:-6] + button_group + '\n          </div>'
        content = content[:header_match.start()] + new_header + content[header_match.end():]
        
    with open(filepath, 'w') as f:
        f.write(content)

print("Percentage tabs restored and fixed!")
