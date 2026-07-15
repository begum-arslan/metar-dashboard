import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Find all <input ... /> and <input ... > tags.
    # Note: we should avoid adding it if onKeyDown is already there.
    # We should also only add it to inputs that are NOT checkboxes (though adding it to checkbox is harmless if e.key === 'Enter').
    # But let's only add to <input type="number", type="text", type="date", or inputs where type is not explicitly set.
    
    def replacer(match):
        full_tag = match.group(0)
        
        # Don't add to checkboxes
        if 'type="checkbox"' in full_tag:
            return full_tag
            
        # Don't add if already present
        if 'onKeyDown' in full_tag:
            return full_tag
            
        # Insert onKeyDown before the closing > or />
        if full_tag.endswith('/>'):
            return full_tag[:-2] + " onKeyDown={e => { if (e.key === 'Enter') handleRun(); }} />"
        else:
            return full_tag[:-1] + " onKeyDown={e => { if (e.key === 'Enter') handleRun(); }}>"

    # Match <input ...> or <input ... />
    # We use a non-greedy regex to capture the whole tag
    new_content = re.sub(r'<input\s+[^>]*>', replacer, content)

    # We can also add it to <select> tags!
    new_content = re.sub(r'<select\s+[^>]*>', replacer, new_content)

    with open(filepath, 'w') as f:
        f.write(new_content)

print("onKeyDown added to inputs and selects!")
