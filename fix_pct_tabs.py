import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('PctTab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Fix the style={ } to style={{ }}
    content = content.replace("style={ display: 'flex', gap: '8px' }", "style={{ display: 'flex', gap: '8px' }}")
    content = content.replace("style={ padding: '6px 12px', fontSize: '13px', background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.4)', color: '#38bdf8' }", "style={{ padding: '6px 12px', fontSize: '13px', background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.4)', color: '#38bdf8' }}")
    content = content.replace("style={ padding: '6px 12px', fontSize: '13px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80' }", "style={{ padding: '6px 12px', fontSize: '13px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80' }}")

    # Fix the missing </div> for tabs-container
    bad_pattern = "              ))}\n            \n            <div style={{ display: 'flex', gap: '8px' }}>"
    if bad_pattern in content:
        content = content.replace(bad_pattern, "              ))}\n            </div>\n            <div style={{ display: 'flex', gap: '8px' }}>")

    with open(filepath, 'w') as f:
        f.write(content)

print("Percentage tabs completely fixed.")
