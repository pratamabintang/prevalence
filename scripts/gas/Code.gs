/**
 * =========================================================================
 * Dinkes Excel Joiner - Google Apps Script Storage Backend
 * =========================================================================
 * Skrip ini bertindak sebagai API serverless untuk menyimpan dan memuat
 * file Excel biner (.xlsx) serta file konfigurasi join (.json) di Google Drive.
 *
 * Folder Target di Google Drive: "Dinkes Excel Joiner Storage"
 * File yang dikelola:
 * 1. default-join-data.xlsx
 * 2. default-join-config.json
 * =========================================================================
 */

const FOLDER_NAME = 'Dinkes Excel Joiner Storage';
const EXCEL_FILE_NAME = 'default-join-data.xlsx';
const CONFIG_FILE_NAME = 'default-join-config.json';

/**
 * Mengambil atau membuat folder penyimpanan di Google Drive.
 */
function getStorageFolder() {
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(FOLDER_NAME);
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
 * Handler GET request untuk memuat data atau uji koneksi.
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

    // 2. Muat file default dan konfigurasi
    if (action === 'loadDefault') {
      const folder = getStorageFolder();
      const excelFiles = folder.getFilesByName(EXCEL_FILE_NAME);
      const configFiles = folder.getFilesByName(CONFIG_FILE_NAME);

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
 * Handler POST request untuk menyimpan file default baru atau reset data.
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

    // 1. Simpan sebagai file default baru (menimpa file lama)
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
        EXCEL_FILE_NAME
      );

      // Bersihkan file excel lama di folder
      const oldExcelFiles = folder.getFilesByName(EXCEL_FILE_NAME);
      while (oldExcelFiles.hasNext()) {
        oldExcelFiles.next().setTrashed(true);
      }

      // Buat file excel baru
      const newExcel = folder.createFile(excelBlob);

      // Simpan konfigurasi jika disertakan
      let configSaved = false;
      if (body.config) {
        const configJsonStr = typeof body.config === 'string'
          ? body.config
          : JSON.stringify(body.config, null, 2);

        const configBlob = Utilities.newBlob(
          configJsonStr,
          'application/json',
          CONFIG_FILE_NAME
        );

        const oldConfigFiles = folder.getFilesByName(CONFIG_FILE_NAME);
        while (oldConfigFiles.hasNext()) {
          oldConfigFiles.next().setTrashed(true);
        }

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

    // 2. Hapus file kustom (Reset ke bawaan sistem)
    if (action === 'resetDefault') {
      const folder = getStorageFolder();

      const oldExcelFiles = folder.getFilesByName(EXCEL_FILE_NAME);
      while (oldExcelFiles.hasNext()) {
        oldExcelFiles.next().setTrashed(true);
      }

      const oldConfigFiles = folder.getFilesByName(CONFIG_FILE_NAME);
      while (oldConfigFiles.hasNext()) {
        oldConfigFiles.next().setTrashed(true);
      }

      return createJsonResponse({
        success: true,
        message: 'Default kustom di Google Drive berhasil dihapus.',
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
