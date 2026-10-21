/**
 * =========================================================================
 * Dinkes Excel Joiner - Google Apps Script Storage Backend
 * =========================================================================
 * Skrip ini bertindak sebagai API serverless untuk menyimpan dan memuat
 * file Excel biner (.xlsx) serta file konfigurasi join (.json) di Google Drive,
 * baik untuk slot default tunggal maupun partisi lintas triwulan (Tahun/TW).
 *
 * Folder Target di Google Drive: "Dinkes Excel Joiner Storage"
 *
 * Struktur Partisi Lintas Triwulan:
 * Dinkes Excel Joiner Storage/
 * └── [Tahun, misal: 2026]/
 *     ├── TW1/
 *     │   ├── raw-data.xlsx
 *     │   ├── joined-result.xlsx
 *     │   └── join-config.json
 *     ├── TW2/
 *     ├── TW3/
 *     └── TW4/
 * =========================================================================
 */

const FOLDER_NAME = 'Dinkes Excel Joiner Storage';

// Nama file untuk slot default legacy
const DEFAULT_EXCEL_FILE_NAME = 'default-join-data.xlsx';
const DEFAULT_CONFIG_FILE_NAME = 'default-join-config.json';

// Nama file untuk slot partisi lintas triwulan
const RAW_EXCEL_FILE_NAME = 'raw-data.xlsx';
const RESULT_EXCEL_FILE_NAME = 'joined-result.xlsx';
const PERIOD_CONFIG_FILE_NAME = 'join-config.json';

const VALID_QUARTERS = ['TW1', 'TW2', 'TW3', 'TW4'];

/**
 * Mengambil atau membuat folder penyimpanan utama di Google Drive.
 */
function getStorageFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(FOLDER_NAME);
}

/**
 * Mengambil atau membuat subfolder tahun di dalam folder utama.
 */
function getYearFolder(parentFolder, year) {
  const yearStr = String(year).trim();
  const folders = parentFolder.getFoldersByName(yearStr);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(yearStr);
}

/**
 * Mengambil atau membuat subfolder triwulan di dalam folder tahun.
 */
function getQuarterFolder(yearFolder, quarter) {
  const qStr = String(quarter).trim().toUpperCase();
  const folders = yearFolder.getFoldersByName(qStr);
  if (folders.hasNext()) {
    return folders.next();
  }
  return yearFolder.createFolder(qStr);
}

/**
 * Menghapus file lama dengan nama tertentu di dalam folder target.
 */
function trashOldFiles(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  while (files.hasNext()) {
    files.next().setTrashed(true);
  }
}

/**
 * Jalankan fungsi ini SEKALI di editor Google Apps Script
 * dengan memilih fungsinya lalu klik tombol "Run" (Jalankan)
 * untuk memicu dialog izin Google Drive.
 */
function testAuthorizeDrive() {
  const folder = getStorageFolder();
  Logger.log('Folder Google Drive berhasil diakses: ' + folder.getName());
}

