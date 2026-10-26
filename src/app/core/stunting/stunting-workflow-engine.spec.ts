import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import * as XLSX from 'xlsx-js-style';
import { StuntingWorkflowEngine } from './stunting-workflow-engine';
import { StuntingEvaluationEngine } from './stunting-evaluation-engine';

describe('StuntingWorkflowEngine', () => {
  let engine: StuntingWorkflowEngine;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StuntingWorkflowEngine],
    });
    engine = TestBed.inject(StuntingWorkflowEngine);
  });

  describe('Stepper Invariants & Transitions', () => {
    it('should initialize with Step 1 and enforce invariants on empty dataset', () => {
      expect(engine.activeStep()).toBe(1);
      expect(engine.canProceedToStep2()).toBe(false);
      expect(engine.canProceedToStep3()).toBe(false);

      const checkStep2 = engine.canTransitionTo(2);
      expect(checkStep2.allowed).toBe(false);
      expect(checkStep2.reason).toContain('Data gabungan valid belum tersedia');

      const checkStep3 = engine.canTransitionTo(3);
      expect(checkStep3.allowed).toBe(false);

      // Transition should be rejected
      const transitionResult = engine.transitionTo(2);
      expect(transitionResult).toBe(false);
      expect(engine.activeStep()).toBe(1);
    });

    it('should allow transition to Step 2 once valid joined rows exist', () => {
      engine.setJoinedDataset({
        rows: [
          { __id: 'row-0', 'Kabupaten/Kota': 'Kab. Cilacap', 'Cakupan %': 85 },
          { __id: 'row-1', 'Kabupaten/Kota': 'Kab. Banyumas', 'Cakupan %': 88 },
        ],
        columns: ['Kabupaten/Kota', 'Cakupan %'],
        keyCol: 'Kabupaten/Kota',
      });

      expect(engine.validJoinedRows().length).toBe(2);
      expect(engine.canProceedToStep2()).toBe(true);

      const checkStep2 = engine.canTransitionTo(2);
      expect(checkStep2.allowed).toBe(true);

      const transitioned = engine.transitionTo(2);
      expect(transitioned).toBe(true);
      expect(engine.activeStep()).toBe(2);
    });

    it('should enforce invariant for Step 3: requires at least one subcategory indicator', () => {
      engine.setJoinedDataset({
        rows: [
          { __id: 'row-0', 'Kabupaten/Kota': 'Kab. Cilacap', 'Cakupan %': 85 },
        ],
        columns: ['Kabupaten/Kota', 'Cakupan %'],
        keyCol: 'Kabupaten/Kota',
      });
      engine.transitionTo(2);

      // Categories initialized with standard categories, but 0 sub-categories
      expect(engine.totalIndicatorsCount()).toBe(0);
      expect(engine.canProceedToStep3()).toBe(false);

      const checkStep3 = engine.canTransitionTo(3);
      expect(checkStep3.allowed).toBe(false);
      expect(checkStep3.reason).toContain('Minimal harus ada 1 sub-kategori indikator');

      // Add a subcategory
      const firstCat = engine.categories()[0];
      engine.addSubCategory(firstCat.id, {
        name: 'Indikator Uji',
        numeratorCol: 'Cakupan %',
      });

      expect(engine.totalIndicatorsCount()).toBe(1);
      expect(engine.canProceedToStep3()).toBe(true);

      const checkStep3After = engine.canTransitionTo(3);
      expect(checkStep3After.allowed).toBe(true);

      const transitioned = engine.transitionTo(3);
      expect(transitioned).toBe(true);
      expect(engine.activeStep()).toBe(3);
    });

    it('should allow stepping backward at any time', () => {
      engine.setJoinedDataset({
        rows: [{ __id: 'row-0', 'Kabupaten/Kota': 'Kab. Cilacap', 'Cakupan %': 85 }],
        columns: ['Kabupaten/Kota', 'Cakupan %'],
      });
      engine.transitionTo(2);
      expect(engine.activeStep()).toBe(2);

      const backTo1 = engine.transitionTo(1);
      expect(backTo1).toBe(true);
      expect(engine.activeStep()).toBe(1);
    });
  });

  describe('Dataset Ingestion & Row Exclusions', () => {
    it('should detect summary, target, and total rows and exclude them from active region rows', () => {
      engine.setJoinedDataset({
        rows: [
          { __id: 'row-0', 'Kabupaten/Kota': 'Kab. Cilacap', Capaian: 80 },
          { __id: 'row-1', 'Kabupaten/Kota': 'Kab. Banyumas', Capaian: 82 },
          { __id: 'row-2', 'Kabupaten/Kota': 'JAWA TENGAH', Capaian: 81 },
          { __id: 'row-3', 'Kabupaten/Kota': 'TARGET TAHUN 2026', Capaian: 90 },
          { __id: 'row-4', 'Kabupaten/Kota': 'JUMLAH TOTAL', Capaian: 162 },
          { __id: 'row-5', 'Kabupaten/Kota': '', Capaian: null }, // Blank row
        ],
        columns: ['Kabupaten/Kota', 'Capaian'],
        keyCol: 'Kabupaten/Kota',
      });

      expect(engine.summaryRowData()).toBeTruthy();
      expect(engine.summaryRowData()!['Kabupaten/Kota']).toBe('JAWA TENGAH');

      expect(engine.targetRowData()).toBeTruthy();
      expect(engine.targetRowData()!['Kabupaten/Kota']).toBe('TARGET TAHUN 2026');

      expect(engine.totalRowData()).toBeTruthy();
      expect(engine.totalRowData()!['Kabupaten/Kota']).toBe('JUMLAH TOTAL');

      // Valid region rows should only be the 2 districts (Cilacap and Banyumas)
      expect(engine.activeRegionRows().length).toBe(2);
      expect(engine.activeRegionRows().map((r) => r['Kabupaten/Kota'])).toEqual([
        'Kab. Cilacap',
        'Kab. Banyumas',
      ]);
    });

    it('should toggle row exclusion manually and update validJoinedRows', () => {
      engine.setJoinedDataset({
        rows: [
          { __id: 'row-0', 'Kabupaten/Kota': 'Kab. Cilacap', Capaian: 80 },
          { __id: 'row-1', 'Kabupaten/Kota': 'Kab. Banyumas', Capaian: 82 },
        ],
        columns: ['Kabupaten/Kota', 'Capaian'],
        keyCol: 'Kabupaten/Kota',
      });

      expect(engine.validJoinedRows().length).toBe(2);

      // Exclude row-0
      engine.toggleRowExclusion('row-0');
      expect(engine.validJoinedRows().length).toBe(1);
      expect(engine.validJoinedRows()[0]['Kabupaten/Kota']).toBe('Kab. Banyumas');

      // Re-include row-0
      engine.toggleRowExclusion('row-0');
      expect(engine.validJoinedRows().length).toBe(2);
    });

    it('should execute multi-sheet workbook join via ExcelJoinEngine', () => {
      const wb = XLSX.utils.book_new();

      const ws1Data = [
        ['Kabupaten/Kota', 'Sasaran Balita', 'Balita Stunting'],
        ['Cilacap', 1000, 120],
        ['Banyumas', 1200, 150],
        ['JAWA TENGAH', 2200, 270],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
      XLSX.utils.book_append_sheet(wb, ws1, 'Gizi Balita');

      const ws2Data = [
        ['Kabupaten/Kota', 'Ibu Hamil K4'],
        ['Cilacap', 950],
        ['Banyumas', 1100],
        ['JAWA TENGAH', 2050],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
      XLSX.utils.book_append_sheet(wb, ws2, 'KIA');

      const joinResult = engine.executeWorkbookJoin({
        workbook: wb,
        selectedSheets: [
          {
            name: 'Gizi Balita',
            selected: true,
            dataStartRow: 2,
            columns: [
              { header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'], colIndex: 0 },
              { header: 'Sasaran Balita', leafHeader: 'Sasaran Balita', layers: ['Sasaran Balita'], colIndex: 1 },
              { header: 'Balita Stunting', leafHeader: 'Balita Stunting', layers: ['Balita Stunting'], colIndex: 2 },
            ],
            headers: ['Kabupaten/Kota', 'Sasaran Balita', 'Balita Stunting'],
            variables: ['Sasaran Balita', 'Balita Stunting'],
            joinColumn: 'Kabupaten/Kota',
          },
          {
            name: 'KIA',
            selected: true,
            dataStartRow: 2,
            columns: [
              { header: 'Kabupaten/Kota', leafHeader: 'Kabupaten/Kota', layers: ['Kabupaten/Kota'], colIndex: 0 },
              { header: 'Ibu Hamil K4', leafHeader: 'Ibu Hamil K4', layers: ['Ibu Hamil K4'], colIndex: 1 },
            ],
            headers: ['Kabupaten/Kota', 'Ibu Hamil K4'],
            variables: ['Ibu Hamil K4'],
            joinColumn: 'Kabupaten/Kota',
          },
        ],
        joinBy: 'Kabupaten/Kota',
        stripKabupaten: true,
      });

      expect(joinResult.rows.length).toBeGreaterThan(0);
      expect(engine.joinedRows().length).toBe(joinResult.rows.length);
      expect(engine.joinedColumns()).toContain('Ibu Hamil K4');
      expect(engine.summaryRowData()).toBeTruthy();
    });
  });

  describe('Category & Indicator Builder Management', () => {
    it('should add, update, and remove categories and subcategories', () => {
      engine.setJoinedDataset({
        rows: [{ __id: 'row-0', 'Kabupaten/Kota': 'Cilacap', Realisasi: 90, Sasaran: 100 }],
        columns: ['Kabupaten/Kota', 'Realisasi', 'Sasaran'],
      });

      const initialCatsCount = engine.categories().length;
      engine.addCategory('Kategori Khusus Baru');
      expect(engine.categories().length).toBe(initialCatsCount + 1);

      const addedCat = engine.categories()[engine.categories().length - 1];
      expect(addedCat.name).toBe('Kategori Khusus Baru');

      // Add subcategory
      engine.addSubCategory(addedCat.id, {
        name: 'Sub Intervensi 1',
        numeratorCol: 'Realisasi',
        denominatorCol: 'Sasaran',
        targetCurrentYear: 95,
      });

      const updatedCat = engine.categories().find((c) => c.id === addedCat.id);
      expect(updatedCat?.subCategories.length).toBe(1);
      expect(updatedCat?.subCategories[0].name).toBe('Sub Intervensi 1');

      // Update subcategory
      const subId = updatedCat!.subCategories[0].id;
      engine.updateSubCategory(addedCat.id, subId, {
        targetCurrentYear: 98,
      });

      const reUpdatedCat = engine.categories().find((c) => c.id === addedCat.id);
      expect(reUpdatedCat?.subCategories[0].targetCurrentYear).toBe(98);

      // Remove subcategory
      engine.removeSubCategory(addedCat.id, subId);
      expect(engine.categories().find((c) => c.id === addedCat.id)?.subCategories.length).toBe(0);

      // Remove category
      engine.removeCategory(addedCat.id);
      expect(engine.categories().length).toBe(initialCatsCount);
    });

    it('should auto-populate Dinkes standard indicators from joined columns', () => {
      engine.setJoinedDataset({
        rows: [
          {
            __id: 'row-0',
            'Kabupaten/Kota': 'Cilacap',
            'Ibu Hamil K4 %': 88.5,
            'Balita Ditimbang (D/S) %': 78.2,
          },
          {
            __id: 'row-1',
            'Kabupaten/Kota': 'JAWA TENGAH',
            'Ibu Hamil K4 %': 89.0,
            'Balita Ditimbang (D/S) %': 80.0,
          },
          {
            __id: 'row-2',
            'Kabupaten/Kota': 'TARGET TAHUN 2026',
            'Ibu Hamil K4 %': 90.0,
            'Balita Ditimbang (D/S) %': 85.0,
          },
        ],
        columns: ['Kabupaten/Kota', 'Ibu Hamil K4 %', 'Balita Ditimbang (D/S) %'],
      });

      const matchCount = engine.autoPopulateIndicators();
      expect(matchCount).toBeGreaterThan(0);
      expect(engine.totalIndicatorsCount()).toBeGreaterThan(0);

      // Should find indicators under standard categories
      const allSubs = engine.categories().flatMap((c) => c.subCategories);
      const k4 = allSubs.find((s) => (s.name ?? '').toLowerCase().includes('k4'));
      expect(k4).toBeTruthy();
    });
  });

  describe('Step 3 Evaluation Lifecycle & Scorecard', () => {
    it('should calculate evaluation results reactively when data and categories exist', () => {
      engine.setJoinedDataset({
        rows: [
          {
            __id: 'row-0',
            'Kabupaten/Kota': 'Cilacap',
            'Sasaran K4': 100,
            'Realisasi K4': 95,
          },
          {
            __id: 'row-1',
            'Kabupaten/Kota': 'Banyumas',
            'Sasaran K4': 200,
            'Realisasi K4': 185,
          },
        ],
        columns: ['Kabupaten/Kota', 'Sasaran K4', 'Realisasi K4'],
      });

      const cat1 = engine.categories()[0];
      engine.addSubCategory(cat1.id, {
        name: 'Cakupan K4',
        numeratorCol: 'Realisasi K4',
        denominatorCol: 'Sasaran K4',
        targetCurrentYear: 90,
      });

      const res = engine.evaluationResult();
      expect(res).toBeTruthy();
      expect(res?.rows.length).toBe(1);
      expect(res?.rows[0].name).toBe('Cakupan K4');

      // Status should be evaluated
      expect(engine.onTrackCount() + engine.perluPercepatanCount() + engine.perluPerhatianCount()).toBeGreaterThan(0);
    });

    it('should reactively re-evaluate when active quarter or tolerance threshold changes', () => {
      engine.setJoinedDataset({
        rows: [
          {
            __id: 'row-0',
            'Kabupaten/Kota': 'Cilacap',
            'Sasaran K4': 100,
            'Realisasi K4': 90,
          },
        ],
        columns: ['Kabupaten/Kota', 'Sasaran K4', 'Realisasi K4'],
      });

      const cat1 = engine.categories()[0];
      engine.addSubCategory(cat1.id, {
        name: 'Cakupan K4',
        numeratorCol: 'Realisasi K4',
        denominatorCol: 'Sasaran K4',
        targetCurrentYear: 100,
      });

      // Default active quarter
      expect(engine.activeQuarter()).toBe(1);

      // Manually change active quarter
      engine.manualActiveQuarter.set(2);
      expect(engine.activeQuarter()).toBe(2);

      // Change tolerance threshold
      engine.toleranceThreshold.set(-10.0);
      expect(engine.toleranceThreshold()).toBe(-10.0);
    });

    it('should compute regionalScorecards reactively and support district drilldown', () => {
      engine.setJoinedDataset({
        rows: [
          {
            __id: 'row-0',
            'Kabupaten/Kota': 'Cilacap',
            'Sasaran K4': 100,
            'Realisasi K4': 50, // 50% -> perlu percepatan (target 90)
          },
          {
            __id: 'row-1',
            'Kabupaten/Kota': 'Banyumas',
            'Sasaran K4': 100,
            'Realisasi K4': 95, // 95% -> on track (target 90)
          },
        ],
        columns: ['Kabupaten/Kota', 'Sasaran K4', 'Realisasi K4'],
      });

      const cat1 = engine.categories()[0];
      engine.addSubCategory(cat1.id, {
        name: 'Cakupan K4',
        numeratorCol: 'Realisasi K4',
        denominatorCol: 'Sasaran K4',
        targetCurrentYear: 90,
      });

      const regional = engine.regionalScorecards();
      expect(regional.length).toBe(2);

      // Default sorting: lagging regions first (Cilacap has 1 perlu percepatan, Banyumas has 0)
      expect(regional[0].regionName).toBe('Cilacap');
      expect(regional[0].summary.perluPercepatanCount).toBe(1);
      expect(regional[1].regionName).toBe('Banyumas');
      expect(regional[1].summary.onTrackCount).toBe(1);

      // Select for drilldown
      expect(engine.selectedRegionForDrilldown()).toBeNull();
      expect(engine.activeRegionalDrilldownScorecard()).toBeNull();

      engine.selectedRegionForDrilldown.set('Banyumas');
      expect(engine.activeRegionalDrilldownScorecard()).toBeDefined();
      expect(engine.activeRegionalDrilldownScorecard()?.regionName).toBe('Banyumas');
      expect(engine.activeRegionalDrilldownScorecard()?.summary.onTrackCount).toBe(1);
    });
  });
});
