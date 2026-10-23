import { JoinConfigurationPreset } from './preset-store';

export const DEFAULT_JOIN_CONFIG: JoinConfigurationPreset = {
  "version": "1.0",
  "name": "Konfigurasi - Format Analisis Intervensi Spesifik TW3",
  "savedAt": "2026-10-22T00:00:00.000Z",
  "outputHeaderFormat": "concat",
  "includeSheetPrefix": true,
  "joinBy": "Kabupaten/Kota",
  "stripKabupaten": true,
  "sheets": [
    {
      "sheetName": "remaja",
      "headerStartRow": 3,
      "headerEndRow": 5,
      "dataStartRow": 7,
      "joinColumn": "Kabupaten/Kota",
      "variables": [
        "Persentase remaja putri mendapatkan dan mengonsumsi TTD - Jumlah remaja putri di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) mengonsumsi TTD sesuai standar",
        "Persentase remaja putri mendapatkan dan mengonsumsi TTD - % (2)",
        "Persentase remaja putri skrining anemia - Jumlah remaja putri kelas 7 dan 10 di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) yang skrining anemia sampai TW ini",
        "Persentase remaja putri skrining anemia - % (3)"
      ]
    },
    {
      "sheetName": "BUMIL",
      "headerStartRow": 3,
      "headerEndRow": 5,
      "dataStartRow": 7,
      "joinColumn": "Kabupaten/Kota",
      "variables": [
        "Laporan Pemeriksaan ANC - Jumlah ibu bersalin K6 sampai TW ini (2)",
        "Laporan Pemeriksaan ANC - % K6",
        "Persentase ibu hamil mendapat suplementasi gizi - Jumlah ibu hamil mengonsumsi suplementasi gizi (minimal 180 tablet TTD dan MMS) sampai TW ini",
        "Persentase ibu hamil mendapat suplementasi gizi - % (2)",
        "Persentase ibu hamil KEK mendapat makanan tambahan - Jumlah ibu hamil KEK mendapat makanan tambahan sampai TW ini",
        "Persentase ibu hamil KEK mendapat makanan tambahan - %"
      ]
    },
    {
      "sheetName": "gizi",
      "headerStartRow": 3,
      "headerEndRow": 5,
      "dataStartRow": 7,
      "joinColumn": "Kabupaten/Kota",
      "variables": [
        "Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 0-59 ditimbang dan diukur bulan ini (avg)",
        "Pemantauan Pertumbuhan dan Perkembangan - % (9)",
        "ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - Jumlah bayi usia 0-5 bulan yang mendapat ASI Eksklusif berdasarkan recall 24 jam",
        "ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - %",
        "ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - Jumlah anak usia 6-23 bulan mendapat MPASI baik(avg)",
        "ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (4)",
        "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan gizi kurang yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini",
        "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - %",
        "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan BB kurang yang tidak wasting dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini",
        "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - %",
        "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - Jumlah seluruh balita usia 6-59 bulan dengan status pertumbuhan BB Tidak Naik (T) serta berat badan normal dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini",
        "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - %",
        "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - Jumlah Kasus Gizi Buruk bayi 6-59 Bulan mendapat perawatan sampai TW ini",
        "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - % (4)"
      ]
    },
    {
      "sheetName": "anak",
      "headerStartRow": 3,
      "headerEndRow": 5,
      "dataStartRow": 7,
      "joinColumn": "Kabupaten/Kota",
      "variables": [
        "Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 12-59 bulan yang dipantau pertumbuhan dan perkembangan TW ini",
        "Pemantauan Pertumbuhan dan Perkembangan - % (3)"
      ]
    },
    {
      "sheetName": "idl",
      "headerStartRow": 2,
      "headerEndRow": 3,
      "dataStartRow": 4,
      "joinColumn": "Kab/Kota (ID)",
      "variables": [
        "IDL - Cakupan",
        "IDL - (%) Capaian"
      ]
    }
  ],
  "enableTarget": true,
  "enableCapaian": true,
  "enableJumlah": true,
  "enableAverage": true,
  "columnTargets": {
    "Kabupaten/Kota": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "remaja - Persentase remaja putri mendapatkan dan mengonsumsi TTD - Jumlah remaja putri di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) mengonsumsi TTD sesuai standar": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Persentase remaja putri mendapatkan dan mengonsumsi TTD - Jumlah remaja putri di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) mengonsumsi TTD sesuai standar": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Rematri  Konsumsi TTD": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "remaja - Persentase remaja putri mendapatkan dan mengonsumsi TTD - % (2)": {
      "enabled": true,
      "operator": ">=",
      "value": 67
    },
    "Persentase remaja putri mendapatkan dan mengonsumsi TTD - % (2)": {
      "enabled": true,
      "operator": ">=",
      "value": 67
    },
    "% Konsumsi TTD": {
      "enabled": true,
      "operator": ">=",
      "value": 67
    },
    "remaja - Persentase remaja putri skrining anemia - Jumlah remaja putri kelas 7 dan 10 di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) yang skrining anemia sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Persentase remaja putri skrining anemia - Jumlah remaja putri kelas 7 dan 10 di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) yang skrining anemia sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Rematri Skrining Anemia": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "remaja - Persentase remaja putri skrining anemia - % (3)": {
      "enabled": true,
      "operator": ">=",
      "value": 77
    },
    "Persentase remaja putri skrining anemia - % (3)": {
      "enabled": true,
      "operator": ">=",
      "value": 77
    },
    "% Skrining Anemia": {
      "enabled": true,
      "operator": ">=",
      "value": 77
    },
    "BUMIL - Laporan Pemeriksaan ANC - Jumlah ibu bersalin K6 sampai TW ini (2)": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Laporan Pemeriksaan ANC - Jumlah ibu bersalin K6 sampai TW ini (2)": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Ibu Hamil ANC 6x": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "BUMIL - Laporan Pemeriksaan ANC - % K6": {
      "enabled": true,
      "operator": ">=",
      "value": 60
    },
    "Laporan Pemeriksaan ANC - % K6": {
      "enabled": true,
      "operator": ">=",
      "value": 60
    },
    "% ANC 6x": {
      "enabled": true,
      "operator": ">=",
      "value": 60
    },
    "BUMIL - Persentase ibu hamil mendapat suplementasi gizi - Jumlah ibu hamil mengonsumsi suplementasi gizi (minimal 180 tablet TTD dan MMS) sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Persentase ibu hamil mendapat suplementasi gizi - Jumlah ibu hamil mengonsumsi suplementasi gizi (minimal 180 tablet TTD dan MMS) sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Ibu Hamil Konsumsi TTD/MMS": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "BUMIL - Persentase ibu hamil mendapat suplementasi gizi - % (2)": {
      "enabled": true,
      "operator": ">=",
      "value": 39
    },
    "Persentase ibu hamil mendapat suplementasi gizi - % (2)": {
      "enabled": true,
      "operator": ">=",
      "value": 39
    },
    "% TTD/MMS": {
      "enabled": true,
      "operator": ">=",
      "value": 39
    },
    "BUMIL - Persentase ibu hamil KEK mendapat makanan tambahan - Jumlah ibu hamil KEK mendapat makanan tambahan sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Persentase ibu hamil KEK mendapat makanan tambahan - Jumlah ibu hamil KEK mendapat makanan tambahan sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Ibu Hamil KEK Konsumsi MT": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "BUMIL - Persentase ibu hamil KEK mendapat makanan tambahan - %": {
      "enabled": true,
      "operator": ">=",
      "value": 85
    },
    "Persentase ibu hamil KEK mendapat makanan tambahan - %": {
      "enabled": true,
      "operator": ">=",
      "value": 85
    },
    "% Bumil PMT": {
      "enabled": true,
      "operator": ">=",
      "value": 85
    },
    "gizi - Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 0-59 ditimbang dan diukur bulan ini (avg)": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 0-59 ditimbang dan diukur bulan ini (avg)": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Balita dipantau Pertumbuhan (D/S)": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "gizi - Pemantauan Pertumbuhan dan Perkembangan - % (9)": {
      "enabled": true,
      "operator": ">=",
      "value": 90
    },
    "Pemantauan Pertumbuhan dan Perkembangan - % (9)": {
      "enabled": true,
      "operator": ">=",
      "value": 90
    },
    "% D/S": {
      "enabled": true,
      "operator": ">=",
      "value": 90
    },
    "anak - Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 12-59 bulan yang dipantau pertumbuhan dan perkembangan TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 12-59 bulan yang dipantau pertumbuhan dan perkembangan TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Jumlah Balita dipantau Tumbang": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "anak - Pemantauan Pertumbuhan dan Perkembangan - % (3)": {
      "enabled": true,
      "operator": ">=",
      "value": 55
    },
    "Pemantauan Pertumbuhan dan Perkembangan - % (3)": {
      "enabled": true,
      "operator": ">=",
      "value": 55
    },
    "% Tumbang": {
      "enabled": true,
      "operator": ">=",
      "value": 55
    },
    "gizi - ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - Jumlah bayi usia 0-5 bulan yang mendapat ASI Eksklusif berdasarkan recall 24 jam": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - Jumlah bayi usia 0-5 bulan yang mendapat ASI Eksklusif berdasarkan recall 24 jam": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "ASI Eksklusif": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "gizi - ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - %": {
      "enabled": true,
      "operator": ">=",
      "value": 76
    },
    "ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - %": {
      "enabled": true,
      "operator": ">=",
      "value": 76
    },
    "% ASI": {
      "enabled": true,
      "operator": ">=",
      "value": 76
    },
    "gizi - ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - Jumlah anak usia 6-23 bulan mendapat MPASI baik(avg)": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - Jumlah anak usia 6-23 bulan mendapat MPASI baik(avg)": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "MPASI": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "gizi - ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (4)": {
      "enabled": true,
      "operator": ">=",
      "value": 76
    },
    "ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (4)": {
      "enabled": true,
      "operator": ">=",
      "value": 76
    },
    "% MPASI": {
      "enabled": true,
      "operator": ">=",
      "value": 76
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan gizi kurang yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan gizi kurang yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Jumlah  Gizi Kurang dapat MT": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - %": {
      "enabled": true,
      "operator": ">=",
      "value": 70
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - %": {
      "enabled": true,
      "operator": ">=",
      "value": 70
    },
    "% Gizi Kurang dapat MT": {
      "enabled": true,
      "operator": ">=",
      "value": 70
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan BB kurang yang tidak wasting dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan BB kurang yang tidak wasting dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Jumlah BB Kurang dapat MT": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - %": {
      "enabled": true,
      "operator": ">=",
      "value": 70
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - %": {
      "enabled": true,
      "operator": ">=",
      "value": 70
    },
    "% BB Kurang dapat MT": {
      "enabled": true,
      "operator": ">=",
      "value": 70
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - Jumlah seluruh balita usia 6-59 bulan dengan status pertumbuhan BB Tidak Naik (T) serta berat badan normal dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - Jumlah seluruh balita usia 6-59 bulan dengan status pertumbuhan BB Tidak Naik (T) serta berat badan normal dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Jumlah BB Tidak Naik (T) dapat MT": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - %": {
      "enabled": true,
      "operator": ">=",
      "value": 70
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - %": {
      "enabled": true,
      "operator": ">=",
      "value": 70
    },
    "% BB Tidak Naik (T) dapat MT": {
      "enabled": true,
      "operator": ">=",
      "value": 70
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - Jumlah Kasus Gizi Buruk bayi 6-59 Bulan mendapat perawatan sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - Jumlah Kasus Gizi Buruk bayi 6-59 Bulan mendapat perawatan sampai TW ini": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Jumlah Kasus Gizi Buruk Mendapat Tata Laksana": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - % (4)": {
      "enabled": true,
      "operator": ">=",
      "value": 92
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - % (4)": {
      "enabled": true,
      "operator": ">=",
      "value": 92
    },
    "% Talak Gibur": {
      "enabled": true,
      "operator": ">=",
      "value": 92
    },
    "idl - IDL - Cakupan": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "IDL - Cakupan": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "Baduta IDL": {
      "enabled": false,
      "operator": ">=",
      "value": null
    },
    "idl - IDL - (%) Capaian": {
      "enabled": true,
      "operator": ">=",
      "value": 56.25
    },
    "IDL - (%) Capaian": {
      "enabled": true,
      "operator": ">=",
      "value": 56.25
    },
    "% IDL": {
      "enabled": true,
      "operator": ">=",
      "value": 56.25
    }
  },
  "columnConfigs": {
    "Kabupaten/Kota": {
      "dataType": "string",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "remaja - Persentase remaja putri mendapatkan dan mengonsumsi TTD - Jumlah remaja putri di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) mengonsumsi TTD sesuai standar": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Persentase remaja putri mendapatkan dan mengonsumsi TTD - Jumlah remaja putri di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) mengonsumsi TTD sesuai standar": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Rematri  Konsumsi TTD": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "remaja - Persentase remaja putri mendapatkan dan mengonsumsi TTD - % (2)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Persentase remaja putri mendapatkan dan mengonsumsi TTD - % (2)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% Konsumsi TTD": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "remaja - Persentase remaja putri skrining anemia - Jumlah remaja putri kelas 7 dan 10 di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) yang skrining anemia sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Persentase remaja putri skrining anemia - Jumlah remaja putri kelas 7 dan 10 di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) yang skrining anemia sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Rematri Skrining Anemia": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "remaja - Persentase remaja putri skrining anemia - % (3)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Persentase remaja putri skrining anemia - % (3)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% Skrining Anemia": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "BUMIL - Laporan Pemeriksaan ANC - Jumlah ibu bersalin K6 sampai TW ini (2)": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Laporan Pemeriksaan ANC - Jumlah ibu bersalin K6 sampai TW ini (2)": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Ibu Hamil ANC 6x": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "BUMIL - Laporan Pemeriksaan ANC - % K6": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Laporan Pemeriksaan ANC - % K6": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% ANC 6x": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "BUMIL - Persentase ibu hamil mendapat suplementasi gizi - Jumlah ibu hamil mengonsumsi suplementasi gizi (minimal 180 tablet TTD dan MMS) sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Persentase ibu hamil mendapat suplementasi gizi - Jumlah ibu hamil mengonsumsi suplementasi gizi (minimal 180 tablet TTD dan MMS) sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Ibu Hamil Konsumsi TTD/MMS": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "BUMIL - Persentase ibu hamil mendapat suplementasi gizi - % (2)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Persentase ibu hamil mendapat suplementasi gizi - % (2)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% TTD/MMS": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "BUMIL - Persentase ibu hamil KEK mendapat makanan tambahan - Jumlah ibu hamil KEK mendapat makanan tambahan sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Persentase ibu hamil KEK mendapat makanan tambahan - Jumlah ibu hamil KEK mendapat makanan tambahan sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Ibu Hamil KEK Konsumsi MT": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "BUMIL - Persentase ibu hamil KEK mendapat makanan tambahan - %": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Persentase ibu hamil KEK mendapat makanan tambahan - %": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% Bumil PMT": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 0-59 ditimbang dan diukur bulan ini (avg)": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 0-59 ditimbang dan diukur bulan ini (avg)": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Balita dipantau Pertumbuhan (D/S)": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - Pemantauan Pertumbuhan dan Perkembangan - % (9)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Pemantauan Pertumbuhan dan Perkembangan - % (9)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% D/S": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "anak - Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 12-59 bulan yang dipantau pertumbuhan dan perkembangan TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 12-59 bulan yang dipantau pertumbuhan dan perkembangan TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Jumlah Balita dipantau Tumbang": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "anak - Pemantauan Pertumbuhan dan Perkembangan - % (3)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Pemantauan Pertumbuhan dan Perkembangan - % (3)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% Tumbang": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - Jumlah bayi usia 0-5 bulan yang mendapat ASI Eksklusif berdasarkan recall 24 jam": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - Jumlah bayi usia 0-5 bulan yang mendapat ASI Eksklusif berdasarkan recall 24 jam": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "ASI Eksklusif": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - %": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - %": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% ASI": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - Jumlah anak usia 6-23 bulan mendapat MPASI baik(avg)": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - Jumlah anak usia 6-23 bulan mendapat MPASI baik(avg)": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "MPASI": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (4)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (4)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% MPASI": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan gizi kurang yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan gizi kurang yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Jumlah  Gizi Kurang dapat MT": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - %": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - %": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% Gizi Kurang dapat MT": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan BB kurang yang tidak wasting dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan BB kurang yang tidak wasting dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Jumlah BB Kurang dapat MT": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - %": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - %": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% BB Kurang dapat MT": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - Jumlah seluruh balita usia 6-59 bulan dengan status pertumbuhan BB Tidak Naik (T) serta berat badan normal dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - Jumlah seluruh balita usia 6-59 bulan dengan status pertumbuhan BB Tidak Naik (T) serta berat badan normal dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Jumlah BB Tidak Naik (T) dapat MT": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - %": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - %": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% BB Tidak Naik (T) dapat MT": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - Jumlah Kasus Gizi Buruk bayi 6-59 Bulan mendapat perawatan sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - Jumlah Kasus Gizi Buruk bayi 6-59 Bulan mendapat perawatan sampai TW ini": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Jumlah Kasus Gizi Buruk Mendapat Tata Laksana": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - % (4)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - % (4)": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% Talak Gibur": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "idl - IDL - Cakupan": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "IDL - Cakupan": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "Baduta IDL": {
      "dataType": "number",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "idl - IDL - (%) Capaian": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "IDL - (%) Capaian": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    },
    "% IDL": {
      "dataType": "percentage",
      "anomalyEnabled": false,
      "minAnomaly": null,
      "maxAnomaly": null
    }
  },
  "sumColumns": {
    "Kabupaten/Kota": false,
    "remaja - Persentase remaja putri mendapatkan dan mengonsumsi TTD - Jumlah remaja putri di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) mengonsumsi TTD sesuai standar": true,
    "Persentase remaja putri mendapatkan dan mengonsumsi TTD - Jumlah remaja putri di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) mengonsumsi TTD sesuai standar": true,
    "Rematri  Konsumsi TTD": true,
    "remaja - Persentase remaja putri mendapatkan dan mengonsumsi TTD - % (2)": false,
    "Persentase remaja putri mendapatkan dan mengonsumsi TTD - % (2)": false,
    "% Konsumsi TTD": false,
    "remaja - Persentase remaja putri skrining anemia - Jumlah remaja putri kelas 7 dan 10 di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) yang skrining anemia sampai TW ini": true,
    "Persentase remaja putri skrining anemia - Jumlah remaja putri kelas 7 dan 10 di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) yang skrining anemia sampai TW ini": true,
    "Rematri Skrining Anemia": true,
    "remaja - Persentase remaja putri skrining anemia - % (3)": false,
    "Persentase remaja putri skrining anemia - % (3)": false,
    "% Skrining Anemia": false,
    "BUMIL - Laporan Pemeriksaan ANC - Jumlah ibu bersalin K6 sampai TW ini (2)": true,
    "Laporan Pemeriksaan ANC - Jumlah ibu bersalin K6 sampai TW ini (2)": true,
    "Ibu Hamil ANC 6x": true,
    "BUMIL - Laporan Pemeriksaan ANC - % K6": false,
    "Laporan Pemeriksaan ANC - % K6": false,
    "% ANC 6x": false,
    "BUMIL - Persentase ibu hamil mendapat suplementasi gizi - Jumlah ibu hamil mengonsumsi suplementasi gizi (minimal 180 tablet TTD dan MMS) sampai TW ini": true,
    "Persentase ibu hamil mendapat suplementasi gizi - Jumlah ibu hamil mengonsumsi suplementasi gizi (minimal 180 tablet TTD dan MMS) sampai TW ini": true,
    "Ibu Hamil Konsumsi TTD/MMS": true,
    "BUMIL - Persentase ibu hamil mendapat suplementasi gizi - % (2)": false,
    "Persentase ibu hamil mendapat suplementasi gizi - % (2)": false,
    "% TTD/MMS": false,
    "BUMIL - Persentase ibu hamil KEK mendapat makanan tambahan - Jumlah ibu hamil KEK mendapat makanan tambahan sampai TW ini": true,
    "Persentase ibu hamil KEK mendapat makanan tambahan - Jumlah ibu hamil KEK mendapat makanan tambahan sampai TW ini": true,
    "Ibu Hamil KEK Konsumsi MT": true,
    "BUMIL - Persentase ibu hamil KEK mendapat makanan tambahan - %": false,
    "Persentase ibu hamil KEK mendapat makanan tambahan - %": false,
    "% Bumil PMT": false,
    "gizi - Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 0-59 ditimbang dan diukur bulan ini (avg)": true,
    "Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 0-59 ditimbang dan diukur bulan ini (avg)": true,
    "Balita dipantau Pertumbuhan (D/S)": true,
    "gizi - Pemantauan Pertumbuhan dan Perkembangan - % (9)": false,
    "Pemantauan Pertumbuhan dan Perkembangan - % (9)": false,
    "% D/S": false,
    "anak - Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 12-59 bulan yang dipantau pertumbuhan dan perkembangan TW ini": true,
    "Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 12-59 bulan yang dipantau pertumbuhan dan perkembangan TW ini": true,
    "Jumlah Balita dipantau Tumbang": true,
    "anak - Pemantauan Pertumbuhan dan Perkembangan - % (3)": false,
    "Pemantauan Pertumbuhan dan Perkembangan - % (3)": false,
    "% Tumbang": false,
    "gizi - ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - Jumlah bayi usia 0-5 bulan yang mendapat ASI Eksklusif berdasarkan recall 24 jam": true,
    "ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - Jumlah bayi usia 0-5 bulan yang mendapat ASI Eksklusif berdasarkan recall 24 jam": true,
    "ASI Eksklusif": true,
    "gizi - ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - %": false,
    "ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - %": false,
    "% ASI": false,
    "gizi - ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - Jumlah anak usia 6-23 bulan mendapat MPASI baik(avg)": true,
    "ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - Jumlah anak usia 6-23 bulan mendapat MPASI baik(avg)": true,
    "MPASI": true,
    "gizi - ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (4)": false,
    "ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (4)": false,
    "% MPASI": false,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan gizi kurang yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": true,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan gizi kurang yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": true,
    "Jumlah  Gizi Kurang dapat MT": true,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - %": false,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - %": false,
    "% Gizi Kurang dapat MT": false,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan BB kurang yang tidak wasting dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": true,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan BB kurang yang tidak wasting dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": true,
    "Jumlah BB Kurang dapat MT": true,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - %": false,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - %": false,
    "% BB Kurang dapat MT": false,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - Jumlah seluruh balita usia 6-59 bulan dengan status pertumbuhan BB Tidak Naik (T) serta berat badan normal dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": true,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - Jumlah seluruh balita usia 6-59 bulan dengan status pertumbuhan BB Tidak Naik (T) serta berat badan normal dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": true,
    "Jumlah BB Tidak Naik (T) dapat MT": true,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - %": false,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - %": false,
    "% BB Tidak Naik (T) dapat MT": false,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - Jumlah Kasus Gizi Buruk bayi 6-59 Bulan mendapat perawatan sampai TW ini": true,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - Jumlah Kasus Gizi Buruk bayi 6-59 Bulan mendapat perawatan sampai TW ini": true,
    "Jumlah Kasus Gizi Buruk Mendapat Tata Laksana": true,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - % (4)": false,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - % (4)": false,
    "% Talak Gibur": false,
    "idl - IDL - Cakupan": true,
    "IDL - Cakupan": true,
    "Baduta IDL": true,
    "idl - IDL - (%) Capaian": false,
    "IDL - (%) Capaian": false,
    "% IDL": false
  },
  "avgColumns": {
    "Kabupaten/Kota": false,
    "remaja - Persentase remaja putri mendapatkan dan mengonsumsi TTD - Jumlah remaja putri di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) mengonsumsi TTD sesuai standar": false,
    "Persentase remaja putri mendapatkan dan mengonsumsi TTD - Jumlah remaja putri di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) mengonsumsi TTD sesuai standar": false,
    "Rematri  Konsumsi TTD": false,
    "remaja - Persentase remaja putri mendapatkan dan mengonsumsi TTD - % (2)": true,
    "Persentase remaja putri mendapatkan dan mengonsumsi TTD - % (2)": true,
    "% Konsumsi TTD": true,
    "remaja - Persentase remaja putri skrining anemia - Jumlah remaja putri kelas 7 dan 10 di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) yang skrining anemia sampai TW ini": false,
    "Persentase remaja putri skrining anemia - Jumlah remaja putri kelas 7 dan 10 di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) yang skrining anemia sampai TW ini": false,
    "Rematri Skrining Anemia": false,
    "remaja - Persentase remaja putri skrining anemia - % (3)": true,
    "Persentase remaja putri skrining anemia - % (3)": true,
    "% Skrining Anemia": true,
    "BUMIL - Laporan Pemeriksaan ANC - Jumlah ibu bersalin K6 sampai TW ini (2)": false,
    "Laporan Pemeriksaan ANC - Jumlah ibu bersalin K6 sampai TW ini (2)": false,
    "Ibu Hamil ANC 6x": false,
    "BUMIL - Laporan Pemeriksaan ANC - % K6": true,
    "Laporan Pemeriksaan ANC - % K6": true,
    "% ANC 6x": true,
    "BUMIL - Persentase ibu hamil mendapat suplementasi gizi - Jumlah ibu hamil mengonsumsi suplementasi gizi (minimal 180 tablet TTD dan MMS) sampai TW ini": false,
    "Persentase ibu hamil mendapat suplementasi gizi - Jumlah ibu hamil mengonsumsi suplementasi gizi (minimal 180 tablet TTD dan MMS) sampai TW ini": false,
    "Ibu Hamil Konsumsi TTD/MMS": false,
    "BUMIL - Persentase ibu hamil mendapat suplementasi gizi - % (2)": true,
    "Persentase ibu hamil mendapat suplementasi gizi - % (2)": true,
    "% TTD/MMS": true,
    "BUMIL - Persentase ibu hamil KEK mendapat makanan tambahan - Jumlah ibu hamil KEK mendapat makanan tambahan sampai TW ini": false,
    "Persentase ibu hamil KEK mendapat makanan tambahan - Jumlah ibu hamil KEK mendapat makanan tambahan sampai TW ini": false,
    "Ibu Hamil KEK Konsumsi MT": false,
    "BUMIL - Persentase ibu hamil KEK mendapat makanan tambahan - %": true,
    "Persentase ibu hamil KEK mendapat makanan tambahan - %": true,
    "% Bumil PMT": true,
    "gizi - Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 0-59 ditimbang dan diukur bulan ini (avg)": false,
    "Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 0-59 ditimbang dan diukur bulan ini (avg)": false,
    "Balita dipantau Pertumbuhan (D/S)": false,
    "gizi - Pemantauan Pertumbuhan dan Perkembangan - % (9)": true,
    "Pemantauan Pertumbuhan dan Perkembangan - % (9)": true,
    "% D/S": true,
    "anak - Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 12-59 bulan yang dipantau pertumbuhan dan perkembangan TW ini": false,
    "Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 12-59 bulan yang dipantau pertumbuhan dan perkembangan TW ini": false,
    "Jumlah Balita dipantau Tumbang": false,
    "anak - Pemantauan Pertumbuhan dan Perkembangan - % (3)": true,
    "Pemantauan Pertumbuhan dan Perkembangan - % (3)": true,
    "% Tumbang": true,
    "gizi - ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - Jumlah bayi usia 0-5 bulan yang mendapat ASI Eksklusif berdasarkan recall 24 jam": false,
    "ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - Jumlah bayi usia 0-5 bulan yang mendapat ASI Eksklusif berdasarkan recall 24 jam": false,
    "ASI Eksklusif": false,
    "gizi - ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - %": true,
    "ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - %": true,
    "% ASI": true,
    "gizi - ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - Jumlah anak usia 6-23 bulan mendapat MPASI baik(avg)": false,
    "ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - Jumlah anak usia 6-23 bulan mendapat MPASI baik(avg)": false,
    "MPASI": false,
    "gizi - ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (4)": true,
    "ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (4)": true,
    "% MPASI": true,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan gizi kurang yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": false,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan gizi kurang yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": false,
    "Jumlah  Gizi Kurang dapat MT": false,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - %": true,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - %": true,
    "% Gizi Kurang dapat MT": true,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan BB kurang yang tidak wasting dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": false,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan BB kurang yang tidak wasting dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": false,
    "Jumlah BB Kurang dapat MT": false,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - %": true,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - %": true,
    "% BB Kurang dapat MT": true,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - Jumlah seluruh balita usia 6-59 bulan dengan status pertumbuhan BB Tidak Naik (T) serta berat badan normal dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": false,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - Jumlah seluruh balita usia 6-59 bulan dengan status pertumbuhan BB Tidak Naik (T) serta berat badan normal dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": false,
    "Jumlah BB Tidak Naik (T) dapat MT": false,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - %": true,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - %": true,
    "% BB Tidak Naik (T) dapat MT": true,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - Jumlah Kasus Gizi Buruk bayi 6-59 Bulan mendapat perawatan sampai TW ini": false,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - Jumlah Kasus Gizi Buruk bayi 6-59 Bulan mendapat perawatan sampai TW ini": false,
    "Jumlah Kasus Gizi Buruk Mendapat Tata Laksana": false,
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - % (4)": true,
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - % (4)": true,
    "% Talak Gibur": true,
    "idl - IDL - Cakupan": false,
    "IDL - Cakupan": false,
    "Baduta IDL": false,
    "idl - IDL - (%) Capaian": true,
    "IDL - (%) Capaian": true,
    "% IDL": true
  },
  "customColumnNames": {
    "remaja - Persentase remaja putri mendapatkan dan mengonsumsi TTD - Jumlah remaja putri di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) mengonsumsi TTD sesuai standar": "Rematri  Konsumsi TTD",
    "Persentase remaja putri mendapatkan dan mengonsumsi TTD - Jumlah remaja putri di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) mengonsumsi TTD sesuai standar": "Rematri  Konsumsi TTD",
    "Rematri  Konsumsi TTD": "Rematri  Konsumsi TTD",
    "remaja - Persentase remaja putri mendapatkan dan mengonsumsi TTD - % (2)": "% Konsumsi TTD",
    "Persentase remaja putri mendapatkan dan mengonsumsi TTD - % (2)": "% Konsumsi TTD",
    "% Konsumsi TTD": "% Konsumsi TTD",
    "remaja - Persentase remaja putri skrining anemia - Jumlah remaja putri kelas 7 dan 10 di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) yang skrining anemia sampai TW ini": "Rematri Skrining Anemia",
    "Persentase remaja putri skrining anemia - Jumlah remaja putri kelas 7 dan 10 di satuan pendidikan (SMP/MTs/Pesantren/sederajat dan SMA/SMK/MAK/Pesantren/sederajat) yang skrining anemia sampai TW ini": "Rematri Skrining Anemia",
    "Rematri Skrining Anemia": "Rematri Skrining Anemia",
    "remaja - Persentase remaja putri skrining anemia - % (3)": "% Skrining Anemia",
    "Persentase remaja putri skrining anemia - % (3)": "% Skrining Anemia",
    "% Skrining Anemia": "% Skrining Anemia",
    "BUMIL - Laporan Pemeriksaan ANC - Jumlah ibu bersalin K6 sampai TW ini (2)": "Ibu Hamil ANC 6x",
    "Laporan Pemeriksaan ANC - Jumlah ibu bersalin K6 sampai TW ini (2)": "Ibu Hamil ANC 6x",
    "Ibu Hamil ANC 6x": "Ibu Hamil ANC 6x",
    "BUMIL - Laporan Pemeriksaan ANC - % K6": "% ANC 6x",
    "Laporan Pemeriksaan ANC - % K6": "% ANC 6x",
    "% ANC 6x": "% ANC 6x",
    "BUMIL - Persentase ibu hamil mendapat suplementasi gizi - Jumlah ibu hamil mengonsumsi suplementasi gizi (minimal 180 tablet TTD dan MMS) sampai TW ini": "Ibu Hamil Konsumsi TTD/MMS",
    "Persentase ibu hamil mendapat suplementasi gizi - Jumlah ibu hamil mengonsumsi suplementasi gizi (minimal 180 tablet TTD dan MMS) sampai TW ini": "Ibu Hamil Konsumsi TTD/MMS",
    "Ibu Hamil Konsumsi TTD/MMS": "Ibu Hamil Konsumsi TTD/MMS",
    "BUMIL - Persentase ibu hamil mendapat suplementasi gizi - % (2)": "% TTD/MMS",
    "Persentase ibu hamil mendapat suplementasi gizi - % (2)": "% TTD/MMS",
    "% TTD/MMS": "% TTD/MMS",
    "BUMIL - Persentase ibu hamil KEK mendapat makanan tambahan - Jumlah ibu hamil KEK mendapat makanan tambahan sampai TW ini": "Ibu Hamil KEK Konsumsi MT",
    "Persentase ibu hamil KEK mendapat makanan tambahan - Jumlah ibu hamil KEK mendapat makanan tambahan sampai TW ini": "Ibu Hamil KEK Konsumsi MT",
    "Ibu Hamil KEK Konsumsi MT": "Ibu Hamil KEK Konsumsi MT",
    "BUMIL - Persentase ibu hamil KEK mendapat makanan tambahan - %": "% Bumil PMT",
    "Persentase ibu hamil KEK mendapat makanan tambahan - %": "% Bumil PMT",
    "% Bumil PMT": "% Bumil PMT",
    "gizi - Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 0-59 ditimbang dan diukur bulan ini (avg)": "Balita dipantau Pertumbuhan (D/S)",
    "Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 0-59 ditimbang dan diukur bulan ini (avg)": "Balita dipantau Pertumbuhan (D/S)",
    "Balita dipantau Pertumbuhan (D/S)": "Balita dipantau Pertumbuhan (D/S)",
    "gizi - Pemantauan Pertumbuhan dan Perkembangan - % (9)": "% D/S",
    "Pemantauan Pertumbuhan dan Perkembangan - % (9)": "% D/S",
    "% D/S": "% D/S",
    "anak - Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 12-59 bulan yang dipantau pertumbuhan dan perkembangan TW ini": "Jumlah Balita dipantau Tumbang",
    "Pemantauan Pertumbuhan dan Perkembangan - Jumlah balita usia 12-59 bulan yang dipantau pertumbuhan dan perkembangan TW ini": "Jumlah Balita dipantau Tumbang",
    "Jumlah Balita dipantau Tumbang": "Jumlah Balita dipantau Tumbang",
    "anak - Pemantauan Pertumbuhan dan Perkembangan - % (3)": "% Tumbang",
    "Pemantauan Pertumbuhan dan Perkembangan - % (3)": "% Tumbang",
    "% Tumbang": "% Tumbang",
    "gizi - ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - Jumlah bayi usia 0-5 bulan yang mendapat ASI Eksklusif berdasarkan recall 24 jam": "ASI Eksklusif",
    "ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - Jumlah bayi usia 0-5 bulan yang mendapat ASI Eksklusif berdasarkan recall 24 jam": "ASI Eksklusif",
    "ASI Eksklusif": "ASI Eksklusif",
    "gizi - ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - %": "% ASI",
    "ASI Eksklusif dan MPASI - Persentase bayi usia <6 bulan mendapat ASI Eksklusif - %": "% ASI",
    "% ASI": "% ASI",
    "gizi - ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - Jumlah anak usia 6-23 bulan mendapat MPASI baik(avg)": "MPASI",
    "ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - Jumlah anak usia 6-23 bulan mendapat MPASI baik(avg)": "MPASI",
    "MPASI": "MPASI",
    "gizi - ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (4)": "% MPASI",
    "ASI Eksklusif dan MPASI - Persentase Anak 6-23 bulan mendapat MPASI - % (4)": "% MPASI",
    "% MPASI": "% MPASI",
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan gizi kurang yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": "Jumlah  Gizi Kurang dapat MT",
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan gizi kurang yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": "Jumlah  Gizi Kurang dapat MT",
    "Jumlah  Gizi Kurang dapat MT": "Jumlah  Gizi Kurang dapat MT",
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - %": "% Gizi Kurang dapat MT",
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi kurang mendapat makanan tambahan - %": "% Gizi Kurang dapat MT",
    "% Gizi Kurang dapat MT": "% Gizi Kurang dapat MT",
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan BB kurang yang tidak wasting dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": "Jumlah BB Kurang dapat MT",
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - Jumlah balita usia 6-59 bulan BB kurang yang tidak wasting dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": "Jumlah BB Kurang dapat MT",
    "Jumlah BB Kurang dapat MT": "Jumlah BB Kurang dapat MT",
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - %": "% BB Kurang dapat MT",
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan kurang mendapat makanan tambahan - %": "% BB Kurang dapat MT",
    "% BB Kurang dapat MT": "% BB Kurang dapat MT",
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - Jumlah seluruh balita usia 6-59 bulan dengan status pertumbuhan BB Tidak Naik (T) serta berat badan normal dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": "Jumlah BB Tidak Naik (T) dapat MT",
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - Jumlah seluruh balita usia 6-59 bulan dengan status pertumbuhan BB Tidak Naik (T) serta berat badan normal dengan atau tanpa stunting yang mendapatkan makanan tambahan berbahan pangan lokal sampai TW ini": "Jumlah BB Tidak Naik (T) dapat MT",
    "Jumlah BB Tidak Naik (T) dapat MT": "Jumlah BB Tidak Naik (T) dapat MT",
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - %": "% BB Tidak Naik (T) dapat MT",
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita berat badan tidak naik (T) mendapat makanan tambahan - %": "% BB Tidak Naik (T) dapat MT",
    "% BB Tidak Naik (T) dapat MT": "% BB Tidak Naik (T) dapat MT",
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - Jumlah Kasus Gizi Buruk bayi 6-59 Bulan mendapat perawatan sampai TW ini": "Jumlah Kasus Gizi Buruk Mendapat Tata Laksana",
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - Jumlah Kasus Gizi Buruk bayi 6-59 Bulan mendapat perawatan sampai TW ini": "Jumlah Kasus Gizi Buruk Mendapat Tata Laksana",
    "Jumlah Kasus Gizi Buruk Mendapat Tata Laksana": "Jumlah Kasus Gizi Buruk Mendapat Tata Laksana",
    "gizi - Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - % (4)": "% Talak Gibur",
    "Tatalaksana Balita Bermasalah Gizi - Persentase balita gizi buruk mendapat tata laksana - % (4)": "% Talak Gibur",
    "% Talak Gibur": "% Talak Gibur",
    "idl - IDL - Cakupan": "Baduta IDL",
    "IDL - Cakupan": "Baduta IDL",
    "Baduta IDL": "Baduta IDL",
    "idl - IDL - (%) Capaian": "% IDL",
    "IDL - (%) Capaian": "% IDL",
    "% IDL": "% IDL"
  },
  "columnOrder": [
    "Kabupaten/Kota",
    "Rematri  Konsumsi TTD",
    "% Konsumsi TTD",
    "Rematri Skrining Anemia",
    "% Skrining Anemia",
    "Ibu Hamil ANC 6x",
    "% ANC 6x",
    "Ibu Hamil Konsumsi TTD/MMS",
    "% TTD/MMS",
    "Ibu Hamil KEK Konsumsi MT",
    "% Bumil PMT",
    "Balita dipantau Pertumbuhan (D/S)",
    "% D/S",
    "Jumlah Balita dipantau Tumbang",
    "% Tumbang",
    "ASI Eksklusif",
    "% ASI",
    "MPASI",
    "% MPASI",
    "Jumlah  Gizi Kurang dapat MT",
    "% Gizi Kurang dapat MT",
    "Jumlah BB Kurang dapat MT",
    "% BB Kurang dapat MT",
    "Jumlah BB Tidak Naik (T) dapat MT",
    "% BB Tidak Naik (T) dapat MT",
    "Jumlah Kasus Gizi Buruk Mendapat Tata Laksana",
    "% Talak Gibur",
    "Baduta IDL",
    "% IDL"
  ]
};
