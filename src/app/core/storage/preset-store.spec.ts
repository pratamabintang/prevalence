import { describe, expect, it } from 'vitest';
import {
  GenericPresetStore,
  InMemoryFileDownloadAdapter,
  InMemoryStorageAdapter,
  LocalStorageAdapter,
} from './preset-store';

interface SampleConfig {
  version: string;
  name: string;
  count: number;
}

describe('GenericPresetStore', () => {
  const createStore = (validator?: (data: unknown) => SampleConfig) => {
    const storage = new InMemoryStorageAdapter();
    const downloader = new InMemoryFileDownloadAdapter();
    const store = new GenericPresetStore<SampleConfig>({
      storageKey: 'test_config_key',
      defaultFileNamePrefix: 'test_cfg',
      storage,
      downloader,
      validator,
      generateFileName: (cfg) => `custom_${cfg.name}.json`,
    });
    return { store, storage, downloader };
  };

  it('should return null when no preset is saved', () => {
    const { store } = createStore();
    expect(store.hasSavedPreset()).toBe(false);
    expect(store.loadLastPreset()).toBeNull();
  });

  it('should save and load a valid preset', () => {
    const { store, storage, downloader } = createStore();
    const sample: SampleConfig = { version: '1.0', name: 'demo', count: 42 };

    store.savePreset(sample, true);

    expect(store.hasSavedPreset()).toBe(true);
    expect(store.loadLastPreset()).toEqual(sample);

    // Verify storage serialization
    const raw = storage.getItem('test_config_key');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual(sample);

    // Verify download triggered
    expect(downloader.downloads).toHaveLength(1);
    expect(downloader.lastDownload?.fileName).toBe('custom_demo.json');
    expect(JSON.parse(downloader.lastDownload!.content)).toEqual(sample);
  });

  it('should save preset without triggering download when triggerDownload=false', () => {
    const { store, downloader } = createStore();
    const sample: SampleConfig = { version: '1.0', name: 'nodownload', count: 10 };

    store.savePreset(sample, false);

    expect(store.hasSavedPreset()).toBe(true);
    expect(store.loadLastPreset()).toEqual(sample);
    expect(downloader.downloads).toHaveLength(0);
  });

  it('should clear saved preset', () => {
    const { store } = createStore();
    store.savePreset({ version: '1.0', name: 'to_clear', count: 5 });
    expect(store.hasSavedPreset()).toBe(true);

    store.clearPreset();
    expect(store.hasSavedPreset()).toBe(false);
    expect(store.loadLastPreset()).toBeNull();
  });

  it('should parse valid JSON text and apply validator', () => {
    const validator = (data: unknown): SampleConfig => {
      const obj = data as any;
      if (!obj || typeof obj.name !== 'string') {
        throw new Error('Field "name" wajib bertipe string.');
      }
      return obj as SampleConfig;
    };
    const { store } = createStore(validator);

    const validJson = JSON.stringify({ version: '1.0', name: 'validated', count: 99 });
    const parsed = store.parsePresetJson(validJson);
    expect(parsed.name).toBe('validated');
    expect(parsed.count).toBe(99);

    // Invalid JSON text throws
    expect(() => store.parsePresetJson('invalid json {')).toThrow(
      'Format berkas konfigurasi tidak valid (bukan JSON yang valid).',
    );

    // Schema error thrown by validator
    const badSchemaJson = JSON.stringify({ version: '1.0', count: 123 });
    expect(() => store.parsePresetJson(badSchemaJson)).toThrow(
      'Field "name" wajib bertipe string.',
    );
  });

  it('should safely handle corrupted JSON in storage during loadLastPreset', () => {
    const { store, storage } = createStore();
    storage.setItem('test_config_key', '{ corrupted json ...');

    expect(store.hasSavedPreset()).toBe(true);
    expect(store.loadLastPreset()).toBeNull();
  });
});

describe('LocalStorageAdapter', () => {
  it('should return null safely in environment without window', () => {
    const adapter = new LocalStorageAdapter();
    expect(adapter.getItem('test_key_ls')).toBeNull();
  });

  it('should safely handle get, set, and remove when window.localStorage is present', () => {
    const mem = new Map<string, string>();
    const mockLocalStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => { mem.delete(k); },
    };

    (globalThis as any).window = { localStorage: mockLocalStorage };

    try {
      const adapter = new LocalStorageAdapter();
      adapter.setItem('test_key_ls', 'test_value');
      expect(adapter.getItem('test_key_ls')).toBe('test_value');
      adapter.removeItem('test_key_ls');
      expect(adapter.getItem('test_key_ls')).toBeNull();
    } finally {
      delete (globalThis as any).window;
    }
  });
});
