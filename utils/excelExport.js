import * as XLSX from 'xlsx-js-style';
import { parseISO } from 'date-fns';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// ═══════════════════════════════════════════════════════════════════════
//  Style Definitions
// ═══════════════════════════════════════════════════════════════════════

const COLORS = {
  headerBg: '1B3A5C',       // dark navy for year/title headers
  subHeaderBg: '2E75B6',    // medium blue for sub-headers (Hours/Obs/Days)
  monthHeaderBg: '3A8FD6',  // lighter blue for month name row
  queryBg: 'F2F2F2',        // light gray for query description
  hourLabelBg: 'E8EEF4',    // very light blue for hour labels column
  evenRowBg: 'F7F9FC',      // subtle alternate row tint
  oddRowBg: 'FFFFFF',       // white
  borderColor: 'B0BEC5',    // soft gray border
  headerFont: 'FFFFFF',     // white text on dark headers
  totalBg: 'FFF3E0',        // warm orange tint for totals block header
  totalSubBg: 'FFE0B2',     // lighter orange for totals sub-header
};

const thinBorder = {
  top:    { style: 'thin', color: { rgb: COLORS.borderColor } },
  bottom: { style: 'thin', color: { rgb: COLORS.borderColor } },
  left:   { style: 'thin', color: { rgb: COLORS.borderColor } },
  right:  { style: 'thin', color: { rgb: COLORS.borderColor } },
};

