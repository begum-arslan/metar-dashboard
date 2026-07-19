import * as XLSX from 'xlsx';
import { parseISO } from 'date-fns';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Generate an Opsmet-style Excel report (.xls) and trigger download.
 *
 * @param {Object} params
 * @param {string} params.analysis       — e.g. "Ceiling", "Visibility"
 * @param {string} params.airport        — ICAO code e.g. "LTFM"
 * @param {string} params.begin          — Start date "YYYY-MM-DD"
 * @param {string} params.end            — End date   "YYYY-MM-DD"
 * @param {Object} params.extraParams    — Tab-specific params for the query description row
 * @param {number[]} params.selectedMonths — Month indices (0-based), empty = all
 * @param {Array}  params.data           — Raw METAR observation array
 * @param {Function} params.filterFn     — (observation) => boolean — whether it matches criteria
 * @param {string} [params.sheetName]    — Override the default sheet name
 */
export function generateOpsmetReport(params) {
  const {
    analysis,
    airport,
    begin,
    end,
    extraParams = {},
    selectedMonths = [],
    data,
    filterFn,
    sheetName,
  } = params;

  // ── 1. Parse & filter the raw data ─────────────────────────────────
  const parsed = [];
  for (const d of data) {
    try {
      const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
      const dt = parseISO(dateStr);
      if (isNaN(dt.getTime())) continue;
      // Month filter
      if (selectedMonths.length > 0 && !selectedMonths.includes(dt.getUTCMonth())) continue;
      parsed.push({ ...d, _dt: dt });
    } catch {
      // skip invalid
    }
  }

  // ── 2. Determine year range ────────────────────────────────────────
  if (parsed.length === 0) {
    alert('No data to export.');
    return;
  }

  const years = [...new Set(parsed.map(d => d._dt.getUTCFullYear()))].sort((a, b) => a - b);

  // ── 3. Build bucket: year → hour → month → { obs, days(Set) } ────
  // Also build a "total" bucket across all years
  const buckets = {};
  const totalBucket = {};

  for (let h = 0; h < 24; h++) {
    totalBucket[h] = {};
    for (let m = 0; m < 12; m++) {
      totalBucket[h][m] = { obs: 0, days: new Set() };
    }
  }

  for (const yr of years) {
    buckets[yr] = {};
    for (let h = 0; h < 24; h++) {
      buckets[yr][h] = {};
      for (let m = 0; m < 12; m++) {
        buckets[yr][h][m] = { obs: 0, days: new Set() };
      }
    }
  }

  for (const d of parsed) {
    const matches = filterFn(d);
    if (!matches) continue;

    const yr = d._dt.getUTCFullYear();
    const mo = d._dt.getUTCMonth();
    const hr = d._dt.getUTCHours();
    const dayStr = d._dt.toISOString().split('T')[0];

    if (buckets[yr] && buckets[yr][hr]) {
      buckets[yr][hr][mo].obs++;
      buckets[yr][hr][mo].days.add(dayStr);
    }
    totalBucket[hr][mo].obs++;
    totalBucket[hr][mo].days.add(dayStr);
  }

  // ── 4. Build query description string ──────────────────────────────
  const monthsStr = selectedMonths.length > 0
    ? `[${selectedMonths.map(m => m + 1).join(',')}]`
    : '[1,2,3,4,5,6,7,8,9,10,11,12]';

  const queryObj = {
    ANALYSIS: analysis,
    AIRPORT: airport,
    BEGIN: begin,
    END: end,
    ...extraParams,
    MONTHS: monthsStr
  };
  const queryDesc = JSON.stringify(queryObj);

  // ── 5. Construct worksheet rows ────────────────────────────────────
  const rows = [];
  // 25 columns: A (label col) + 12 months × 2 (Obs, Days) = 25

  // Row 1: empty
  rows.push([]);

  // Row 2: Query Description
  const qdRow = new Array(25).fill('');
  qdRow[0] = 'Query Description';
  rows.push(qdRow);

  // Row 3: query params
  const qpRow = new Array(25).fill('');
  qpRow[0] = queryDesc;
  rows.push(qpRow);

  // ── Helper: add a yearly block (or total block) ────────────────────
  function addYearBlock(label, bucket) {
    // Year/Months header row
    const yearRow = new Array(25).fill('');
    yearRow[0] = `${label}/Months`;
    for (let m = 0; m < 12; m++) {
      yearRow[1 + m * 2] = MONTH_NAMES[m];
      yearRow[2 + m * 2] = '';
    }
    rows.push(yearRow);

    // Sub-header: Hours | Obs. | Days | Obs. | Days | ...
    const subRow = new Array(25).fill('');
    subRow[0] = 'Hours';
    for (let m = 0; m < 12; m++) {
      subRow[1 + m * 2] = 'Obs.';
      subRow[2 + m * 2] = 'Days';
    }
    rows.push(subRow);

    // 24 hour rows
    for (let h = 0; h < 24; h++) {
      const hRow = new Array(25).fill(0);
      hRow[0] = h;
      for (let m = 0; m < 12; m++) {
        const cell = bucket[h][m];
        hRow[1 + m * 2] = cell.obs;
        hRow[2 + m * 2] = cell.days.size;
      }
      rows.push(hRow);
    }

    // Empty separator row
    rows.push([]);
  }

  // ── 6. Add each year block ─────────────────────────────────────────
  for (const yr of years) {
    addYearBlock(String(yr), buckets[yr]);
  }

  // ── 7. Add totals block ────────────────────────────────────────────
  if (years.length > 1) {
    addYearBlock(`${years[0]}-${years[years.length - 1]}`, totalBucket);
  }

  // ── 8. Create workbook & write to .xls ─────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  const colWidths = [{ wch: 20 }];
  for (let m = 0; m < 12; m++) {
    colWidths.push({ wch: 6 }); // Obs
    colWidths.push({ wch: 6 }); // Days
  }
  ws['!cols'] = colWidths;

  // Merge cells for month headers (each month spans 2 columns)
  ws['!merges'] = [];

  // For each year block, merge the month header cells
  let currentRow = 3; // 0-indexed row where first year block starts (Row 4 in 1-indexed = index 3)
  for (let block = 0; block < years.length + (years.length > 1 ? 1 : 0); block++) {
    for (let m = 0; m < 12; m++) {
      ws['!merges'].push({
        s: { r: currentRow, c: 1 + m * 2 },
        e: { r: currentRow, c: 2 + m * 2 }
      });
    }
    currentRow += 27; // 1 (year header) + 1 (sub header) + 24 (hours) + 1 (separator) = 27
  }

  const wb = XLSX.utils.book_new();
  const finalSheetName = sheetName || `Opsmet ${analysis} Report`;
  XLSX.utils.book_append_sheet(wb, ws, finalSheetName.substring(0, 31)); // Excel max sheet name = 31 chars

  // Generate and download
  const fileName = `${airport}-opsmet-${analysis.toLowerCase().replace(/\s+/g, '-')}-report.xls`;
  XLSX.writeFile(wb, fileName, { bookType: 'xls' });
}

