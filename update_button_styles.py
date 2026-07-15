import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

old_graph_style = r"background:\s*'rgba\(14, 165, 233, 0\.15\)',\s*border:\s*'1px solid rgba\(14, 165, 233, 0\.4\)',\s*color:\s*'#38bdf8'"
new_graph_style = "background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', border: 'none', color: '#ffffff', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.2)'"

old_report_style = r"background:\s*'rgba\(34, 197, 94, 0\.15\)',\s*border:\s*'1px solid rgba\(34, 197, 94, 0\.4\)',\s*color:\s*'#4ade80'"
new_report_style = "background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#ffffff', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.2)'"

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    content = re.sub(old_graph_style, new_graph_style, content)
    content = re.sub(old_report_style, new_report_style, content)

    with open(filepath, 'w') as f:
        f.write(content)

print("Button styles updated!")