/**
 * Handler GET request untuk memuat data, uji koneksi, atau daftar periode.
 */
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'loadDefault';

    // 1. Uji koneksi (Ping)
    if (action === 'ping') {
      return createJsonResponse({
        success: true,
        message: 'Google Apps Script Storage Dinkes aktif dan siap digunakan.',
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Daftar seluruh periode lintas triwulan yang tersimpan
    if (action === 'listPeriods') {
      const rootFolder = getStorageFolder();
      const periods = [];

      const yearFolders = rootFolder.getFolders();
      while (yearFolders.hasNext()) {
        const yf = yearFolders.next();
        const yName = yf.getName().trim();
        // Cek apakah nama folder adalah 4 digit tahun (contoh: 2024, 2025, 2026)
        if (!/^\d{4}$/.test(yName)) {
          continue;
        }
        const yearNum = parseInt(yName, 10);

        const qFolders = yf.getFolders();
        while (qFolders.hasNext()) {
          const qf = qFolders.next();
          const qName = qf.getName().trim().toUpperCase();

          if (VALID_QUARTERS.indexOf(qName) === -1) {
            continue;
          }

          const rawFiles = qf.getFilesByName(RAW_EXCEL_FILE_NAME);
          const resultFiles = qf.getFilesByName(RESULT_EXCEL_FILE_NAME);
          const configFiles = qf.getFilesByName(PERIOD_CONFIG_FILE_NAME);

          const hasRaw = rawFiles.hasNext();
          const hasResult = resultFiles.hasNext();
          const hasConfig = configFiles.hasNext();

          if (!hasRaw && !hasResult && !hasConfig) {
            continue;
          }

          let lastUpdated = qf.getLastUpdated().toISOString();
          let fileSize = 0;

          if (hasRaw) {
            const rf = rawFiles.next();
            lastUpdated = rf.getLastUpdated().toISOString();
            fileSize = rf.getSize();
          }

          periods.push({
            year: yearNum,
            quarter: qName,
            hasRaw: hasRaw,
            hasResult: hasResult,
            hasConfig: hasConfig,
            rawFileName: RAW_EXCEL_FILE_NAME,
            resultFileName: RESULT_EXCEL_FILE_NAME,
            updatedAt: lastUpdated,
            fileSize: fileSize,
          });
        }
      }

      // Urutkan periode dari tahun terbaru, triwulan TW4 -> TW1
      periods.sort(function(a, b) {
        if (b.year !== a.year) {
          return b.year - a.year;
        }
        return b.quarter.localeCompare(a.quarter);
      });

      return createJsonResponse({
        success: true,
        periods: periods,
      });
    }

    // 3. Muat berkas periode tertentu (Tahun & Triwulan)
    if (action === 'loadPeriod') {
      const year = e.parameter.year ? parseInt(e.parameter.year, 10) : null;
      const quarter = e.parameter.quarter ? String(e.parameter.quarter).trim().toUpperCase() : null;

      if (!year || !quarter) {
        return createJsonResponse({
          success: false,
          error: 'Parameter year dan quarter wajib disertakan untuk loadPeriod.',
        });
      }

      const rootFolder = getStorageFolder();
      const yearFolders = rootFolder.getFoldersByName(String(year));
      if (!yearFolders.hasNext()) {
        return createJsonResponse({
          success: true,
          hasData: false,
          message: 'Belum ada folder tahun ' + year + ' di Google Drive.',
        });
      }

      const yf = yearFolders.next();
      const qFolders = yf.getFoldersByName(quarter);
      if (!qFolders.hasNext()) {
        return createJsonResponse({
          success: true,
          hasData: false,
          message: 'Belum ada folder periode ' + year + ' ' + quarter + ' di Google Drive.',
        });
      }

      const qf = qFolders.next();
      const rawFiles = qf.getFilesByName(RAW_EXCEL_FILE_NAME);
      const resultFiles = qf.getFilesByName(RESULT_EXCEL_FILE_NAME);
      const configFiles = qf.getFilesByName(PERIOD_CONFIG_FILE_NAME);

      const hasRaw = rawFiles.hasNext();
      const hasResult = resultFiles.hasNext();

      if (!hasRaw && !hasResult) {
        return createJsonResponse({
          success: true,
          hasData: false,
          message: 'Berkas data belum tersedia di periode ' + year + ' ' + quarter + '.',
        });
      }

      let rawFile = null;
      let rawBytes = null;
      let rawExcelBase64 = null;
      if (hasRaw) {
        rawFile = rawFiles.next();
        rawBytes = rawFile.getBlob().getBytes();
        rawExcelBase64 = Utilities.base64Encode(rawBytes);
      }

      let resultFile = null;
      let resultBytes = null;
      let resultExcelBase64 = null;
      if (hasResult) {
        resultFile = resultFiles.next();
        resultBytes = resultFile.getBlob().getBytes();
        resultExcelBase64 = Utilities.base64Encode(resultBytes);
      }

      let config = null;
      if (configFiles.hasNext()) {
        const cf = configFiles.next();
        try {
          config = JSON.parse(cf.getBlob().getDataAsString());
        } catch (jsonErr) {
          config = null;
        }
      }

      const preferResult = e.parameter && (e.parameter.preferResult === 'true' || e.parameter.fileType === 'result');
      const shouldUseResult = (preferResult && hasResult) || (!hasRaw && hasResult);

      const activeFile = shouldUseResult ? resultFile : rawFile;
      const activeBytes = shouldUseResult ? resultBytes : rawBytes;
      const excelBase64 = shouldUseResult ? resultExcelBase64 : rawExcelBase64;

      return createJsonResponse({
        success: true,
        hasData: true,
        year: year,
        quarter: quarter,
        fileName: activeFile ? activeFile.getName() : (shouldUseResult ? RESULT_EXCEL_FILE_NAME : RAW_EXCEL_FILE_NAME),
        excelBase64: excelBase64,
        rawExcelBase64: rawExcelBase64,
        resultExcelBase64: resultExcelBase64,
        config: config,
        resultExcelAvailable: hasResult,
        isResultExcel: shouldUseResult,
        fileSize: activeBytes ? activeBytes.length : 0,
        updatedAt: activeFile ? activeFile.getLastUpdated().toISOString() : new Date().toISOString(),
      });
    }

    // 4. Muat file default legacy (backward compatibility)
    if (action === 'loadDefault') {
      const folder = getStorageFolder();
      const excelFiles = folder.getFilesByName(DEFAULT_EXCEL_FILE_NAME);
      const configFiles = folder.getFilesByName(DEFAULT_CONFIG_FILE_NAME);

      if (!excelFiles.hasNext()) {
        return createJsonResponse({
          success: true,
          hasData: false,
          message: 'Belum ada file Excel default kustom di Google Drive.',
        });
      }

      const excelFile = excelFiles.next();
      const excelBytes = excelFile.getBlob().getBytes();
      const excelBase64 = Utilities.base64Encode(excelBytes);

      let config = null;
      if (configFiles.hasNext()) {
        const configFile = configFiles.next();
        const configText = configFile.getBlob().getDataAsString();
        try {
          config = JSON.parse(configText);
        } catch (jsonErr) {
          config = null;
        }
      }

      return createJsonResponse({
        success: true,
        hasData: true,
        fileName: excelFile.getName(),
        excelBase64: excelBase64,
        config: config,
        fileSize: excelBytes.length,
        updatedAt: excelFile.getLastUpdated().toISOString(),
      });
    }

    // 5. Muat template konfigurasi join murni (tanpa buffer excel)
    if (action === 'loadTemplateConfig') {
      const folder = getStorageFolder();
      let configFiles = folder.getFilesByName('template-config.json');
      if (!configFiles.hasNext()) {
        configFiles = folder.getFilesByName(DEFAULT_CONFIG_FILE_NAME);
      }

      if (!configFiles.hasNext()) {
        return createJsonResponse({
          success: true,
          hasConfig: false,
          message: 'Belum ada file konfigurasi template di Google Drive.',
        });
      }

      const configFile = configFiles.next();
      let config = null;
      try {
        config = JSON.parse(configFile.getBlob().getDataAsString());
      } catch (jsonErr) {
        return createJsonResponse({
          success: false,
          error: 'Format konfigurasi template di Google Drive tidak valid: ' + jsonErr.toString(),
        });
      }

      return createJsonResponse({
        success: true,
        hasConfig: true,
        config: config,
        fileName: configFile.getName(),
        updatedAt: configFile.getLastUpdated().toISOString(),
      });
    }

    return createJsonResponse({
      success: false,
      error: 'Aksi GET tidak dikenali: ' + action,
    });
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString(),
    });
  }
}

