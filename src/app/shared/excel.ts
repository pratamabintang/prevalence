import * as XLSX from 'xlsx-js-style';

export interface ColumnInfo {
  colIndex: number;
  colLetter?: string;
  header: string;
  leafHeader: string;
  layers: string[];
}

export interface ColumnHeaderMeta {
  key: string;
  layers: string[];
}

export interface HeaderGridCell {
  text: string;
  rowspan: number;
  colspan: number;
  covered: boolean;
  colKey?: string;
}

export interface SheetStructure {
  headerStartRow: number;
  headerEndRow: number;
  dataStartRow: number;
}

export interface CellStyle {
  font?: {
    bold?: boolean;
    color?: { rgb: string };
    sz?: number;
  };
  fill?: {
    fgColor?: { rgb: string };
  };
  alignment?: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'top' | 'center' | 'bottom';
    wrapText?: boolean;
  };
  border?: {
    top?: { style: string; color: { rgb: string } };
    bottom?: { style: string; color: { rgb: string } };
    left?: { style: string; color: { rgb: string } };
    right?: { style: string; color: { rgb: string } };
  };
  numFmt?: string;
}

export interface SummaryRowSpec {
  values: Record<string, unknown>;
  styler?: (colKey: string, val: unknown, colIndex: number) => CellStyle | undefined;
  defaultStyle?: CellStyle;
}

export interface StyledExportSpec {
  fileName: string;
  sheetName?: string;
  columns: ColumnHeaderMeta[];
  dataRows: Record<string, unknown>[];
  summaryRows?: SummaryRowSpec[];
  cellStyler?: (
    row: Record<string, unknown>,
    colKey: string,
    val: unknown,
    colIndex: number,
  ) => CellStyle | undefined;
  colWidths?: Record<string, number> | ((colKey: string, colIndex: number) => number);
}

/**
 * ExcelEngine: Modul operasi spreadsheet generik berbasis SheetJS dan xlsx-js-style.
 * Modul ini murni (pure), tugas-agnostik, dan tidak memuat dependensi UI maupun aturan bisnis tertentu.
 */
