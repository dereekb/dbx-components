import { describe, expect, it } from 'vitest';
import { validateAppAssets, type AppAssetsInspection, type InspectedFile } from './index.js';

const ASSETS_TS = `import { type AssetPathRef, localAsset, remoteAsset, assetFolder, remoteAssetBaseUrl } from '@dereekb/rxjs';

const DATA = assetFolder('data');
const CDN = remoteAssetBaseUrl('https://cdn.example.com/assets');

export const DEMO_LOGO: AssetPathRef = localAsset('logo.svg');
export const DEMO_DISTRICTS: AssetPathRef = DATA.asset('districts.json');
export const DEMO_REMOTE: AssetPathRef = remoteAsset('https://example.com/data.json');
export const DEMO_CDN_CONFIG: AssetPathRef = CDN.asset('config.json');

export const DEMO_ASSETS: AssetPathRef[] = [DEMO_LOGO, DEMO_DISTRICTS, DEMO_REMOTE, DEMO_CDN_CONFIG];
`;

const BARREL_TS = `export * from './assets';\nexport * from './model';\n`;

const ROOT_CONFIG_TS = `import { provideDbxAssetLoader, provideDbxStorage } from '@dereekb/dbx-core';\nimport type { ApplicationConfig } from '@angular/core';\nexport const appConfig: ApplicationConfig = { providers: [provideDbxStorage(), provideDbxAssetLoader()] };\n`;

function happyInspection(): AppAssetsInspection {
  const componentFiles: InspectedFile[] = [
    { relPath: 'src/lib/assets.ts', text: ASSETS_TS },
    { relPath: 'src/lib/index.ts', text: BARREL_TS }
  ];
  return {
    component: { rootDir: 'components/demo-firebase', folder: 'src/lib', status: 'ok', files: componentFiles },
    app: {
      rootConfigText: ROOT_CONFIG_TS,
      assetFiles: new Set(['logo.svg', 'data/districts.json'])
    },
    appRootDir: 'apps/demo',
    appStatus: 'ok'
  };
}

describe('validateAppAssets — happy path', () => {
  it('produces zero violations when refs, files, and provider are all wired', () => {
    const result = validateAppAssets(happyInspection(), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo' });
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.violations).toEqual([]);
  });
});

describe('validateAppAssets — provider missing', () => {
  it('emits exactly one DBX_ASSET_PROVIDER_MISSING when the call site is absent', () => {
    const inspection = happyInspection();
    const stripped: AppAssetsInspection = {
      ...inspection,
      app: { ...inspection.app, rootConfigText: ROOT_CONFIG_TS.replace(/provideDbxAssetLoader\(\)/, '') }
    };
    const result = validateAppAssets(stripped, { componentDir: 'components/demo-firebase', apiDir: 'apps/demo' });
    const providerViolations = result.violations.filter((v) => v.code === 'DBX_ASSET_PROVIDER_MISSING');
    expect(providerViolations).toHaveLength(1);
    expect(providerViolations[0].severity).toBe('error');
  });
});

describe('validateAppAssets — local file missing', () => {
  it('emits one DBX_ASSET_LOCAL_FILE_MISSING per local ref with no on-disk file', () => {
    const inspection = happyInspection();
    const stripped: AppAssetsInspection = {
      ...inspection,
      app: { ...inspection.app, assetFiles: new Set<string>() }
    };
    const result = validateAppAssets(stripped, { componentDir: 'components/demo-firebase', apiDir: 'apps/demo' });
    const missing = result.violations.filter((v) => v.code === 'DBX_ASSET_LOCAL_FILE_MISSING');
    expect(missing).toHaveLength(2);
    const messages = missing.map((v) => v.message);
    expect(messages.some((m) => m.includes('DEMO_LOGO'))).toBe(true);
    expect(messages.some((m) => m.includes('DEMO_DISTRICTS'))).toBe(true);
  });
});
