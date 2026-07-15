import os

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the corrupted section
    bad_pattern = "              ))}\n            \n            <div style={{ display: 'flex', gap: '8px' }}>"
    if bad_pattern in content:
        content = content.replace(bad_pattern, "              ))}\n            </div>\n            <div style={{ display: 'flex', gap: '8px' }}>")

    with open(filepath, 'w') as f:
        f.write(content)

print("HTML fixed.")
