import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the export button block
    # It starts with <div style={{ display: 'flex', gap: '8px' }}> and ends with >📊 Export Report</button>\n            </div>
    # Using re.DOTALL to match across newlines
    export_btn_match = re.search(r'(\s*<div style=\{\{\s*display:\s*\'flex\',\s*gap:\s*\'8px\'\s*\}\}>.*?📊 Export Report</button>\n\s*</div>)', content, re.DOTALL)
    
    if export_btn_match:
        btn_code = export_btn_match.group(1)
        
        # Remove it from the header
        content = content[:export_btn_match.start()] + content[export_btn_match.end():]
        
        # Add flex: 1 and marginTop: 8px to make it look good in sidebar
        btn_code = btn_code.replace("style={{ display: 'flex', gap: '8px' }}", "style={{ display: 'flex', gap: '8px', marginTop: '8px' }}")
        btn_code = btn_code.replace("style={{ padding: '6px 12px', fontSize: '13px', background: 'rgba(14, 165, 233, 0.15)'", "style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'rgba(14, 165, 233, 0.15)'")
        btn_code = btn_code.replace("style={{ padding: '6px 12px', fontSize: '13px', background: 'rgba(34, 197, 94, 0.15)'", "style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'rgba(34, 197, 94, 0.15)'")

        # Now insert it right before {/* Chart Area */}
        # Find the line with {/* Chart Area */}
        chart_area_idx = content.find('{/* Chart Area */}')
        if chart_area_idx != -1:
            # We want to insert it inside the sidebar div, which ends just before this
            div_idx = content.rfind('</div>', 0, chart_area_idx)
            if div_idx != -1:
                content = content[:div_idx] + btn_code + '\n' + content[div_idx:]

    with open(filepath, 'w') as f:
        f.write(content)

print("Buttons moved to sidebar.")
