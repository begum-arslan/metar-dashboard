import os

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # The bad pattern: an extra closing div after the export buttons
    bad_pattern = "              >📊 Export Report</button>\n            </div>\n          </div>"
    good_pattern = "              >📊 Export Report</button>\n            </div>"
    
    if bad_pattern in content:
        content = content.replace(bad_pattern, good_pattern)

    with open(filepath, 'w') as f:
        f.write(content)

print("Extra div removed.")