export class ExcelEngine {
  /**
   * Membaca file biner/ArrayBuffer menjadi objek WorkBook SheetJS.
   */
  static readWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
    return XLSX.read(buffer, {
      type: 'array',
      raw: true,
    });
  }

  /**
   * Mendeteksi letak baris awal header, sub-header, dan baris data pada worksheet secara otomatis.
   */
  static detectSheetStructure(worksheet: XLSX.WorkSheet): SheetStructure {
    if (!worksheet['!ref']) {
      return { headerStartRow: 1, headerEndRow: 1, dataStartRow: 2 };
    }

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const merges = worksheet['!merges'] || [];
    const maxRowToScan = Math.min(range.e.r, range.s.r + 30);

    let startRow = -1;

    for (let r = range.s.r; r <= maxRowToScan; r++) {
      let filledCols = 0;
      let hasMerge = false;

      for (let c = range.s.c; c <= range.e.c; c++) {
        const val = this.getCellValue(worksheet, r, c);
        if (val) {
          filledCols++;
        }
        const m = merges.find(
          (merge) => r >= merge.s.r && r <= merge.e.r && c >= merge.s.c && c <= merge.e.c,
        );
        if (m) {
          hasMerge = true;
        }
      }

      const threshold = Math.min(2, range.e.c - range.s.c + 1);
      if (filledCols >= threshold || (hasMerge && filledCols >= 1)) {
        startRow = r;
        break;
      }
    }

    if (startRow === -1) {
      startRow = range.s.r;
    }

    let endRow = startRow;

    for (let r = startRow + 1; r <= maxRowToScan; r++) {
      const hasVerticalMergeFromAbove = merges.some(
        (m) => m.s.r <= endRow && m.e.r >= r,
      );

      const hasHorizontalMergeAtRow = merges.some(
        (m) => m.s.r === r && m.e.r === r && m.e.c > m.s.c,
      );

      const aboveHorizontalMerges = merges.filter(
        (m) => m.s.r <= endRow && m.e.r >= startRow && m.e.c > m.s.c,
      );

      let textCount = 0;
      let numberCount = 0;
      let hasTextUnderAboveMerge = false;

      for (let c = range.s.c; c <= range.e.c; c++) {
        const address = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[address];
        if (cell?.v !== undefined && cell?.v !== null && String(cell.v).trim() !== '') {
          if (typeof cell.v === 'number') {
            numberCount++;
          } else {
            textCount++;
          }

          if (aboveHorizontalMerges.some((m) => c >= m.s.c && c <= m.e.c)) {
            hasTextUnderAboveMerge = true;
          }
        }
      }

      const isHeaderRelation =
        hasVerticalMergeFromAbove ||
        hasHorizontalMergeAtRow ||
        hasTextUnderAboveMerge;

      if (isHeaderRelation && textCount > 0 && textCount >= numberCount) {
        endRow = r;
      } else {
        break;
      }
    }

    const headerStartRow1Based = startRow + 1;
    const headerEndRow1Based = endRow + 1;
    const dataStartRow1Based = headerEndRow1Based + 1;

    return {
      headerStartRow: headerStartRow1Based,
      headerEndRow: headerEndRow1Based,
      dataStartRow: dataStartRow1Based,
    };
  }

  /**
   * Mengekstrak informasi kolom dan susunan lapis header bertingkat dari rentang baris tertentu.
   */
  static extractSheetColumns(
    worksheet: XLSX.WorkSheet,
    headerStartRow: number, // 1-based
    headerEndRow: number,   // 1-based
  ): ColumnInfo[] {
    if (!worksheet['!ref']) {
      return [];
    }

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const hStartRow = Math.max(0, headerStartRow - 1); // 0-based
    const hEndRow = Math.min(range.e.r, Math.max(hStartRow, headerEndRow - 1)); // 0-based

    const columns: ColumnInfo[] = [];
    const usedNames = new Map<string, number>();

    for (let c = range.s.c; c <= range.e.c; c++) {
      const layerValues: string[] = [];
      let ancestorStart = -1;

      for (let r = hStartRow; r <= hEndRow; r++) {
        const val = this.getCellValue(
          worksheet,
          r,
          c,
          ancestorStart >= 0 ? ancestorStart : undefined,
        );
        if (val && val.trim() !== '') {
          layerValues.push(val.trim());
        }

        const merges = worksheet['!merges'] || [];
        const m = merges.find(
          (merge) => r >= merge.s.r && r <= merge.e.r && c >= merge.s.c && c <= merge.e.c,
        );
        if (m && m.s.c >= (ancestorStart >= 0 ? ancestorStart : 0)) {
          ancestorStart = Math.max(ancestorStart, m.s.c);
        }
      }

      const uniqueLayers: string[] = [];
      for (const val of layerValues) {
        if (
          uniqueLayers.length === 0 ||
          this.normalizeKey(uniqueLayers[uniqueLayers.length - 1]) !== this.normalizeKey(val)
        ) {
          uniqueLayers.push(val);
        }
      }

      let combinedName = uniqueLayers.join(' - ');
      const leafName = uniqueLayers.length > 0 ? uniqueLayers[uniqueLayers.length - 1] : '';

      if (!combinedName) {
        let hasDataInCol = false;
        const checkStart = hEndRow + 1;
        for (let r = checkStart; r <= Math.min(range.e.r, checkStart + 10); r++) {
          const address = XLSX.utils.encode_cell({ r, c });
          if (worksheet[address]?.v !== undefined) {
            hasDataInCol = true;
            break;
          }
        }

        if (hasDataInCol) {
          combinedName = `Kolom ${XLSX.utils.encode_col(c)}`;
        } else {
          continue;
        }
      }

      const normalized = this.normalizeKey(combinedName);
      const count = usedNames.get(normalized) || 0;
      usedNames.set(normalized, count + 1);

      let finalName = combinedName;
      if (count > 0) {
        finalName = `${combinedName} (${count + 1})`;
      }

      columns.push({
        colIndex: c,
        colLetter: XLSX.utils.encode_col(c),
        header: finalName,
        leafHeader: leafName || finalName,
        layers: uniqueLayers,
      });
    }

    return columns;
  }

  /**
   * Mengambil nilai sel dengan memeriksa apakah sel merupakan bagian dari merge.
   * Parameter ancestorStartCol mencegah merge sel berjenjang yang bocor (cross-category boundary spillover).
   */
  static getCellValue(
    worksheet: XLSX.WorkSheet,
    r: number,
    c: number,
    ancestorStartCol?: number,
  ): string {
    const merges = worksheet['!merges'] || [];
    const merge = merges.find((m) => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c);

    if (merge) {
      if (ancestorStartCol !== undefined && merge.s.c < ancestorStartCol) {
        // Cross-category boundary spillover: ambil nilai sel langsung pada (r, c)
        const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
        if (cell?.v !== undefined && cell?.v !== null) {
          return String(cell.v).trim();
        }
        return '';
      }

      const cell = worksheet[XLSX.utils.encode_cell(merge.s)];
      if (cell?.v !== undefined && cell?.v !== null) {
        return String(cell.v).trim();
      }
      return '';
    }

    const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
    if (cell?.v !== undefined && cell?.v !== null) {
      return String(cell.v).trim();
    }

    return '';
  }

  /**
   * Membaca baris data dari worksheet berdasarkan daftar ColumnInfo dan baris mulai data.
   */
  static readSheetRows(
    worksheet: XLSX.WorkSheet,
    columns: ColumnInfo[],
    dataStartRow: number, // 1-based
  ): Record<string, unknown>[] {
    if (!worksheet || !worksheet['!ref']) {
      return [];
    }

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const startRow = Math.max(0, dataStartRow - 1); // 0-based
    if (startRow > range.e.r) {
      return [];
    }

    const rows: Record<string, unknown>[] = [];

    for (let r = startRow; r <= range.e.r; r++) {
      const rowObj: Record<string, unknown> = {};
      let hasAnyValue = false;

      for (const col of columns) {
        const address = XLSX.utils.encode_cell({ r, c: col.colIndex });
        const cell = worksheet[address];
        const val = cell?.v !== undefined && cell?.v !== null ? cell.v : null;

        if (val !== null && String(val).trim() !== '') {
          hasAnyValue = true;
        }

        rowObj[col.header] = val;
      }

      if (hasAnyValue) {
        rows.push(rowObj);
      }
    }

    return rows;
  }

  /**
   * Membangun representasi matriks 2D header bertingkat lengkap dengan rowspan, colspan, dan covered status.
   */
  static buildHeaderGrid(columns: ColumnHeaderMeta[]): HeaderGridCell[][] {
    if (columns.length === 0) {
      return [];
    }

    const depth = Math.max(1, ...columns.map((c) => Math.max(1, c.layers.length)));
    const numCols = columns.length;

    const grid: HeaderGridCell[][] = [];
    for (let r = 0; r < depth; r++) {
      grid.push([]);
      for (let c = 0; c < numCols; c++) {
        grid[r].push({
          text: '',
          rowspan: 1,
          colspan: 1,
          covered: false,
        });
      }
    }

    // 1. Tempatkan teks layer dan hitung rowspan
    for (let c = 0; c < numCols; c++) {
      const colMeta = columns[c];
      const layers = colMeta.layers && colMeta.layers.length > 0 ? colMeta.layers : [colMeta.key];
      const k = layers.length;

      if (k === 1) {
        grid[0][c] = {
          text: layers[0],
          rowspan: depth,
          colspan: 1,
          covered: false,
          colKey: colMeta.key,
        };
        for (let r = 1; r < depth; r++) {
          grid[r][c] = { text: '', rowspan: 0, colspan: 0, covered: true };
        }
      } else {
        for (let r = 0; r < k - 1; r++) {
          grid[r][c] = {
            text: layers[r],
            rowspan: 1,
            colspan: 1,
            covered: false,
          };
        }

        const leafRowspan = depth - k + 1;
        grid[k - 1][c] = {
          text: layers[k - 1],
          rowspan: leafRowspan,
          colspan: 1,
          covered: false,
          colKey: colMeta.key,
        };

        for (let r = k; r < depth; r++) {
          grid[r][c] = { text: '', rowspan: 0, colspan: 0, covered: true };
        }
      }
    }

    // 2. Hitung colspan (horizontal merge)
    for (let r = 0; r < depth; r++) {
      for (let c = 0; c < numCols; c++) {
        const cell = grid[r][c];
        if (cell.covered) {
          continue;
        }

        let span = 1;
        while (c + span < numCols) {
          const nextCell = grid[r][c + span];

          if (
            !nextCell.covered &&
            nextCell.rowspan === cell.rowspan &&
            this.normalizeKey(nextCell.text) === this.normalizeKey(cell.text)
          ) {
            let sameParent = true;
            for (let p = 0; p < r; p++) {
              if (this.normalizeKey(grid[p][c].text) !== this.normalizeKey(grid[p][c + span].text)) {
                sameParent = false;
                break;
              }
            }

            if (sameParent) {
              cell.colspan++;
              nextCell.covered = true;
              span++;
            } else {
              break;
            }
          } else {
            break;
          }
        }
      }
    }

    return grid;
  }

  /**
   * Membangun objek WorkSheet XLSX berformat rapi (header bertingkat, merges, borders, styling, dan lebar kolom)
   * tanpa langsung menulis file ke disk, sehingga dapat digabungkan ke multi-sheet workbook.
   */
  static buildStyledWorksheet(
    spec: Omit<StyledExportSpec, 'fileName'> & { fileName?: string },
  ): XLSX.WorkSheet {
    if (spec.columns.length === 0) {
      return XLSX.utils.aoa_to_sheet([]);
    }

    const headerGrid = this.buildHeaderGrid(spec.columns);
    const headerDepth = headerGrid.length;
    const numCols = spec.columns.length;

    // 1. Array of Arrays (AOA)
    const aoa: unknown[][] = [];

    // Header rows
    for (let r = 0; r < headerDepth; r++) {
      const rowValues: unknown[] = [];
      for (let c = 0; c < numCols; c++) {
        rowValues.push(headerGrid[r][c].text);
      }
      aoa.push(rowValues);
    }

    // Data rows
    for (const row of spec.dataRows) {
      const rowValues: unknown[] = [];
      for (const col of spec.columns) {
        const raw = row[col.key];
        rowValues.push(raw !== null && raw !== undefined ? raw : '');
      }
      aoa.push(rowValues);
    }

    // Summary rows
    if (spec.summaryRows && spec.summaryRows.length > 0) {
      for (const sRow of spec.summaryRows) {
        const rowValues: unknown[] = [];
        for (const col of spec.columns) {
          const val = sRow.values[col.key];
          rowValues.push(val !== null && val !== undefined ? val : '-');
        }
        aoa.push(rowValues);
      }
    }

    // 2. Worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // 3. Header Merges
    const merges: XLSX.Range[] = [];
    for (let r = 0; r < headerDepth; r++) {
      for (let c = 0; c < numCols; c++) {
        const cell = headerGrid[r][c];
        if (!cell.covered && (cell.rowspan > 1 || cell.colspan > 1)) {
          merges.push({
            s: { r, c },
            e: { r: r + cell.rowspan - 1, c: c + cell.colspan - 1 },
          });
        }
      }
    }
    worksheet['!merges'] = merges;

    // 4. Default Borders
    const defaultTableBorder = {
      top: { style: 'thin', color: { rgb: '94A3B8' } },
      bottom: { style: 'thin', color: { rgb: '94A3B8' } },
      left: { style: 'thin', color: { rgb: '94A3B8' } },
      right: { style: 'thin', color: { rgb: '94A3B8' } },
    };

    const defaultDataBorder = {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    };

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const dataRowCount = spec.dataRows.length;

    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[address]) {
          worksheet[address] = { v: '', t: 's' };
        }
        const cell = worksheet[address];
        const colMeta = spec.columns[C];

        if (R < headerDepth) {
          // Styling header
          cell.s = {
            font: { bold: true, color: { rgb: '0F172A' }, sz: 10 },
            fill: { fgColor: { rgb: 'F1F5F9' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: defaultTableBorder,
          };
        } else if (R < headerDepth + dataRowCount) {
          // Styling data rows
          const rowIndex = R - headerDepth;
          const dataRow = spec.dataRows[rowIndex];
          const colKey = colMeta ? colMeta.key : '';
          const customStyle = spec.cellStyler
            ? spec.cellStyler(dataRow, colKey, cell.v, C)
            : undefined;

          cell.s = {
            font: customStyle?.font || { color: { rgb: '334155' }, sz: 10 },
            fill: customStyle?.fill,
            alignment: customStyle?.alignment || {
              vertical: 'center',
              horizontal: typeof cell.v === 'number' ? 'center' : 'left',
            },
            border: customStyle?.border || defaultDataBorder,
            numFmt: customStyle?.numFmt,
          };
        } else {
          // Styling summary rows
          const summaryIndex = R - headerDepth - dataRowCount;
          const sRowSpec = spec.summaryRows ? spec.summaryRows[summaryIndex] : undefined;
          const colKey = colMeta ? colMeta.key : '';
          const customStyle = sRowSpec?.styler
            ? sRowSpec.styler(colKey, cell.v, C)
            : sRowSpec?.defaultStyle;

          cell.s = {
            font: customStyle?.font || { bold: true, color: { rgb: '0F172A' }, sz: 10 },
            fill: customStyle?.fill,
            alignment: customStyle?.alignment || {
              vertical: 'center',
              horizontal: C === 1 ? 'left' : 'center',
            },
            border: customStyle?.border || defaultTableBorder,
            numFmt: customStyle?.numFmt,
          };
        }
      }
    }

    // 5. Column Widths
    worksheet['!cols'] = spec.columns.map((col, idx) => {
      let width = 20;
      if (typeof spec.colWidths === 'function') {
        width = spec.colWidths(col.key, idx);
      } else if (spec.colWidths && spec.colWidths[col.key] !== undefined) {
        width = spec.colWidths[col.key];
      } else if (col.key === 'No') {
        width = 8;
      }
      return { wch: width };
    });

    return worksheet;
  }

  /**
   * Menghasilkan WorkBook Excel ber-styling lengkap dengan header bertingkat, merges, borders, dan styling sel.
   */
  static buildStyledWorkbook(spec: StyledExportSpec): XLSX.WorkBook {
    const worksheet = this.buildStyledWorksheet(spec);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, spec.sheetName || 'Sheet1');
    return workbook;
  }

  /**
   * Mengonversi WorkBook Excel menjadi biner ArrayBuffer dalam memori (tanpa memicu unduh file).
   */
  static writeWorkbookToBuffer(workbook: XLSX.WorkBook): ArrayBuffer {
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    if (output instanceof ArrayBuffer) {
      return output;
    }
    const u8 = output as Uint8Array;
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
  }

  /**
   * Mengekspor tabel ke file Excel (.xlsx) dengan header bertingkat, merges sel, borders, dan styling lengkap.
   */
  static exportStyledTable(spec: StyledExportSpec): void {
    if (spec.columns.length === 0) {
      return;
    }

    const workbook = this.buildStyledWorkbook(spec);
    this.writeWorkbook(workbook, spec.fileName);
  }

  /**
   * Mengekspor beberapa worksheet ke satu file workbook Excel (.xlsx) multi-sheet.
   */
  static exportMultiSheetTable(
    fileName: string,
    sheets: { sheetName: string; worksheet: XLSX.WorkSheet }[],
  ): void {
    if (sheets.length === 0) return;
    const workbook = XLSX.utils.book_new();
    for (const s of sheets) {
      XLSX.utils.book_append_sheet(workbook, s.worksheet, s.sheetName);
    }
    this.writeWorkbook(workbook, fileName);
  }

  /**
   * Menyimpan workbook ke file disk / download browser.
   */
  static writeWorkbook(workbook: XLSX.WorkBook, fileName: string): void {
    XLSX.writeFile(workbook, fileName);
  }

  private static normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '_');
  }
}
