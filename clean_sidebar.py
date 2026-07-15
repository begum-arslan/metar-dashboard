import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # We need to extract:
    # 1. The opsmet call (from generateOpsmetReport or generateOpsmetPctReport to }); )
    opsmet_match = re.search(r'(generateOpsmet(?:Pct)?Report\(\{.*?\s+\}\);)', content, re.DOTALL)
    if not opsmet_match:
        print(f"Skipping {filename}: no opsmet block found")
        continue
    opsmet_code = opsmet_match.group(1)

    # 2. Does it have reportInfo check?
    has_reportInfo = 'if (!reportInfo) return;' in content
    if has_reportInfo:
        opsmet_code = f"if (!reportInfo) return;\n              {opsmet_code}"

    # 3. Determine if it has handleClear
    has_clear = 'onClick={handleClear}' in content
    
    # Is it a percentage tab or without value?
    is_pct = 'PctTab' in filename or 'WithoutValue' in filename or 'VisibilityStations' in filename
    
    if is_pct and has_clear:
        run_block = """          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleRun}>▶ Run</button>
            <button className="btn-primary" style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }} onClick={handleClear}>✕ Clear</button>
          </div>"""
    else:
        run_block = """          <button className="btn-primary" style={{ width: '100%', marginTop: '8px' }} onClick={handleRun}>▶ Run</button>"""

    export_block = f"""          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button 
              className="btn-primary" 
              style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.4)', color: '#38bdf8' }}
              onClick={{() => exportGraphAsPNG(chartRef, '{filename.replace('.js', '.png')}')}}
            >
              📈 Export Graph
            </button>
            <button 
              className="btn-primary" 
              style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80' }}
              onClick={{() => {{
                {opsmet_code}
              }}}}
            >
              📊 Export Report
            </button>
          </div>"""

    # Now, find the region from the start of the sidebar to {/* Chart Area */}
    chart_area_idx = content.find('{/* Chart Area */}')
    if chart_area_idx == -1:
        continue
    sidebar_end_idx = content.rfind('</div>', 0, chart_area_idx)
    
    sidebar_start = content.rfind('className="glass-container"', 0, sidebar_end_idx)
    if sidebar_start == -1:
        continue
        
    sidebar_content = content[sidebar_start:sidebar_end_idx]
    
    # We want to remove ANY button that contains 'Run', 'Clear', 'Export Graph', 'Export Report' from sidebar_content
    # And we also want to remove `<div style={{ display: 'flex'...` wrappers if they become empty
    
    # It is easier to find the LAST form element (like </select>, </input>, or </div> of a form-group)
    # and cut the sidebar there, appending the clean block.
    # What's the last form element?
    # Usually it's the </div> of the last `<div className="form-group"` or `tabs-container`.
    # Let's find the LAST `</div>` that is part of a form-group.
    # Actually, the sidebar content contains multiple `<div className="form-group"`
    # Let's find the start index of the LAST button in the sidebar_content.
    # No, there are duplicate buttons!
    
    # Let's use regex to strip all `<button ...>...</button>` that contain these texts!
    for pattern in [r'<button[^>]*>.*?Export Graph\s*</button>',
                    r'<button[^>]*>.*?Export Report\s*</button>',
                    r'<button[^>]*>.*?Run\s*</button>',
                    r'<button[^>]*>.*?Run / Create Report\s*</button>',
                    r'<button[^>]*>.*?Clear\s*</button>']:
        sidebar_content = re.sub(pattern, '', sidebar_content, flags=re.DOTALL | re.IGNORECASE)
    
    # Strip empty flex wrappers
    sidebar_content = re.sub(r'<div style=\{\{\s*display:\s*\'flex\'[^>]*\}\}>\s*</div>', '', sidebar_content, flags=re.DOTALL)
    sidebar_content = re.sub(r'<div style=\{\{\s*display:\s*\'flex\'[^>]*\}\}>\s*<div style=\{\{\s*display:\s*\'flex\'[^>]*\}\}>\s*</div>\s*</div>', '', sidebar_content, flags=re.DOTALL)
    sidebar_content = re.sub(r'<div style=\{\{\s*display:\s*\'flex\'[^>]*\}\}>\s*</div>', '', sidebar_content, flags=re.DOTALL)

    # Clean up empty lines
    sidebar_content = re.sub(r'\n\s*\n\s*\n+', '\n\n', sidebar_content)
    
    # Now append our perfect block!
    sidebar_content = sidebar_content.rstrip() + '\n\n' + run_block + '\n' + export_block + '\n        '
    
    content = content[:sidebar_start] + sidebar_content + content[sidebar_end_idx:]
    
    # Wait, did we also duplicate buttons in the HEADER?
    # Because my move_buttons script extracted from header, but maybe it left some?
    # Let's strip those buttons from the entire file EXCEPT our newly added ones.
    # To do this safely, we will just replace the buttons in the header if they exist.
    # The header is after {/* Chart Area */}
    header_content = content[chart_area_idx:]
    for pattern in [r'<button[^>]*>.*?Export Graph\s*</button>',
                    r'<button[^>]*>.*?Export Report\s*</button>',
                    r'<button[^>]*>.*?Run\s*</button>',
                    r'<button[^>]*>.*?Run / Create Report\s*</button>',
                    r'<button[^>]*>.*?Clear\s*</button>']:
        header_content = re.sub(pattern, '', header_content, flags=re.DOTALL | re.IGNORECASE)
    
    header_content = re.sub(r'<div style=\{\{\s*display:\s*\'flex\'[^>]*\}\}>\s*</div>', '', header_content, flags=re.DOTALL)
    header_content = re.sub(r'<div style=\{\{\s*display:\s*\'flex\'[^>]*\}\}>\s*<div style=\{\{\s*display:\s*\'flex\'[^>]*\}\}>\s*</div>\s*</div>', '', header_content, flags=re.DOTALL)

    content = content[:chart_area_idx] + header_content

    with open(filepath, 'w') as f:
        f.write(content)

print("Sidebars perfectly rebuilt!")
