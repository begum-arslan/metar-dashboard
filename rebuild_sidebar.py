import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Extract the generateOpsmet block
    opsmet_match = re.search(r'(if \(!reportInfo\).*?generateOpsmet.*?\(\{.*?\s+\}\);)', content, re.DOTALL)
    if not opsmet_match:
        print(f"Skipping {filename}: no opsmet block found")
        continue
    opsmet_code = opsmet_match.group(1)

    # 2. Rebuild the new block
    # Is it a percentage tab?
    is_pct = 'PctTab' in filename
    
    if is_pct or 'WithoutValue' in filename or 'VisibilityStations' in filename:
        # Check if there's a handleClear
        has_clear = 'handleClear' in content
        if has_clear:
            run_block = """          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleRun}>▶ Run</button>
            <button className="btn-primary" style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }} onClick={handleClear}>✕ Clear</button>
          </div>"""
        else:
            run_block = """          <button className="btn-primary" style={{ width: '100%', marginTop: '8px' }} onClick={handleRun}>▶ Run</button>"""
    else:
        run_block = """          <button className="btn-primary" style={{ width: '100%', marginTop: '8px' }} onClick={handleRun}>▶ Run</button>"""

    new_block = f"""{run_block}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
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
          </div>
</div>"""

    # 3. Find the region to replace
    # We want to replace everything from the first button (Run or Export) up to just before {/* Chart Area */}
    # Find the end of the last form-group or input/select
    # Actually, it's easier to find {/* Chart Area */} and work backwards to the first button.
    # The buttons are currently completely scrambled.
    
    # Let's find the closing tag of the sidebar. It's the `</div>` just before `{/* Chart Area */}`
    chart_area_idx = content.find('{/* Chart Area */}')
    if chart_area_idx == -1:
        continue
        
    sidebar_end_idx = content.rfind('</div>', 0, chart_area_idx)
    
    # Find where the button mess starts.
    # It starts after the last form element.
    # A safe marker is the first '<button' that comes after the last '</select>' or '</input>' or '</div>' of a form-group.
    # Since the file is messy, let's just use regex to replace all '<button... >... </button>' AND their wrapper divs in the sidebar.
    
    # Let's find the start of the sidebar: `<div className="glass-container" ... flexDirection: 'column'`
    sidebar_start = content.rfind('className="glass-container"', 0, sidebar_end_idx)
    if sidebar_start == -1:
        continue
        
    # We will slice the sidebar content
    sidebar_content = content[sidebar_start:sidebar_end_idx]
    
    # Remove all lines containing `<button` or `</button>` or `Export Graph` or `Export Report` or `▶ Run` or `Run / Create` or `handleRun` or `handleClear` or `style={{ display: 'flex'` that are just button wrappers
    lines = sidebar_content.split('\n')
    new_lines = []
    in_button = False
    in_flex_wrapper = False
    for line in lines:
        stripped = line.strip()
        
        # Skip if we are inside a button tag
        if '<button' in stripped:
            in_button = True
        
        if in_button:
            if '</button>' in stripped:
                in_button = False
            continue
            
        # Skip flex wrappers that only contain buttons
        if stripped.startswith('<div style={{ display: \'flex\'') or stripped.startswith('<div style={ display: \'flex\''):
            continue
        if stripped == '</div>' and (len(new_lines) > 0 and new_lines[-1].strip() == ''):
            # This is risky, let's not blindly remove </div>.
            pass
            
        # Instead of parsing HTML, let's just replace the ENTIRE button section.
        pass

    # A MUCH safer way:
    # 1. Do a git checkout of the file to its original state from HEAD.
    # 2. Then apply the new_block!
    pass

