import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Fix the import typo
    content = content.replace("import React, { useState, useMemo, useRef } } from 'react';", "import React, { useState, useMemo, useRef } from 'react';")

    if not filename.endswith('PctTab.js'):
        # For Observation tabs
        # 1. Remove the misplaced Run button from the header group
        bad_run_btn = '<button className="btn-primary" style={{ padding: \'6px 12px\', fontSize: \'13px\' }} onClick={handleRun}>▶ Run</button>\n          '
        content = content.replace(bad_run_btn, '')

        # 2. Put the Run button back into the sidebar
        # The sidebar ends with </div> \n        {/* Chart Area */} or similar
        # Find the {/* Chart Area */}
        chart_area_idx = content.find('{/* Chart Area */}')
        if chart_area_idx != -1 and 'onClick={handleRun}' not in content:
            div_idx = content.rfind('</div>', 0, chart_area_idx)
            if div_idx != -1:
                run_btn = '  <button className="btn-primary" style={{ width: \'100%\', marginTop: \'8px\' }} onClick={handleRun}>Run</button>\n        '
                content = content[:div_idx] + run_btn + content[div_idx:]

    with open(filepath, 'w') as f:
        f.write(content)

print("Observation tabs fixed.")
