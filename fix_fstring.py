import os

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Fix the missing double braces caused by python f-strings
    content = content.replace("style={ display: 'flex', gap: '8px', marginTop: '8px' }", "style={{ display: 'flex', gap: '8px', marginTop: '8px' }}")
    content = content.replace("style={ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.4)', color: '#38bdf8' }", "style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.4)', color: '#38bdf8' }}")
    content = content.replace("style={ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80' }", "style={{ flex: 1, padding: '6px 12px', fontSize: '13px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)', color: '#4ade80' }}")

    with open(filepath, 'w') as f:
        f.write(content)

print("Syntax fixed.")
