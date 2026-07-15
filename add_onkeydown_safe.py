import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    if 'onKeyDown={e => { if (e.key' in content:
        print(f"Skipping {filename}, already has onKeyDown")
        continue

    # Insert onKeyDown before placeholder
    new_content = re.sub(
        r'([ \t]*)(placeholder="e\.g\.[^"]*")',
        r"\1onKeyDown={e => { if (e.key === 'Enter') handleRun(); }}\n\1\2",
        content
    )

    # For date inputs in VisibilityStationsPctTab.js
    new_content = new_content.replace(
        'required />',
        'required onKeyDown={e => { if (e.key === \'Enter\') handleRun(); }} />'
    )

    with open(filepath, 'w') as f:
        f.write(new_content)

print("onKeyDown added safely!")
