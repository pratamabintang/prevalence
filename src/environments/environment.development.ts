export const environment = {
  production: false,
  googleAppsScriptUrl: '',
  backendApiUrl: '/api',
  enableStuntingDashboard: false,
  enableStuntingCohort: false,
  enableExcelJoinToolbarActions: false,
  /**
   * Tombol "Pengaturan Kolom" pada tabel hasil penggabungan data (/data).
   * Menampilkan/menyembunyikan drawer collapsible untuk mengatur tipe data, anomali, kalkulasi baris jumlah & rata-rata, serta target kolom.
   * Disembunyikan (false) karena target indikator dan nama kolom kini sudah dapat diubah langsung in-place lewat sel tabel.
   */
  enableColumnSettingsButton: false,
  enableChartToolbarActions: false,
  enableChartSettings: false,
  enablePriorityQuadrant: false,
  enablePeriodTrends: false,
  enableCorrelationMatrix: false,
  enableChartPriorityQuadrant: false,
  enableChartPeriodTrends: false,
  enableChartCorrelationMatrix: false,
  enableComparativeMatrix: false,
  enableRegionalComparativeMatrix: false,
  enableChartByRegion: false,
  enableChartByMap: false,
  enableByRegion: false,
  enableByMap: false,
  enableChartByIndicator: false,
  enableByIndicator: false,
};
