import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the export graph button
    graph_match = re.search(r'<button[^>]*onClick=\{\(\)\s*=>\s*exportGraphAsPNG\([^>]*>.*?📈 Export Graph\s*</button>', content, re.DOTALL)
    # Find the export report button
    report_match = re.search(r'<button[^>]*>📊 Export Report</button>', content, re.DOTALL)
    
    # Find the run button (could be Run or ▶ Run)
    run_match = re.search(r'<button[^>]*onClick=\{handleRun\}[^>]*>.*?Run\s*</button>', content, re.DOTALL)
    
    # Find the clear button
    clear_match = re.search(r'<button[^>]*onClick=\{handleClear\}[^>]*>.*?✕ Clear\s*</button>', content, re.DOTALL)

    if not graph_match or not report_match or not run_match:
        print(f"Skipping {filename}: missing buttons")
        continue

    graph_btn = graph_match.group(0)
    report_btn = report_match.group(0)
    run_btn = run_match.group(0)
    clear_btn = clear_match.group(0) if clear_match else ""

    # Fix styles for export buttons
    graph_btn = re.sub(r'style=\{\{.*?\}\}', "style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.4)', color: '#38bdf8' }}", graph_btn)
    report_btn = re.sub(r'style=\{\{.*?\}\}', "style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80' }}", report_btn)

    # Fix style for run and clear buttons
    if clear_btn:
        run_btn = re.sub(r'style=\{\{.*?\}\}', "style={{ flex: 1 }}", run_btn)
        clear_btn = re.sub(r'style=\{\{.*?\}\}', "style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }}", clear_btn)
    else:
        run_btn = re.sub(r'style=\{\{.*?\}\}', "style={{ width: '100%', marginTop: '8px' }}", run_btn)

    # Delete existing buttons and their immediate flex wrapper if any
    content = content.replace(graph_match.group(0), '')
    content = content.replace(report_match.group(0), '')
    content = content.replace(run_match.group(0), '')
    if clear_btn:
        content = content.replace(clear_match.group(0), '')

    # Cleanup empty flex divs
    content = re.sub(r'<div style=\{\{\s*display:\s*\'flex\'.*?\}\}>\s*</div>', '', content, flags=re.DOTALL)
    content = re.sub(r'<div style=\{\{\s*display:\s*\'flex\'.*?\}\}>\s*<div style=\{\{\s*display:\s*\'flex\'.*?\}\}>\s*</div>\s*</div>', '', content, flags=re.DOTALL)

    # Generate new block
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

    # Insert before {/* Chart Area */}
    chart_area_idx = content.find('{/* Chart Area */}')
    if chart_area_idx != -1:
        div_idx = content.rfind('</div>', 0, chart_area_idx)
        if div_idx != -1:
            content = content[:div_idx] + new_block + content[div_idx:]

    with open(filepath, 'w') as f:
        f.write(content)

print("Buttons cleaned up.")
