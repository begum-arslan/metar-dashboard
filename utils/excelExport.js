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
  if (params.analysis && (params.analysis.toLowerCase().includes('temperature') && params.analysis.includes('Without Value'))) {
    return generateTemperatureWithoutValueReport(params);
  }
  if (params.analysis && (params.analysis.toLowerCase().includes('pressure') && params.analysis.includes('Without Value'))) {
    return generatePressureWithoutValueReport(params);
  }

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

  const stations = [...new Set(parsed.map(d => d.station))];
  const wb = XLSX.utils.book_new();

  for (const st of stations) {
    const stationParsed = parsed.filter(d => d.station === st);
    if (stationParsed.length === 0) continue;

const years = [...new Set(stationParsed.map(d => d._dt.getUTCFullYear()))].sort((a, b) => a - b);

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

  for (const d of stationParsed) {
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
  titleRow[0] = `${airport || 'Multiple Stations'} ${analysis} Report`;
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
  
    XLSX.utils.book_append_sheet(wb, ws, st.substring(0, 31));
  }

    
  const fileName = `${airport}-${analysis.toLowerCase().replace(/\s+/g, '-')}-report.xlsx`;
  XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
}

// ═══════════════════════════════════════════════════════════════════════
//  generateTemperatureWithoutValueReport  (Min / Max / Avg per Month)
// ═══════════════════════════════════════════════════════════════════════

