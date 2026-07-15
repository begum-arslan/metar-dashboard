import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if filename.endswith('PctTab.js') or not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # The bad pattern is the extra </div> after the Export Report button's closing div.
    # It looks like:
    #           >📊 Export Report</button>
    #             </div>
    #           </div>
    
    # We want to replace it with:
    #           >📊 Export Report</button>
    #             </div>
    
    content = re.sub(
        r"(>\s*📊 Export Report</button>\n\s*</div>)\n\s*</div>",
        r"\1",
        content
    )

    with open(filepath, 'w') as f:
        f.write(content)

print("Obs tabs extra div removed.")