const styles = {
  title: {
    font: { bold: true, sz: 13, color: { rgb: COLORS.headerFont } },
    fill: { fgColor: { rgb: COLORS.headerBg } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder,
  },
  queryLabel: {
    font: { bold: true, sz: 11, color: { rgb: '333333' } },
    fill: { fgColor: { rgb: COLORS.queryBg } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder,
  },
  queryValue: {
    font: { sz: 10, color: { rgb: '555555' } },
    fill: { fgColor: { rgb: COLORS.queryBg } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: thinBorder,
  },
  yearHeader: {
    font: { bold: true, sz: 12, color: { rgb: COLORS.headerFont } },
    fill: { fgColor: { rgb: COLORS.headerBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  },
  monthHeader: {
    font: { bold: true, sz: 11, color: { rgb: COLORS.headerFont } },
    fill: { fgColor: { rgb: COLORS.monthHeaderBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  },
  subHeader: {
    font: { bold: true, sz: 10, color: { rgb: COLORS.headerFont } },
    fill: { fgColor: { rgb: COLORS.subHeaderBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  },
  hourLabel: {
    font: { bold: true, sz: 10, color: { rgb: '1B3A5C' } },
    fill: { fgColor: { rgb: COLORS.hourLabelBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  },
  dataEven: {
    font: { sz: 10, color: { rgb: '333333' } },
    fill: { fgColor: { rgb: COLORS.evenRowBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  },
  dataOdd: {
    font: { sz: 10, color: { rgb: '333333' } },
    fill: { fgColor: { rgb: COLORS.oddRowBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  },
  totalYearHeader: {
    font: { bold: true, sz: 12, color: { rgb: '4E342E' } },
    fill: { fgColor: { rgb: COLORS.totalBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  },
  totalMonthHeader: {
    font: { bold: true, sz: 11, color: { rgb: '4E342E' } },
    fill: { fgColor: { rgb: COLORS.totalSubBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  },
  totalSubHeader: {
    font: { bold: true, sz: 10, color: { rgb: '4E342E' } },
    fill: { fgColor: { rgb: COLORS.totalSubBg } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  },
};

// ═══════════════════════════════════════════════════════════════════════
//  Utility: Apply style to a cell (create if not exists)
// ═══════════════════════════════════════════════════════════════════════

function cellRef(r, c) {
  return XLSX.utils.encode_cell({ r, c });
}

function setCell(ws, r, c, value, style) {
  const ref = cellRef(r, c);
  if (!ws[ref]) ws[ref] = {};
  if (value !== undefined) {
    ws[ref].v = value;
    ws[ref].t = typeof value === 'number' ? 'n' : 's';
  }
  ws[ref].s = style;
}

function ensureCell(ws, r, c, style) {
  const ref = cellRef(r, c);
  if (!ws[ref]) ws[ref] = { v: '', t: 's' };
  ws[ref].s = style;
}

// ═══════════════════════════════════════════════════════════════════════
//  generateOpsmetReport  (Obs/Days tables)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate an Opsmet-style Excel report (.xlsx) with professional styling.
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

  // ── 1. Parse & filter ──────────────────────────────────────────────
  const parsed = [];
  for (const d of data) {
    try {
      const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
      const dt = parseISO(dateStr);
      if (isNaN(dt.getTime())) continue;
      if (selectedMonths.length > 0 && !selectedMonths.includes(dt.getUTCMonth())) continue;
      parsed.push({ ...d, _dt: dt });
    } catch {
      // skip invalid
    }
  }

  if (parsed.length === 0) {
    alert('No data to export.');
    return;
  }

  const years = [...new Set(parsed.map(d => d._dt.getUTCFullYear()))].sort((a, b) => a - b);

  // ── 2. Build buckets ──────────────────────────────────────────────
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

  // ── 3. Query description ──────────────────────────────────────────
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

  // ── 4. Build worksheet rows (plain data) ──────────────────────────
  const COLS = 25; // 1 label + 12 months × 2
  const rows = [];

  // Row 0: Title
  const titleRow = new Array(COLS).fill('');
  titleRow[0] = `OPSMET ${analysis} Report — ${airport}`;
  rows.push(titleRow);

  // Row 1: Query Description label
  const qdRow = new Array(COLS).fill('');
  qdRow[0] = 'Query Description';
  rows.push(qdRow);

  // Row 2: Query params
  const qpRow = new Array(COLS).fill('');
  qpRow[0] = queryDesc;
  rows.push(qpRow);

  // Row 3: empty separator
  rows.push(new Array(COLS).fill(''));

  function addYearBlock(label, bucket) {
    const yearRow = new Array(COLS).fill('');
    yearRow[0] = `${label}/Months`;
    for (let m = 0; m < 12; m++) {
      yearRow[1 + m * 2] = MONTH_NAMES[m];
      yearRow[2 + m * 2] = '';
    }
    rows.push(yearRow);

    const subRow = new Array(COLS).fill('');
    subRow[0] = 'Hours';
    for (let m = 0; m < 12; m++) {
      subRow[1 + m * 2] = 'Obs.';
      subRow[2 + m * 2] = 'Days';
    }
    rows.push(subRow);

    for (let h = 0; h < 24; h++) {
      const hRow = new Array(COLS).fill(0);
      hRow[0] = h;
      for (let m = 0; m < 12; m++) {
        const cell = bucket[h][m];
        hRow[1 + m * 2] = cell.obs;
        hRow[2 + m * 2] = cell.days.size;
      }
      rows.push(hRow);
    }

    rows.push(new Array(COLS).fill(''));
  }

  for (const yr of years) {
    addYearBlock(String(yr), buckets[yr]);
  }

  const hasTotal = years.length > 1;
  if (hasTotal) {
    addYearBlock(`${years[0]}-${years[years.length - 1]}`, totalBucket);
  }

  // ── 5. Create worksheet ───────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  const colWidths = [{ wch: 22 }];
  for (let m = 0; m < 12; m++) {
    colWidths.push({ wch: 7 }, { wch: 7 });
  }
  ws['!cols'] = colWidths;

  // Row heights
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 28 }; // Title row

  // ── 6. Apply styles ───────────────────────────────────────────────
  // Title row (row 0)
  for (let c = 0; c < COLS; c++) ensureCell(ws, 0, c, styles.title);

  // Query rows (1-2)
  ensureCell(ws, 1, 0, styles.queryLabel);
  for (let c = 1; c < COLS; c++) ensureCell(ws, 1, c, styles.queryLabel);
  ensureCell(ws, 2, 0, styles.queryValue);
  for (let c = 1; c < COLS; c++) ensureCell(ws, 2, c, styles.queryValue);

  // Merges
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },  // Title row merge
    { s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } },  // Query value merge
  ];

  // Year blocks start at row 4
  let currentRow = 4;
  const totalBlocks = years.length + (hasTotal ? 1 : 0);

  for (let block = 0; block < totalBlocks; block++) {
    const isTotal = hasTotal && block === totalBlocks - 1;
    const yearHeaderStyle = isTotal ? styles.totalYearHeader : styles.yearHeader;
    const monthStyle = isTotal ? styles.totalMonthHeader : styles.monthHeader;
    const subStyle = isTotal ? styles.totalSubHeader : styles.subHeader;

    // Year/Months header row
    for (let c = 0; c < COLS; c++) ensureCell(ws, currentRow, c, yearHeaderStyle);

    // Month header row — merge month cells
    for (let m = 0; m < 12; m++) {
      ensureCell(ws, currentRow, 1 + m * 2, monthStyle);
      ensureCell(ws, currentRow, 2 + m * 2, monthStyle);
      ws['!merges'].push({
        s: { r: currentRow, c: 1 + m * 2 },
        e: { r: currentRow, c: 2 + m * 2 }
      });
    }

    // Sub-header row (Hours / Obs. / Days)
    for (let c = 0; c < COLS; c++) ensureCell(ws, currentRow + 1, c, subStyle);

    // Data rows (24 hours)
    for (let h = 0; h < 24; h++) {
      const dataRow = currentRow + 2 + h;
      const rowStyle = h % 2 === 0 ? styles.dataEven : styles.dataOdd;
      ensureCell(ws, dataRow, 0, styles.hourLabel); // Hour label column
      for (let c = 1; c < COLS; c++) {
        ensureCell(ws, dataRow, c, rowStyle);
      }
    }

    // Row heights for header
    if (!ws['!rows']) ws['!rows'] = [];
    ws['!rows'][currentRow] = { hpt: 24 };
    ws['!rows'][currentRow + 1] = { hpt: 20 };

    currentRow += 27;
  }

  // Freeze panes: freeze first column + header rows
  ws['!freeze'] = { xSplit: 1, ySplit: 4 };

  // ── 7. Write file ─────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const finalSheetName = sheetName || `Opsmet ${analysis} Report`;
  XLSX.utils.book_append_sheet(wb, ws, finalSheetName.substring(0, 31));

  const fileName = `${airport}-opsmet-${analysis.toLowerCase().replace(/\s+/g, '-')}-report.xlsx`;
  XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
}


// ═══════════════════════════════════════════════════════════════════════
//  generateOpsmetPctReport  (Percentage / Rate tables)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate an Opsmet-style Excel report for Percentage (Rate) tabs with styling.
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

  // ── 2. Build buckets ──────────────────────────────────────────────
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

  // ── 3. Query description ──────────────────────────────────────────
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

  // ── 4. Build rows ────────────────────────────────────────────────
  const COLS = 37; // 1 label + 12 months × 3
  const rows = [];

  // Row 0: Title
  const titleRow = new Array(COLS).fill('');
  titleRow[0] = `OPSMET ${analysis} % Report — ${airport}`;
  rows.push(titleRow);

  // Row 1-2: Query
  const qdRow = new Array(COLS).fill('');
  qdRow[0] = 'Query Description';
  rows.push(qdRow);

  const qpRow = new Array(COLS).fill('');
  qpRow[0] = queryDesc;
  rows.push(qpRow);

  // Row 3: separator
  rows.push(new Array(COLS).fill(''));

  function addYearBlock(label, bucket) {
    const yearRow = new Array(COLS).fill('');
    yearRow[0] = `${label}/Months`;
    for (let m = 0; m < 12; m++) {
      yearRow[1 + m * 3] = MONTH_NAMES[m];
    }
    rows.push(yearRow);

    const subRow = new Array(COLS).fill('');
    subRow[0] = 'Hours';
    for (let m = 0; m < 12; m++) {
      subRow[1 + m * 3] = 'Obs.';
      subRow[2 + m * 3] = 'Days';
      subRow[3 + m * 3] = 'Ratio';
    }
    rows.push(subRow);

    for (let h = 0; h < 24; h++) {
      const hRow = new Array(COLS).fill(0);
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

    rows.push(new Array(COLS).fill(''));
  }

  for (const yr of years) {
    addYearBlock(String(yr), buckets[yr]);
  }

  const hasTotal = years.length > 1;
  if (hasTotal) {
    addYearBlock(`${years[0]}-${years[years.length - 1]}`, totalBucket);
  }

  // ── 5. Create worksheet ───────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(rows);

  const colWidths = [{ wch: 22 }];
  for (let m = 0; m < 12; m++) {
    colWidths.push({ wch: 7 }, { wch: 7 }, { wch: 8 });
  }
  ws['!cols'] = colWidths;

  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 28 };

  // ── 6. Apply styles ───────────────────────────────────────────────
  for (let c = 0; c < COLS; c++) ensureCell(ws, 0, c, styles.title);
  ensureCell(ws, 1, 0, styles.queryLabel);
  for (let c = 1; c < COLS; c++) ensureCell(ws, 1, c, styles.queryLabel);
  ensureCell(ws, 2, 0, styles.queryValue);
  for (let c = 1; c < COLS; c++) ensureCell(ws, 2, c, styles.queryValue);

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } },
  ];

  let currentRow = 4;
  const totalBlocks = years.length + (hasTotal ? 1 : 0);

  for (let block = 0; block < totalBlocks; block++) {
    const isTotal = hasTotal && block === totalBlocks - 1;
    const yearHeaderStyle = isTotal ? styles.totalYearHeader : styles.yearHeader;
    const monthStyle = isTotal ? styles.totalMonthHeader : styles.monthHeader;
    const subStyle = isTotal ? styles.totalSubHeader : styles.subHeader;

    for (let c = 0; c < COLS; c++) ensureCell(ws, currentRow, c, yearHeaderStyle);

    for (let m = 0; m < 12; m++) {
      ensureCell(ws, currentRow, 1 + m * 3, monthStyle);
      ensureCell(ws, currentRow, 2 + m * 3, monthStyle);
      ensureCell(ws, currentRow, 3 + m * 3, monthStyle);
      ws['!merges'].push({
        s: { r: currentRow, c: 1 + m * 3 },
        e: { r: currentRow, c: 3 + m * 3 }
      });
    }

    for (let c = 0; c < COLS; c++) ensureCell(ws, currentRow + 1, c, subStyle);

    for (let h = 0; h < 24; h++) {
      const dataRow = currentRow + 2 + h;
      const rowStyle = h % 2 === 0 ? styles.dataEven : styles.dataOdd;
      ensureCell(ws, dataRow, 0, styles.hourLabel);
      for (let c = 1; c < COLS; c++) {
        ensureCell(ws, dataRow, c, rowStyle);
      }
    }

    if (!ws['!rows']) ws['!rows'] = [];
    ws['!rows'][currentRow] = { hpt: 24 };
    ws['!rows'][currentRow + 1] = { hpt: 20 };

    currentRow += 27;
  }

  ws['!freeze'] = { xSplit: 1, ySplit: 4 };

  // ── 7. Write file ─────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const finalSheetName = sheetName || `Opsmet ${analysis} % Report`;
  XLSX.utils.book_append_sheet(wb, ws, finalSheetName.substring(0, 31));

  const fileName = `${airport}-opsmet-${analysis.toLowerCase().replace(/\s+/g, '-')}-pct-report.xlsx`;
  XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
}


// ═══════════════════════════════════════════════════════════════════════
//  generateStationsTableReport  (Multi-station comparison)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate an Excel report for multiple stations comparison table with styling.
 */
export function generateStationsTableReport(params) {
  const { analysis, tableData, timeKeys } = params;

  if (!tableData || tableData.length === 0) {
    alert('No data to export.');
    return;
  }

  const COLS = 1 + timeKeys.length;
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

  // Column widths
  const colWidths = [{ wch: 10 }];
  for (let i = 0; i < timeKeys.length; i++) {
    colWidths.push({ wch: 10 });
  }
  ws['!cols'] = colWidths;

  // Style header row
  for (let c = 0; c < COLS; c++) {
    ensureCell(ws, 0, c, styles.yearHeader);
  }

  // Style data rows
  for (let r = 1; r <= tableData.length; r++) {
    const rowStyle = r % 2 === 0 ? styles.dataOdd : styles.dataEven;
    ensureCell(ws, r, 0, styles.hourLabel); // ICAO label
    for (let c = 1; c < COLS; c++) {
      ensureCell(ws, r, c, rowStyle);
    }
  }

  ws['!rows'] = [{ hpt: 24 }];
  ws['!freeze'] = { xSplit: 1, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  const safeAnalysis = analysis.substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, safeAnalysis);

  const fileName = `stations-${analysis.toLowerCase().replace(/\s+/g, '-')}-report.xlsx`;
  XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
}
