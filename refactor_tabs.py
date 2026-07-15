import os
import re

TABS_DIR = '/Users/begumarslan/metar-dashboard/components/tabs'

IMPORT_REF_RE = re.compile(r'import React,\s*\{\s*useState,\s*useMemo')
IMPORT_REF_REPLACE = r'import React, { useState, useMemo, useRef }'
IMPORT_EXPORT_RE = re.compile(r'import \{ (generateOpsmet(?:Pct)?Report) \} from \'@/utils/excelExport\';')

RUN_TEXT_RE = re.compile(r'>Run / Create Report</button>')
RUN_TEXT_REPLACE = r'>▶ Run</button>'

CREATE_REPORT_BTN_RE = re.compile(r'\s*<button\s+className="btn-primary"[\s\S]*?>📥 Create Report \(\.xls\)</button>')

CHART_HEADER_RE = re.compile(r'(<div style=\{\{\s*display:\s*\'flex\',\s*justifyContent:\s*\'space-between\',\s*alignItems:\s*\'center\',\s*marginBottom:\s*\'24px\'\s*\}\}>.*?</div>)', re.DOTALL)

for filename in os.listdir(TABS_DIR):
    if not filename.endswith('Tab.js'):
        continue
        
    filepath = os.path.join(TABS_DIR, filename)
    with open(filepath, 'r') as f:
        content = f.read()
        
    if '📥 Create Report (.xls)' not in content:
        continue
        
    if 'useRef' not in content:
        content = IMPORT_REF_RE.sub(IMPORT_REF_REPLACE, content)
        
    if 'exportGraphAsPNG' not in content:
        def import_replacer(match):
            return match.group(0) + "\nimport { exportGraphAsPNG } from '@/utils/exportGraph';"
        content = IMPORT_EXPORT_RE.sub(import_replacer, content)
        
    if 'const chartRef = useRef(null);' not in content:
        comp_match = re.search(r'export default function \w+\(.*\) \{', content)
        if comp_match:
            insert_pos = comp_match.end()
            content = content[:insert_pos] + '\n  const chartRef = useRef(null);' + content[insert_pos:]
            
    if 'ref={chartRef}' not in content:
        content = content.replace('{/* Chart Area */}\n        <div className="glass-container md:col-span-3"', '{/* Chart Area */}\n        <div ref={chartRef} className="glass-container md:col-span-3"')
        content = content.replace('{/* Chart Area */}\n        <div className="glass-container" style={{', '{/* Chart Area */}\n        <div ref={chartRef} className="glass-container" style={{')
        
    content = RUN_TEXT_RE.sub(RUN_TEXT_REPLACE, content)
    
    report_btn_match = CREATE_REPORT_BTN_RE.search(content)
    if not report_btn_match:
        continue
        
    report_btn_code = report_btn_match.group(0).strip()
    
    report_btn_code = report_btn_code.replace("width: '100%'", "padding: '6px 12px', fontSize: '13px'")
    report_btn_code = report_btn_code.replace("marginTop: '8px', ", "")
    report_btn_code = report_btn_code.replace('📥 Create Report (.xls)', '📊 Export Report')
    report_btn_code = report_btn_code.replace('btn-primary', 'btn-primary') 
    
    content = content[:report_btn_match.start()] + content[report_btn_match.end():]
    
    header_match = CHART_HEADER_RE.search(content)
    if header_match:
        header_full = header_match.group(0)
        
        button_group = (
            "\n            <div style={{ display: 'flex', gap: '8px' }}>\n"
            "              <button \n"
            "                className=\"btn-primary\" \n"
            "                style={{ padding: '6px 12px', fontSize: '13px', background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.4)', color: '#38bdf8' }}\n"
            "                onClick={() => exportGraphAsPNG(chartRef, '" + filename.replace('.js', '.png') + "')}\n"
            "              >\n"
            "                📈 Export Graph\n"
            "              </button>\n"
            "              " + report_btn_code + "\n"
            "            </div>"
        )
            
        new_header = header_full[:-6] + button_group + '\n          </div>'
        content = content[:header_match.start()] + new_header + content[header_match.end():]
        
    with open(filepath, 'w') as f:
        f.write(content)
        
print("Done!")