/**
 * Generate an Opsmet-style Excel report for Percentage (Rate) tabs.
 * Instead of Obs/Days per hour×month, this generates Rate values.
 *
 * @param {Object} params
 * @param {string} params.analysis
 * @param {string} params.airport
 * @param {string} params.begin
 * @param {string} params.end
 * @param {Object} params.extraParams
 * @param {number[]} params.selectedMonths
 * @param {Array}  params.data
 * @param {Function} params.criteriaFn  — (observation) => boolean — whether it matches criteria
 * @param {string} [params.sheetName]
 */
export function generateOpsmetPctReport(params) {
  const {
    analysis,
    airport,
    begin,
    end,
    extraParams = {},
    selectedMonths = [],
    data,
    criteriaFn,
    sheetName,
  } = params;

  // ── 1. Parse data ──────────────────────────────────────────────────
  const parsed = [];
  for (const d of data) {
    try {
      const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
      const dt = parseISO(dateStr);
      if (isNaN(dt.getTime())) continue;
      if (selectedMonths.length > 0 && !selectedMonths.includes(dt.getUTCMonth())) continue;
      parsed.push({ ...d, _dt: dt });
    } catch {
      // skip
    }
  }

  if (parsed.length === 0) {
    alert('No data to export.');
    return;
  }

  const years = [...new Set(parsed.map(d => d._dt.getUTCFullYear()))].sort((a, b) => a - b);

  // ── 2. Build buckets: year → hour → month → { criteriaRec: Set, metarRec: Set } ──
  const buckets = {};
  const totalBucket = {};

  for (let h = 0; h < 24; h++) {
    totalBucket[h] = {};
    for (let m = 0; m < 12; m++) {
      totalBucket[h][m] = { criteriaRec: new Set(), metarRec: new Set() };
    }
  }

  for (const yr of years) {
    buckets[yr] = {};
    for (let h = 0; h < 24; h++) {
      buckets[yr][h] = {};
      for (let m = 0; m < 12; m++) {
        buckets[yr][h][m] = { criteriaRec: new Set(), metarRec: new Set() };
      }
    }
  }

  for (const d of parsed) {
    const yr = d._dt.getUTCFullYear();
    const mo = d._dt.getUTCMonth();
    const hr = d._dt.getUTCHours();
    const dayStr = d._dt.toISOString().split('T')[0];

    if (buckets[yr] && buckets[yr][hr]) {
      buckets[yr][hr][mo].metarRec.add(dayStr);
      totalBucket[hr][mo].metarRec.add(dayStr);

      if (criteriaFn(d)) {
        buckets[yr][hr][mo].criteriaRec.add(dayStr);
        totalBucket[hr][mo].criteriaRec.add(dayStr);
      }
    }
  }

  // ── 3. Build query description ─────────────────────────────────────
  const monthsStr = selectedMonths.length > 0
    ? `[${selectedMonths.map(m => m + 1).join(',')}]`
    : '[1,2,3,4,5,6,7,8,9,10,11,12]';

  const queryObj = {
    ANALYSIS: `${analysis} %`,
    AIRPORT: airport,
    BEGIN: begin,
    END: end,
    ...extraParams,
    MONTHS: monthsStr
  };
  const queryDesc = JSON.stringify(queryObj);

  // ── 4. Construct worksheet rows ────────────────────────────────────
  const rows = [];
  // 37 cols: A (label) + 12 months × 3 (Obs, Days, Ratio) = 37

  rows.push([]); // Row 1: empty

  const qdRow = new Array(37).fill('');
  qdRow[0] = 'Query Description';
  rows.push(qdRow);

  const qpRow = new Array(37).fill('');
  qpRow[0] = queryDesc;
  rows.push(qpRow);

  function addYearBlock(label, bucket) {
    const yearRow = new Array(37).fill('');
    yearRow[0] = `${label}/Months`;
    for (let m = 0; m < 12; m++) {
      yearRow[1 + m * 3] = MONTH_NAMES[m];
    }
    rows.push(yearRow);

    const subRow = new Array(37).fill('');
    subRow[0] = 'Hours';
    for (let m = 0; m < 12; m++) {
      subRow[1 + m * 3] = 'Obs.';
      subRow[2 + m * 3] = 'Days';
      subRow[3 + m * 3] = 'Ratio';
    }
    rows.push(subRow);

    for (let h = 0; h < 24; h++) {
      const hRow = new Array(37).fill(0);
      hRow[0] = h;
      for (let m = 0; m < 12; m++) {
        const cell = bucket[h][m];
        const metarSize = cell.metarRec.size;
        const criteriaSize = cell.criteriaRec.size;
        hRow[1 + m * 3] = metarSize;
        hRow[2 + m * 3] = criteriaSize;
        hRow[3 + m * 3] = metarSize > 0
          ? parseFloat(((criteriaSize / metarSize) * 100).toFixed(1))
          : 0;
      }
      rows.push(hRow);
    }

    rows.push([]);
  }

  for (const yr of years) {
    addYearBlock(String(yr), buckets[yr]);
  }

  if (years.length > 1) {
    addYearBlock(`${years[0]}-${years[years.length - 1]}`, totalBucket);
  }

  // ── 5. Create workbook ─────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(rows);

  const colWidths = [{ wch: 20 }];
  for (let m = 0; m < 12; m++) {
    colWidths.push({ wch: 7 }, { wch: 7 }, { wch: 7 });
  }
  ws['!cols'] = colWidths;

  // Merge month header cells (each month spans 3 columns)
  ws['!merges'] = [];
  let currentRow = 3;
  for (let block = 0; block < years.length + (years.length > 1 ? 1 : 0); block++) {
    for (let m = 0; m < 12; m++) {
      ws['!merges'].push({
        s: { r: currentRow, c: 1 + m * 3 },
        e: { r: currentRow, c: 3 + m * 3 }
      });
    }
    currentRow += 27;
  }

  const wb = XLSX.utils.book_new();
  const finalSheetName = sheetName || `Opsmet ${analysis} % Report`;
  XLSX.utils.book_append_sheet(wb, ws, finalSheetName.substring(0, 31));

  const fileName = `${airport}-opsmet-${analysis.toLowerCase().replace(/\s+/g, '-')}-pct-report.xls`;
  XLSX.writeFile(wb, fileName, { bookType: 'xls' });
}

/**
 * Generate an Excel report for multiple stations comparison table.
 *
 * @param {Object} params
 * @param {string} params.analysis
 * @param {Array} params.tableData
 * @param {Array} params.timeKeys
 */
export function generateStationsTableReport(params) {
  const { analysis, tableData, timeKeys } = params;

  if (!tableData || tableData.length === 0) {
    alert('No data to export.');
    return;
  }

  const rows = [];
  
  // Header row
  const header = ['ICAO', ...timeKeys];
  rows.push(header);

  // Data rows
  for (const row of tableData) {
    const dataRow = [row.station];
    for (const tk of timeKeys) {
      dataRow.push(row[tk] > 0 ? row[tk] : 0);
    }
    rows.push(dataRow);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const safeAnalysis = analysis.substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeAnalysis);

  const fileName = `stations-${analysis.toLowerCase().replace(/\s+/g, '-')}-report.xls`;
  XLSX.writeFile(wb, fileName, { bookType: 'xls' });
}
