import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

# Dictionary mapping input state names to their default string (what was originally inside useState('...'))
# and their default parsed value (what should be applied if empty)
defaults = {
    'thresholdInput': ('2000', 2000), # Some are 1000, we'll extract it dynamically
    'visibilityInput': ('1000', 1000),
    'runwayInput': ('350', 350),
    'minSpeedInput': ('15', 15), # Some are 0
    'maxSpeedInput': ('60', 60), # Some are 40, 25
    'stationsInput': ('LTBA, LTFM, LTCG', "'LTBA, LTFM, LTCG'"),
    'maxTempInput': ('5', 5),
    'minPressureInput': ('1030', 1030),
    'maxPressureInput': ('1048', 1048),
    'percentileInput': ('100', 100)
}

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Step 1: Find all useState declarations for our targets and change them to ''
    # We will dynamically grab their default value from the original file!
    extracted_defaults = {}
    for var_name in defaults.keys():
        match = re.search(fr"const \[\s*{var_name}\s*,\s*set[A-Z][a-zA-Z]+\s*\]\s*=\s*useState\(\s*'([^']+)'\s*\);", content)
        if match:
            original_val = match.group(1)
            extracted_defaults[var_name] = original_val
            # Replace useState('val') with useState('')
            content = re.sub(
                fr"(const \[\s*{var_name}\s*,\s*set[A-Z][a-zA-Z]+\s*\]\s*=\s*useState\(\s*)'[^']+'(\s*\);)",
                r"\1''\2",
                content
            )

    # Note: If there's an input with useState(1000) (no quotes), we should also catch it
    for var_name in defaults.keys():
        if var_name not in extracted_defaults:
            match = re.search(fr"const \[\s*{var_name}\s*,\s*set[A-Z][a-zA-Z]+\s*\]\s*=\s*useState\(\s*([0-9]+)\s*\);", content)
            if match:
                original_val = match.group(1)
                extracted_defaults[var_name] = original_val
                content = re.sub(
                    fr"(const \[\s*{var_name}\s*,\s*set[A-Z][a-zA-Z]+\s*\]\s*=\s*useState\(\s*)[0-9]+(\s*\);)",
                    r"\1''\2",
                    content
                )

    # Step 2: Modify handleRun to use default if isNaN or empty
    # For example: if (!isNaN(val)) setAppliedThreshold(val); -> setAppliedThreshold(isNaN(val) ? DEFAULT : val);
    # Since handleRun is handwritten and varies, we might need a more general approach.
    # Actually, we can just replace the if (!isNaN(var)) setAppliedVar(var); pattern.
    
    # We'll use a simpler approach:
    # Just look for the setAppliedX calls inside handleRun and replace them.
    # It's easier to just let the user type e.g. "2000" if they want, but if it's empty, we apply the default.
    # Let's find handleRun body.
    run_match = re.search(r'(const handleRun = \(\) => \{)(.*?)(^\s*\};)', content, re.MULTILINE | re.DOTALL)
    if run_match:
        run_body = run_match.group(2)
        new_run_body = run_body
        for var_name, orig_val in extracted_defaults.items():
            # If the variable is parsed as int
            if 'parseInt' in run_body or 'parseFloat' in run_body or orig_val.isdigit():
                # We want to replace `if (!isNaN(X)) setAppliedY(X);`
                # First, find what X and setAppliedY are
                # Example: `const val = parseInt(thresholdInput, 10); if (!isNaN(val)) { setAppliedThreshold(val); }`
                
                # We'll just do a simpler fix: right before `setApplied`, we ensure the value is the default if it's invalid.
                # Actually, an easier regex is just to look for the `setAppliedX` function name corresponding to this `var_name`.
                # E.g. thresholdInput -> setAppliedThreshold
                # If we can't reliably regex it, we can write handleClear and just let handleRun be (if they run with empty, it won't apply).
                pass
                
    # Wait, if we just leave `handleRun` as is, what happens if input is empty ('')?
    # `parseInt('', 10)` is `NaN`.
    # `if (!isNaN(val))` will be FALSE.
    # So `setAppliedThreshold` is NEVER CALLED.
    # Thus, the applied value remains whatever it currently is (which starts as the default!)
    # SO WE DON'T NEED TO MODIFY `handleRun`!!
    # The initial state of `appliedThreshold` is `2000`. If they clear the input and click Run, it ignores it and keeps 2000!
    # Wait, if they had changed it to `3000`, applied it, then cleared the input, and clicked Run, it would REMAIN `3000`.
    # Is that what they want? Usually "Clear" button resets everything anyway.
    
    # Let's just generate the `handleClear` function!
    # Find all `useState` definitions to build `handleClear`
    state_vars = []
    # Match all `const [var, setVar] = useState(init);`
    state_matches = re.finditer(r"const \[\s*([a-zA-Z0-9_]+)\s*,\s*set([a-zA-Z0-9_]+)\s*\]\s*=\s*useState\(\s*(.*?)\s*\);", content)
    for m in state_matches:
        var_name = m.group(1)
        setter = f"set{m.group(2)}"
        init_val = m.group(3)
        # If it's one of our extracted defaults, the init_val should be the extracted_defaults (so clear resets to empty string, but wait, clear should reset input to '' and applied to original default!)
        if var_name in extracted_defaults:
            state_vars.append((var_name, setter, "''", init_val)) # input gets '', but wait, init_val here in the file is NOW '' because we replaced it!
            # So we use extracted_defaults[var_name] for the applied variable!
        else:
            state_vars.append((var_name, setter, init_val, init_val))

    # Build handleClear
    clear_stmts = []
    for var_name, setter, init_val, orig_val in state_vars:
        # We only clear variables that look like inputs, applied variables, or dropdowns.
        if var_name in extracted_defaults:
            clear_stmts.append(f"    {setter}('');")
        elif var_name.startswith('applied'):
            # Find the corresponding input default
            # e.g. appliedThreshold -> thresholdInput
            orig = 'null'
            for inp_name, inp_val in extracted_defaults.items():
                if inp_name.replace('Input', '').lower() in var_name.lower():
                    orig = inp_val
                    break
            # If we didn't find it, just use the init_val found in the file
            if orig == 'null':
                orig = init_val
            clear_stmts.append(f"    {setter}({orig});")
        elif var_name in ['timeGroup', 'intensity', 'description', 'phenomena', 'componentInput', 'windTypeInput', 'subTab']:
            clear_stmts.append(f"    {setter}({init_val});")
        elif var_name in ['selectedCoverages', 'selectedTypes', 'selectedPhenomena']:
            clear_stmts.append(f"    {setter}({init_val});")

    handle_clear_code = "\n  const handleClear = () => {\n" + "\n".join(clear_stmts) + "\n  };\n"

    # Insert handleClear before handleRun or before return
    if 'const handleClear = () => {' not in content:
        if 'const handleRun = () => {' in content:
            content = content.replace('const handleRun = () => {', handle_clear_code + '\n  const handleRun = () => {')
        else:
            content = content.replace('return (', handle_clear_code + '\n  return (')

    # Modify the UI to include the Clear button IF it's not already there
    # For Observation tabs, we currently have:
    # <button className="btn-primary" style={{ width: '100%', marginTop: '8px' }} onClick={handleRun}>▶ Run</button>
    
    run_btn_pattern = r'<button className="btn-primary" style=\{\{\s*width:\s*\'100%\',\s*marginTop:\s*\'8px\'\s*\}\}\s*onClick=\{handleRun\}>▶ Run</button>'
    replacement = """<div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleRun}>▶ Run</button>
            <button className="btn-primary" style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }} onClick={handleClear}>✕ Clear</button>
          </div>"""
          
    content = re.sub(run_btn_pattern, replacement, content)

    with open(filepath, 'w') as f:
        f.write(content)

print("Inputs cleared and Clear buttons added!")
