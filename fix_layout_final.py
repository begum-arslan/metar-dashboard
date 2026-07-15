import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Step 1: Find all 4 types of buttons.
    # We will use simple regexes that match the whole button tag.
    graph_re = re.compile(r'<button[^>]*exportGraphAsPNG.*?📈.*?Export Graph\s*</button>', re.DOTALL)
    report_re = re.compile(r'<button[^>]*generateOpsmet.*?📊.*?Export Report\s*</button>', re.DOTALL)
    run_re = re.compile(r'<button[^>]*onClick=\{handleRun\}[^>]*>.*?Run\s*</button>', re.DOTALL)
    clear_re = re.compile(r'<button[^>]*onClick=\{handleClear\}[^>]*>.*?Clear\s*</button>', re.DOTALL)

    graph_m = graph_re.search(content)
    report_m = report_re.search(content)
    run_m = run_re.search(content)
    clear_m = clear_re.search(content)

    if not graph_m or not report_m or not run_m:
        print(f"Skipping {filename}: missing core buttons")
        continue

    graph_btn = graph_m.group(0)
    report_btn = report_m.group(0)
    run_btn = run_m.group(0)
    clear_btn = clear_m.group(0) if clear_m else ""

    # Replace all style attributes with the correct ones
    graph_btn = re.sub(r'style=\{\{.*?\}\}', "style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.4)', color: '#38bdf8' }}", graph_btn)
    report_btn = re.sub(r'style=\{\{.*?\}\}', "style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80' }}", report_btn)
    
    if clear_btn:
        run_btn = re.sub(r'style=\{\{.*?\}\}', "style={{ flex: 1 }}", run_btn)
        clear_btn = re.sub(r'style=\{\{.*?\}\}', "style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }}", clear_btn)
    else:
        run_btn = re.sub(r'style=\{\{.*?\}\}', "style={{ width: '100%', marginTop: '8px' }}", run_btn)

    # Step 2: Remove the old buttons from content
    content = content.replace(graph_m.group(0), '')
    content = content.replace(report_m.group(0), '')
    content = content.replace(run_m.group(0), '')
    if clear_btn:
        content = content.replace(clear_m.group(0), '')

    # Step 3: Remove empty flex containers
    content = re.sub(r'<div style=\{\{\s*display:\s*\'flex\',\s*gap:\s*\'8px\'(?:,\s*marginTop:\s*\'8px\')?\s*\}\}>\s*</div>', '', content, flags=re.DOTALL)
    content = re.sub(r'<div style=\{\{\s*display:\s*\'flex\',\s*gap:\s*\'8px\'(?:,\s*marginTop:\s*\'8px\')?\s*\}\}>\s*<div style=\{\{\s*display:\s*\'flex\',\s*gap:\s*\'8px\'(?:,\s*marginTop:\s*\'8px\')?\s*\}\}>\s*</div>\s*</div>', '', content, flags=re.DOTALL)
    # Remove any extra whitespace left behind
    content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)

    # Step 4: Construct the new layout block
    if clear_btn:
        new_block = f"""
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {run_btn}
            {clear_btn}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {graph_btn}
            {report_btn}
          </div>
"""
    else:
        new_block = f"""
          {run_btn}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {graph_btn}
            {report_btn}
          </div>
"""

    # Step 5: Insert new block right before {/* Chart Area */}
    chart_area_idx = content.find('{/* Chart Area */}')
    if chart_area_idx != -1:
        div_idx = content.rfind('</div>', 0, chart_area_idx)
        if div_idx != -1:
            content = content[:div_idx] + new_block + content[div_idx:]

    with open(filepath, 'w') as f:
        f.write(content)

print("Layout fully fixed.")
