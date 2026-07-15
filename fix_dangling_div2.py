import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('PctTab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # The bad pattern is an empty opening div followed directly by the new button group
    content = re.sub(
        r"<div style=\{\{\s*display:\s*'flex',\s*gap:\s*'8px'(?:,\s*marginTop:\s*'8px')?\s*\}\}>\s*<div style=\{\{\s*display:\s*'flex',\s*gap:\s*'8px',\s*marginTop:\s*'8px'\s*\}\}>",
        r"<div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>",
        content
    )

    with open(filepath, 'w') as f:
        f.write(content)

print("Dangling divs removed part 2.")