/**
 * Handler POST request untuk menyimpan file periode baru atau default legacy.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({
        success: false,
        error: 'Payload POST kosong.',
      });
    }

    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return createJsonResponse({
        success: false,
        error: 'Format data JSON tidak valid: ' + parseErr.toString(),
      });
    }

    const action = body.action || 'saveDefault';

    // 1. Simpan periode lintas triwulan (Data Mentah & Hasil Join)
    if (action === 'savePeriod') {
      const year = body.year ? parseInt(body.year, 10) : null;
      const quarter = body.quarter ? String(body.quarter).trim().toUpperCase() : null;

      if (!year || !quarter) {
        return createJsonResponse({
          success: false,
          error: 'Field year dan quarter wajib diisi untuk aksi savePeriod.',
        });
      }

      if (!body.rawExcelBase64 && !body.excelBase64) {
        return createJsonResponse({
          success: false,
          error: 'Field rawExcelBase64 wajib diisi.',
        });
      }

      const rawBase64 = body.rawExcelBase64 || body.excelBase64;
      const rootFolder = getStorageFolder();
      const yearFolder = getYearFolder(rootFolder, year);
      const qFolder = getQuarterFolder(yearFolder, quarter);

      // Simpan raw-data.xlsx
      trashOldFiles(qFolder, RAW_EXCEL_FILE_NAME);
      const decodedRawBytes = Utilities.base64Decode(rawBase64);
      const rawBlob = Utilities.newBlob(
        decodedRawBytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        RAW_EXCEL_FILE_NAME
      );
      const newRawFile = qFolder.createFile(rawBlob);

      // Simpan joined-result.xlsx jika disertakan
      let resultSaved = false;
      if (body.resultExcelBase64) {
        trashOldFiles(qFolder, RESULT_EXCEL_FILE_NAME);
        const decodedResultBytes = Utilities.base64Decode(body.resultExcelBase64);
        const resultBlob = Utilities.newBlob(
          decodedResultBytes,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          RESULT_EXCEL_FILE_NAME
        );
        qFolder.createFile(resultBlob);
        resultSaved = true;
      }

      // Simpan join-config.json jika disertakan
      let configSaved = false;
      if (body.config) {
        trashOldFiles(qFolder, PERIOD_CONFIG_FILE_NAME);
        const configJsonStr = typeof body.config === 'string'
          ? body.config
          : JSON.stringify(body.config, null, 2);

        const configBlob = Utilities.newBlob(
          configJsonStr,
          'application/json',
          PERIOD_CONFIG_FILE_NAME
        );
        qFolder.createFile(configBlob);
        configSaved = true;
      }

      return createJsonResponse({
        success: true,
        message: 'Data periode ' + year + ' ' + quarter + ' berhasil disimpan ke Google Drive.',
        year: year,
        quarter: quarter,
        updatedAt: newRawFile.getLastUpdated().toISOString(),
        rawSaved: true,
        resultSaved: resultSaved,
        configSaved: configSaved,
        fileSize: decodedRawBytes.length,
      });
    }

    // 2. Simpan sebagai file default baru legacy (menimpa file lama)
    if (action === 'saveDefault') {
      if (!body.excelBase64) {
        return createJsonResponse({
          success: false,
          error: 'Field excelBase64 wajib diisi.',
        });
      }

      const folder = getStorageFolder();

      // Dekode biner Excel dari base64
      const decodedBytes = Utilities.base64Decode(body.excelBase64);
      const excelBlob = Utilities.newBlob(
        decodedBytes,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        DEFAULT_EXCEL_FILE_NAME
      );

      // Bersihkan file excel lama di folder
      trashOldFiles(folder, DEFAULT_EXCEL_FILE_NAME);

      // Buat file excel baru
      const newExcel = folder.createFile(excelBlob);

      // Simpan konfigurasi jika disertakan
      let configSaved = false;
      if (body.config) {
        trashOldFiles(folder, DEFAULT_CONFIG_FILE_NAME);
        const configJsonStr = typeof body.config === 'string'
          ? body.config
          : JSON.stringify(body.config, null, 2);

        const configBlob = Utilities.newBlob(
          configJsonStr,
          'application/json',
          DEFAULT_CONFIG_FILE_NAME
        );
        folder.createFile(configBlob);
        configSaved = true;
      }

      return createJsonResponse({
        success: true,
        message: 'File Excel default dan konfigurasi berhasil disimpan ke Google Drive.',
        updatedAt: newExcel.getLastUpdated().toISOString(),
        configSaved: configSaved,
        fileSize: decodedBytes.length,
      });
    }

    // 3. Hapus file kustom legacy (Reset ke bawaan sistem)
    if (action === 'resetDefault') {
      const folder = getStorageFolder();
      trashOldFiles(folder, DEFAULT_EXCEL_FILE_NAME);
      trashOldFiles(folder, DEFAULT_CONFIG_FILE_NAME);

      return createJsonResponse({
        success: true,
        message: 'Default kustom di Google Drive berhasil dihapus.',
      });
    }

    // 4. Simpan template konfigurasi join murni
    if (action === 'saveTemplateConfig') {
      if (!body.config) {
        return createJsonResponse({
          success: false,
          error: 'Field config wajib disertakan.',
        });
      }

      const folder = getStorageFolder();
      trashOldFiles(folder, 'template-config.json');
      trashOldFiles(folder, DEFAULT_CONFIG_FILE_NAME);

      const configJsonStr = typeof body.config === 'string'
        ? body.config
        : JSON.stringify(body.config, null, 2);

      const configBlob = Utilities.newBlob(
        configJsonStr,
        'application/json',
        'template-config.json'
      );
      const newFile = folder.createFile(configBlob);

      return createJsonResponse({
        success: true,
        message: 'Template konfigurasi berhasil disimpan ke Google Drive.',
        updatedAt: newFile.getLastUpdated().toISOString(),
      });
    }

    return createJsonResponse({
      success: false,
      error: 'Aksi POST tidak dikenali: ' + action,
    });
  } catch (error) {
    return createJsonResponse({
      success: false,
      error: error.toString(),
    });
  }
}

/**
 * Helper pembuat HTTP TextOutput JSON untuk menghindari masalah CORS.
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