export function generateTemperatureWithoutValueReport(params) {
  const {
    analysis = 'Temperature Without Value',
    airport,
    begin,
    end,
    extraParams = {},
    selectedMonths = [],
    data,
  } = params;

  const parsed = [];
  for (const d of data) {
    try {
      if (typeof d.temperature !== 'number' || isNaN(d.temperature)) continue;
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

  const stations = [...new Set(parsed.map(d => d.station))];
  const wb = XLSX.utils.book_new();

  for (const st of stations) {
    const stationParsed = parsed.filter(d => d.station === st);
    if (stationParsed.length === 0) continue;

    const years = [...new Set(stationParsed.map(d => d._dt.getUTCFullYear()))].sort((a, b) => a - b);

    const buckets = {};
    const totalBucket = {};

    for (let h = 0; h < 24; h++) {
      totalBucket[h] = {};
      for (let m = 0; m < 12; m++) {
        totalBucket[h][m] = [];
      }
    }

    for (const yr of years) {
      buckets[yr] = {};
      for (let h = 0; h < 24; h++) {
        buckets[yr][h] = {};
        for (let m = 0; m < 12; m++) {
          buckets[yr][h][m] = [];
        }
      }
    }

    for (const d of stationParsed) {
      const yr = d._dt.getUTCFullYear();
      const mo = d._dt.getUTCMonth();
      const hr = d._dt.getUTCHours();
      if (buckets[yr] && buckets[yr][hr]) {
        buckets[yr][hr][mo].push(d.temperature);
      }
      totalBucket[hr][mo].push(d.temperature);
    }

    const monthsArray = selectedMonths.length > 0
      ? selectedMonths.map(m => m + 1)
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    const queryObj = {
      ANALYSIS: 'Temperature Without Value',
      AIRPORT: airport || st,
      BEGIN: begin,
      END: end,
      MONTHS: monthsArray,
      TEMPERATURE_MIN: -55,
      TEMPERATURE_MAX: 55,
      PERCENTILE: extraParams.PERCENTILE !== undefined ? extraParams.PERCENTILE : null
    };
    const queryDesc = JSON.stringify(queryObj);

    const COLS = 37;
    const rows = [];

    const titleRow = new Array(COLS).fill('');
    titleRow[0] = `${airport || st} Temperature Without Value Report`;
    rows.push(titleRow);

    const qdRow = new Array(COLS).fill('');
    qdRow[0] = 'Query Description';
    rows.push(qdRow);

    const qpRow = new Array(COLS).fill('');
    qpRow[0] = queryDesc;
    rows.push(qpRow);

    rows.push(new Array(COLS).fill(''));

    function addYearBlock(label, bucket) {
      const yearRow = new Array(COLS).fill('');
      yearRow[0] = `${label}/Months`;
      for (let m = 0; m < 12; m++) {
        yearRow[1 + m * 3] = MONTH_NAMES[m];
        yearRow[2 + m * 3] = '';
        yearRow[3 + m * 3] = '';
      }
      rows.push(yearRow);

      const subRow = new Array(COLS).fill('');
      subRow[0] = 'Hours';
      for (let m = 0; m < 12; m++) {
        subRow[1 + m * 3] = 'Max';
        subRow[2 + m * 3] = 'Avg';
        subRow[3 + m * 3] = 'Min';
      }
      rows.push(subRow);

      for (let h = 0; h < 24; h++) {
        const hRow = new Array(COLS).fill('');
        hRow[0] = h;
        for (let m = 0; m < 12; m++) {
          const temps = bucket[h][m];
          if (temps && temps.length > 0) {
            const minVal = Math.min(...temps);
            const maxVal = Math.max(...temps);
            const avgVal = parseFloat((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1));
            hRow[1 + m * 3] = maxVal;
            hRow[2 + m * 3] = avgVal;
            hRow[3 + m * 3] = minVal;
          }
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

    const ws = XLSX.utils.aoa_to_sheet(rows);

    const colWidths = [{ wch: 18 }];
    for (let c = 1; c < COLS; c++) {
      colWidths.push({ wch: 6 });
    }
    ws['!cols'] = colWidths;

    ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 28 };

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
        const startCol = 1 + m * 3;
        ensureCell(ws, currentRow, startCol, monthStyle);
        ensureCell(ws, currentRow, startCol + 1, monthStyle);
        ensureCell(ws, currentRow, startCol + 2, monthStyle);
        ws['!merges'].push({
          s: { r: currentRow, c: startCol },
          e: { r: currentRow, c: startCol + 2 }
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

      ws['!rows'][currentRow] = { hpt: 24 };
      ws['!rows'][currentRow + 1] = { hpt: 20 };

      currentRow += 27;
    }

    ws['!freeze'] = { xSplit: 1, ySplit: 4 };

    XLSX.utils.book_append_sheet(wb, ws, st.substring(0, 31));
  }

  const fileName = `${airport || 'report'}-temperature-without-value-report.xlsx`;
  XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
}


// ═══════════════════════════════════════════════════════════════════════
//  generatePressureWithoutValueReport  (Pressure Without Value tables)
// ═══════════════════════════════════════════════════════════════════════

export function generatePressureWithoutValueReport(params) {
  const {
    analysis = 'Pressure (Without Value)',
    airport,
    begin,
    end,
    extraParams = {},
    selectedMonths = [],
    data,
  } = params;

  const parsed = [];
  for (const d of data) {
    try {
      if (typeof d.pressureHpa !== 'number' || isNaN(d.pressureHpa)) continue;
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

  const stations = [...new Set(parsed.map(d => d.station))];
  const wb = XLSX.utils.book_new();

  for (const st of stations) {
    const stationParsed = parsed.filter(d => d.station === st);
    if (stationParsed.length === 0) continue;

    const years = [...new Set(stationParsed.map(d => d._dt.getUTCFullYear()))].sort((a, b) => a - b);

    const buckets = {};
    const totalBucket = {};

    for (let h = 0; h < 24; h++) {
      totalBucket[h] = {};
      for (let m = 0; m < 12; m++) {
        totalBucket[h][m] = [];
      }
    }

    for (const yr of years) {
      buckets[yr] = {};
      for (let h = 0; h < 24; h++) {
        buckets[yr][h] = {};
        for (let m = 0; m < 12; m++) {
          buckets[yr][h][m] = [];
        }
      }
    }

    for (const d of stationParsed) {
      const yr = d._dt.getUTCFullYear();
      const mo = d._dt.getUTCMonth();
      const hr = d._dt.getUTCHours();
      if (buckets[yr] && buckets[yr][hr]) {
        buckets[yr][hr][mo].push(d.pressureHpa);
      }
      totalBucket[hr][mo].push(d.pressureHpa);
    }

    const monthsArray = selectedMonths.length > 0
      ? selectedMonths.map(m => m + 1)
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    const queryObj = {
      ANALYSIS: 'Pressure (Without Value)',
      AIRPORT: airport || st,
      BEGIN: begin,
      END: end,
      MONTHS: monthsArray,
      PRESSURE_MIN: 900,
      PRESSURE_MAX: 1100,
      PERCENTILE: extraParams.PERCENTILE !== undefined ? extraParams.PERCENTILE : null
    };
    const queryDesc = JSON.stringify(queryObj);

    const COLS = 37;
    const rows = [];

    const titleRow = new Array(COLS).fill('');
    titleRow[0] = `${airport || st} Pressure (Without Value) Report`;
    rows.push(titleRow);

    const qdRow = new Array(COLS).fill('');
    qdRow[0] = 'Query Description';
    rows.push(qdRow);

    const qpRow = new Array(COLS).fill('');
    qpRow[0] = queryDesc;
    rows.push(qpRow);

    rows.push(new Array(COLS).fill(''));

    function addYearBlock(label, bucket) {
      const yearRow = new Array(COLS).fill('');
      yearRow[0] = `${label}/Months`;
      for (let m = 0; m < 12; m++) {
        yearRow[1 + m * 3] = MONTH_NAMES[m];
        yearRow[2 + m * 3] = '';
        yearRow[3 + m * 3] = '';
      }
      rows.push(yearRow);

      const subRow = new Array(COLS).fill('');
      subRow[0] = 'Hours';
      for (let m = 0; m < 12; m++) {
        subRow[1 + m * 3] = 'Max';
        subRow[2 + m * 3] = 'Avg';
        subRow[3 + m * 3] = 'Min';
      }
      rows.push(subRow);

      for (let h = 0; h < 24; h++) {
        const hRow = new Array(COLS).fill('');
        hRow[0] = h;
        for (let m = 0; m < 12; m++) {
          const pressures = bucket[h][m];
          if (pressures && pressures.length > 0) {
            const minVal = Math.min(...pressures);
            const maxVal = Math.max(...pressures);
            const avgVal = parseFloat((pressures.reduce((a, b) => a + b, 0) / pressures.length).toFixed(1));
            hRow[1 + m * 3] = maxVal;
            hRow[2 + m * 3] = avgVal;
            hRow[3 + m * 3] = minVal;
          }
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

    const ws = XLSX.utils.aoa_to_sheet(rows);

    const colWidths = [{ wch: 18 }];
    for (let c = 1; c < COLS; c++) {
      colWidths.push({ wch: 8 });
    }
    ws['!cols'] = colWidths;

    ws['!rows'] = [];
    ws['!rows'][0] = { hpt: 28 };

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
        const startCol = 1 + m * 3;
        ensureCell(ws, currentRow, startCol, monthStyle);
        ensureCell(ws, currentRow, startCol + 1, monthStyle);
        ensureCell(ws, currentRow, startCol + 2, monthStyle);
        ws['!merges'].push({
          s: { r: currentRow, c: startCol },
          e: { r: currentRow, c: startCol + 2 }
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

      ws['!rows'][currentRow] = { hpt: 24 };
      ws['!rows'][currentRow + 1] = { hpt: 20 };

      currentRow += 27;
    }

    ws['!freeze'] = { xSplit: 1, ySplit: 4 };

    XLSX.utils.book_append_sheet(wb, ws, st.substring(0, 31));
  }

  const fileName = `${airport || 'report'}-pressure-without-value-report.xlsx`;
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

  const stations = [...new Set(parsed.map(d => d.station))];
  const wb = XLSX.utils.book_new();

  for (const st of stations) {
    const stationParsed = parsed.filter(d => d.station === st);
    if (stationParsed.length === 0) continue;

const years = [...new Set(stationParsed.map(d => d._dt.getUTCFullYear()))].sort((a, b) => a - b);

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

  for (const d of stationParsed) {
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
  titleRow[0] = `${airport || 'Multiple Stations'} ${analysis} % Report`;
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
  
    XLSX.utils.book_append_sheet(wb, ws, st.substring(0, 31));
  }

    
  const fileName = `${airport}-${analysis.toLowerCase().replace(/\s+/g, '-')}-pct-report.xlsx`;
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


export function generateDetailedWindReport(params) {
  const {
    analysis,
    airport,
    begin,
    end,
    extraParams = {},
    selectedMonths = [],
    data,
    filterFn,
  } = params;

  const parsed = [];
  for (const d of data) {
    try {
      const dateStr = d.valid.includes('T') ? d.valid : `${d.valid.replace(' ', 'T')}Z`;
      const dt = parseISO(dateStr);
      if (isNaN(dt.getTime())) continue;
      if (selectedMonths.length > 0 && !selectedMonths.includes(dt.getUTCMonth())) continue;
      if (filterFn && !filterFn(d)) continue;
      
      let wspd = null;
      if (typeof d.windSpeed === 'number') wspd = d.windSpeed;
      else if (d.wind && typeof d.wind.speedKt === 'number') wspd = d.wind.speedKt;
      if (wspd === null) continue;

      if (params.includeGusts) {
        let gust = null;
        if (typeof d.windGust === 'number') gust = d.windGust;
        else if (d.wind && typeof d.wind.gust === 'number') gust = d.wind.gust;
        if (gust !== null && gust > 0) wspd = gust;
      }
      
      parsed.push({ ...d, _dt: dt, _wspd: wspd });
    } catch {}
  }

  if (parsed.length === 0) {
    alert('No data to export.');
    return;
  }

  const stations = [...new Set(parsed.map(d => d.station))];
  const wb = XLSX.utils.book_new();

  for (const st of stations) {
    const stParsed = parsed.filter(d => d.station === st);
    if (stParsed.length === 0) continue;

    const years = [...new Set(stParsed.map(d => d._dt.getUTCFullYear()))].sort((a, b) => a - b);
    
    const hourlyByYear = {};
    const yearlyByMonth = {};
    const totalHourlyByMonth = {};
    const totalMonthly = {};
    const totalHourly = {};

    const initBucket = () => ({ obs: 0, sum: 0, max: -Infinity, min: Infinity });

    for (let m = 0; m < 12; m++) {
      totalMonthly[m] = initBucket();
      for (let h = 0; h < 24; h++) {
        if (!totalHourlyByMonth[h]) totalHourlyByMonth[h] = {};
        totalHourlyByMonth[h][m] = initBucket();
      }
    }
    for (let h = 0; h < 24; h++) {
      totalHourly[h] = initBucket();
    }

    for (const y of years) {
      hourlyByYear[y] = {};
      yearlyByMonth[y] = {};
      for (let m = 0; m < 12; m++) yearlyByMonth[y][m] = initBucket();
      for (let h = 0; h < 24; h++) {
        hourlyByYear[y][h] = {};
        for (let m = 0; m < 12; m++) hourlyByYear[y][h][m] = initBucket();
      }
    }

    for (const d of stParsed) {
      const y = d._dt.getUTCFullYear();
      const m = d._dt.getUTCMonth();
      const h = d._dt.getUTCHours();
      const spd = d._wspd;

      const update = (b) => {
        b.obs++;
        b.sum += spd;
        if (spd > b.max) b.max = spd;
        if (spd < b.min) b.min = spd;
      };

      update(hourlyByYear[y][h][m]);
      update(yearlyByMonth[y][m]);
      update(totalHourlyByMonth[h][m]);
      update(totalMonthly[m]);
      update(totalHourly[h]);
    }

    const formatBucket = (b) => {
      if (b.obs === 0) return { max: '', avg: '', min: '', obs: 0 };
      return {
        max: b.max,
        avg: parseFloat((b.sum / b.obs).toFixed(1)),
        min: b.min,
        obs: b.obs
      };
    };

    const COLS = 49; 
    const rows = [];
    const merges = [];
    const cellStyles = [];

    const addRow = (rowArr) => {
      while(rowArr.length < COLS) rowArr.push('');
      rows.push(rowArr);
      return rows.length - 1;
    };

    // Row 0-2: Query details
    const titleRow = new Array(COLS).fill('');
    titleRow[0] = `${st} Opsmet Prevailing Wind Report`;
    addRow(titleRow);
    
    const qdRow = new Array(COLS).fill('');
    qdRow[0] = 'Query Description';
    addRow(qdRow);

    const monthsStr = selectedMonths.length > 0 ? `[${selectedMonths.map(m => m + 1).join(',')}]` : '[1,2,3,4,5,6,7,8,9,10,11,12]';
    const queryObj = { ANALYSIS: analysis, AIRPORT: st, BEGIN: begin, END: end, ...extraParams, MONTHS: monthsStr };
    const qpRow = new Array(COLS).fill('');
    qpRow[0] = JSON.stringify(queryObj);
    addRow(qpRow);
    addRow(new Array(COLS).fill('')); // Empty row

    // Styles array mapping
    // cellStyles.push({ r: rowIndex, c: colIndex, style: styleObject });

    const applyStyle = (r, c, style) => {
      cellStyles.push({ r, c, style });
    };

    const applyRowStyle = (r, startCol, endCol, style) => {
      for (let c = startCol; c <= endCol; c++) applyStyle(r, c, style);
    };

    // Helper to generate the Month + Max/Avg/Min/Obs headers
    const generateMonthHeaders = (rLabel, titleText) => {
      const r1 = new Array(COLS).fill('');
      r1[0] = titleText;
      for (let m = 0; m < 12; m++) {
        r1[1 + m * 4] = MONTH_NAMES[m];
      }
      const r1Idx = addRow(r1);

      const r2 = new Array(COLS).fill('');
      r2[0] = rLabel;
      for (let m = 0; m < 12; m++) {
        r2[1 + m * 4] = 'Max';
        r2[1 + m * 4 + 1] = 'Avg';
        r2[1 + m * 4 + 2] = 'Min';
        r2[1 + m * 4 + 3] = 'Obs';
      }
      const r2Idx = addRow(r2);

      // Merges & Styles
      applyStyle(r1Idx, 0, styles.yearHeader);
      applyStyle(r2Idx, 0, styles.hourLabel);
      for (let m = 0; m < 12; m++) {
        const startC = 1 + m * 4;
        merges.push({ s: { r: r1Idx, c: startC }, e: { r: r1Idx, c: startC + 3 } });
        applyRowStyle(r1Idx, startC, startC + 3, styles.monthHeader);
        applyRowStyle(r2Idx, startC, startC + 3, styles.subHeader);
      }
      return { r1Idx, r2Idx };
    };

    const addDataRow = (label, dataBuckets, isEven, labelStyle = styles.hourLabel) => {
      const rowArr = new Array(COLS).fill('');
      rowArr[0] = label;
      for (let m = 0; m < 12; m++) {
        const fb = formatBucket(dataBuckets[m]);
        const startC = 1 + m * 4;
        rowArr[startC] = fb.max;
        rowArr[startC + 1] = fb.avg;
        rowArr[startC + 2] = fb.min;
        rowArr[startC + 3] = fb.obs;
      }
      const rIdx = addRow(rowArr);
      const dataStyle = isEven ? styles.dataEven : styles.dataOdd;
      applyStyle(rIdx, 0, labelStyle);
      applyRowStyle(rIdx, 1, COLS - 1, dataStyle);
    };

    // 1. Hourly breakdown per year
    for (const y of years) {
      generateMonthHeaders('Hours', `${y}/Months`);
      for (let h = 0; h < 24; h++) {
        addDataRow(h, hourlyByYear[y][h], h % 2 === 0);
      }
      addRow(new Array(COLS).fill('')); // Spacer
    }

    // 2. Yearly breakdown (Total across hours for each year)
    generateMonthHeaders('Years', `${years[0]}-${years[years.length - 1]}/Months`);
    for (let i = 0; i < years.length; i++) {
      const y = years[i];
      addDataRow(y, yearlyByMonth[y], i % 2 === 0);
    }
    addDataRow('Total Monthly', totalMonthly, years.length % 2 === 0, styles.totalMonthHeader);
    addRow(new Array(COLS).fill('')); // Spacer

    // 3. Hourly breakdown across all years
    generateMonthHeaders('Hours', `${years[0]}-${years[years.length - 1]}/Months`);
    for (let h = 0; h < 24; h++) {
      addDataRow(h, totalHourlyByMonth[h], h % 2 === 0);
    }
    addRow(new Array(COLS).fill('')); // Spacer

    // 4. Overall Total Hourly (no months, just one block)
    const tH1 = new Array(COLS).fill('');
    tH1[0] = 'Total Hourly';
    const th1Idx = addRow(tH1);
    
    const tH2 = new Array(COLS).fill('');
    tH2[0] = 'Hour';
    tH2[1] = 'Max'; tH2[2] = 'Avg'; tH2[3] = 'Min'; tH2[4] = 'Obs';
    const th2Idx = addRow(tH2);

    applyStyle(th1Idx, 0, styles.yearHeader);
    applyStyle(th2Idx, 0, styles.hourLabel);
    applyRowStyle(th2Idx, 1, 4, styles.subHeader);
    merges.push({ s: { r: th1Idx, c: 0 }, e: { r: th1Idx, c: 4 } });

    for (let h = 0; h < 24; h++) {
      const rArr = new Array(COLS).fill('');
      rArr[0] = h;
      const fb = formatBucket(totalHourly[h]);
      rArr[1] = fb.max; rArr[2] = fb.avg; rArr[3] = fb.min; rArr[4] = fb.obs;
      const rIdx = addRow(rArr);
      const ds = h % 2 === 0 ? styles.dataEven : styles.dataOdd;
      applyStyle(rIdx, 0, styles.hourLabel);
      applyRowStyle(rIdx, 1, 4, ds);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Apply basic styles for title rows
    applyStyle(0, 0, styles.title);
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: COLS - 1 } });
    applyStyle(1, 0, styles.queryLabel);
    merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: COLS - 1 } });
    applyStyle(2, 0, styles.queryValue);
    merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: COLS - 1 } });

    // Ensure cell function
    const ensureCell = (worksheet, r, c, styleObj) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!worksheet[addr]) worksheet[addr] = { t: 's', v: '' };
      worksheet[addr].s = styleObj;
    };

    for (const css of cellStyles) {
      ensureCell(ws, css.r, css.c, css.style);
    }
    
    ws['!merges'] = merges;
    const colWidths = [{ wch: 10 }];
    for (let i = 1; i < COLS; i++) colWidths.push({ wch: 6 });
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, st);
  }

  const fileName = `stations-prevailing-wind-report.xlsx`;
  XLSX.writeFile(wb, fileName, { bookType: 'xlsx' });
}
