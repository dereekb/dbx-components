import { describe, expect, it } from 'vitest';
import type { SystemFolderInspection } from '../system-m-validate-folder/types.js';
import { collectAppSystem, formatReportAsJson, formatReportAsMarkdown } from './index.js';

const COMPLETE_SOURCE = `import { type SystemStateStoredData, type SystemStateStoredDataConverterMap, type SystemStateStoredDataFieldConverterConfig, type SystemStateType } from '@dereekb/firebase';

export const DEMO_FOO_SYSTEM_STATE_TYPE: SystemStateType = 'DEMO_FOO';
export interface DemoFooSystemData extends SystemStateStoredData {
  readonly count: number;
}
export const demoFooSystemDataConverter: SystemStateStoredDataFieldConverterConfig<DemoFooSystemData> = { count: { fromDoc: (x) => x, toDoc: (x) => x } };

export const DEMO_BAR_SYSTEM_STATE_TYPE: SystemStateType = 'DEMO_BAR';
export interface DemoBarSystemData extends SystemStateStoredData {
  readonly name: string;
}
export const demoBarSystemDataConverter: SystemStateStoredDataFieldConverterConfig<DemoBarSystemData> = { name: { fromDoc: (x) => x, toDoc: (x) => x } };

export const demoSystemStateStoredDataConverterMap: SystemStateStoredDataConverterMap = {
  [DEMO_FOO_SYSTEM_STATE_TYPE]: demoFooSystemDataConverter,
  [DEMO_BAR_SYSTEM_STATE_TYPE]: demoBarSystemDataConverter
};
`;

const INSPECTION_OK: SystemFolderInspection = {
  name: 'system',
  path: '/abs/components/demo-firebase/src/lib/model/system',
  status: 'ok',
  files: ['system.ts', 'index.ts'],
  systemSource: COMPLETE_SOURCE
};

const INSPECTION_MISSING: SystemFolderInspection = {
  name: 'system',
  path: '/abs/components/demo-firebase/src/lib/model/system',
  status: 'not-found',
  files: [],
  systemSource: undefined
};

describe('dbx_system_m_list_app: collect', () => {
  it('pairs every state with its data interface, converter, and map membership', () => {
    const report = collectAppSystem(INSPECTION_OK, { componentDir: 'components/demo-firebase' });
    expect(report.status).toBe('ok');
    expect(report.hasSystemSource).toBe(true);
    expect(report.converterMapName).toBe('demoSystemStateStoredDataConverterMap');
    expect(report.pairings).toHaveLength(2);
    for (const pairing of report.pairings) {
      expect(pairing.dataInterface).toBeDefined();
      expect(pairing.converter).toBeDefined();
      expect(pairing.inConverterMap).toBe(true);
      expect(pairing.complete).toBe(true);
    }
  });

  it('reports a degraded report when the folder is missing', () => {
    const report = collectAppSystem(INSPECTION_MISSING, { componentDir: 'components/demo-firebase' });
    expect(report.status).toBe('not-found');
    expect(report.hasSystemSource).toBe(false);
    expect(report.pairings).toHaveLength(0);
  });

  it('flags incomplete pairings when the data interface is missing', () => {
    const partialSource = COMPLETE_SOURCE.replace('export interface DemoBarSystemData extends SystemStateStoredData {\n  readonly name: string;\n}\n', '');
    const inspection: SystemFolderInspection = { ...INSPECTION_OK, systemSource: partialSource };
    const report = collectAppSystem(inspection, { componentDir: 'components/demo-firebase' });
    const bar = report.pairings.find((p) => p.typeConstant.name === 'DEMO_BAR_SYSTEM_STATE_TYPE');
    expect(bar?.dataInterface).toBeUndefined();
    expect(bar?.complete).toBe(false);
  });
});

describe('dbx_system_m_list_app: format', () => {
  it('renders a markdown table with the converter map summary', () => {
    const report = collectAppSystem(INSPECTION_OK, { componentDir: 'components/demo-firebase' });
    const markdown = formatReportAsMarkdown(report);
    expect(markdown).toContain('# System state listing');
    expect(markdown).toContain('Converter map: `demoSystemStateStoredDataConverterMap`');
    expect(markdown).toContain('| `DEMO_FOO_SYSTEM_STATE_TYPE`');
    expect(markdown).toContain('State types: 2 declared · 2 fully wired');
  });

  it('renders the missing-folder case as an explanatory line', () => {
    const report = collectAppSystem(INSPECTION_MISSING, { componentDir: 'components/demo-firebase' });
    const markdown = formatReportAsMarkdown(report);
    expect(markdown).toContain('folder not found');
    expect(markdown).toContain('No state types listed');
  });

  it('renders the report as JSON when requested', () => {
    const report = collectAppSystem(INSPECTION_OK, { componentDir: 'components/demo-firebase' });
    const parsed = JSON.parse(formatReportAsJson(report));
    expect(parsed.componentDir).toBe('components/demo-firebase');
    expect(parsed.pairings).toHaveLength(2);
  });
});
