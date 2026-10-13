export interface StuntingIndicatorDef {
  code: string;
  key: string;
  name: string;
  short_name: string;
}

export interface StuntingObservation {
  kabupaten_kota: string;
  triwulan: string;
  y_stunting: number;
  latitude: number;
  longitude: number;
  x1_ttd_rematri: number;
  x2_ttd_ibu_hamil: number;
  x3_pmt_bumil_kek: number;
  x4_balita_ditimbang_ds: number;
  x5_asi_eksklusif: number;
  x6_mpasi_beragam: number;
  x7_pmt_gizi_kurang: number;
  x8_tatalaksana_gizi_buruk: number;
  x9_balita_idl: number;
  [key: string]: string | number;
}

export interface BoxPlotMetric {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  std: number;
  range: number;
  iqr: number;
}

export interface PeriodSummaryStats {
  triwulan: string;
  y_stunting: BoxPlotMetric;
  indicators: Record<
    string,
    {
      mean: number;
      median: number;
      min: number;
      max: number;
      std: number;
    }
  >;
}

export interface TwoWayFERow {
  variable: string;
  label: string;
  coef: number;
  se: number;
  p_value: number;
}

export interface FirstDifferenceRow {
  variable: string;
  label: string;
  coef: number;
  se: number;
  p_value: number;
}

export interface MoransIRow {
  triwulan: string;
  variable: string;
  moran_i: number;
  p_value: number;
  significant_5pct: boolean;
}

export interface GWRRow {
  triwulan: string;
  bandwidth: number;
  loocv_rmse: number;
  coef_min: number;
  coef_median: number;
  coef_max: number;
  n_p_sig: number;
}

export interface PCAVarianceRow {
  component: number;
  explained_var: number;
  cumulative: number;
}

export interface VIFRow {
  variable: string;
  label: string;
  vif: number;
}

export interface StuntingDashboardDataset {
  metadata: {
    title: string;
    subtitle: string;
    periods: string[];
    wilayah_count: number;
    period_count: number;
    observation_count: number;
    source: string;
    indicators: StuntingIndicatorDef[];
  };
  summary_cards: {
    wilayah_count: number;
    period_count: number;
    median_latest: number;
    median_first: number;
    median_change: number;
  };
  period_stats: Record<string, PeriodSummaryStats>;
  models: {
    fe9: TwoWayFERow[];
    fepc: { component: string; coef: number; se: number; p_value: number }[];
    fd: FirstDifferenceRow[];
    moran: MoransIRow[];
    gwr: GWRRow[];
    pca_var: PCAVarianceRow[];
    vif: VIFRow[];
    pls_cv: { components: number; cv_rmse: number; cv_r2: number }[];
    audit_checks: { check: string; pass: boolean }[];
  };
  coordinates: { kabupaten_kota: string; lon: number; lat: number }[];
  observations: StuntingObservation[];
}
