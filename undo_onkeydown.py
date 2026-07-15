import os

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # The corrupted string
    corrupted1 = "= onKeyDown={e => { if (e.key === 'Enter') handleRun(); }}>"
    corrupted2 = "= onKeyDown={e => { if (e.key === 'Enter') handleRun(); }} />"
    
    # We replace it back to =>
    content = content.replace(corrupted1, "=>")
    content = content.replace(corrupted2, "=>") # though /> shouldn't have matched `=>` unless it was `e =>/` which is invalid.

    with open(filepath, 'w') as f:
        f.write(content)

print("Undone the corruption!")
