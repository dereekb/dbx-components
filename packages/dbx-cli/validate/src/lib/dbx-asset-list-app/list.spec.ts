import { describe, expect, it } from 'vitest';
import { formatReportAsJson, formatReportAsMarkdown, listAppAssets } from './index.js';
import type { AppAssetsInspection, InspectedFile } from '../dbx-asset-validate-app/index.js';

const ASSETS_TS = `import { type AssetPathRef, localAsset, remoteAsset, assetFolder } from '@dereekb/rxjs';

const DATA = assetFolder('data');

export const DEMO_LOGO: AssetPathRef = localAsset('logo.svg');
export const DEMO_DISTRICTS: AssetPathRef = DATA.asset('districts.json');
export const DEMO_REMOTE: AssetPathRef = remoteAsset('https://example.com/data.json');

export const DEMO_ASSETS: AssetPathRef[] = [DEMO_LOGO, DEMO_DISTRICTS, DEMO_REMOTE];
`;

const ROOT_CONFIG_TS = `import { provideDbxAssetLoader } from '@dereekb/dbx-core';\nexport const appConfig = { providers: [provideDbxAssetLoader()] };\n`;

function populatedInspection(): AppAssetsInspection {
  const componentFiles: InspectedFile[] = [
    { relPath: 'src/lib/assets.ts', text: ASSETS_TS },
    { relPath: 'src/lib/index.ts', text: `export * from './assets';\n` }
  ];
  return {
    component: { rootDir: 'components/demo-firebase', folder: 'src/lib', status: 'ok', files: componentFiles },
    app: { rootConfigText: ROOT_CONFIG_TS, assetFiles: new Set() },
    appRootDir: 'apps/demo',
    appStatus: 'ok'
  };
}

describe('listAppAssets', () => {
  it('reports each asset with kind / helper / resolved path / source line and exposes the aggregator', () => {
    const report = listAppAssets(populatedInspection(), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo' });
    expect(report.assetsFileExists).toBe(true);
    expect(report.barrelReExportsAssets).toBe(true);
    expect(report.providerWiredInApp).toBe(true);

    expect(report.assets).toHaveLength(3);
    const logo = report.assets.find((a) => a.symbolName === 'DEMO_LOGO');
    const districts = report.assets.find((a) => a.symbolName === 'DEMO_DISTRICTS');
    const remote = report.assets.find((a) => a.symbolName === 'DEMO_REMOTE');
    expect(logo).toBeDefined();
    expect(logo?.sourceType).toBe('local');
    expect(logo?.helper).toBe('localAsset');
    expect(logo?.resolved).toBe('logo.svg');
    expect(districts?.sourceType).toBe('local');
    expect(districts?.helper).toBe('assetFolder.asset');
    expect(districts?.resolved).toBe('data/districts.json');
    expect(remote?.sourceType).toBe('remote');
    expect(remote?.helper).toBe('remoteAsset');
    expect(remote?.resolved).toBe('https://example.com/data.json');

    expect(report.aggregators).toHaveLength(1);
    expect(report.aggregators[0].symbolName).toBe('DEMO_ASSETS');
    expect(report.aggregators[0].memberNames).toEqual(['DEMO_LOGO', 'DEMO_DISTRICTS', 'DEMO_REMOTE']);
  });

  it('renders both markdown and JSON outputs', () => {
    const report = listAppAssets(populatedInspection(), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo' });
    const md = formatReportAsMarkdown(report);
    const json = formatReportAsJson(report);
    expect(md).toContain('# App assets — demo-firebase');
    expect(md).toContain('DEMO_LOGO');
    expect(md).toContain('data/districts.json');
    expect(md).toContain('## Aggregators (1)');
    const parsed = JSON.parse(json) as { readonly assets: readonly { readonly symbolName: string }[] };
    expect(parsed.assets.map((a) => a.symbolName)).toEqual(['DEMO_LOGO', 'DEMO_DISTRICTS', 'DEMO_REMOTE']);
  });
});
