import { describe, expect, it } from 'vitest';
import { formatReportAsJson, formatReportAsMarkdown, listAppColorTemplates } from './index.js';
import type { ColorTemplateInspection } from './inspect.js';

const ROOT_CONFIG_WITH_INLINE_TEMPLATES = `import { provideDbxStyleService } from '@dereekb/dbx-web';

export const appConfig = {
  providers: [
    provideDbxStyleService({
      dbxStyleConfig: { style: 'demo-app' },
      dbxColorServiceConfig: {
        templates: [
          { key: 'brand-positive', config: { color: '#1f9b59', contrast: 'white', tone: 18 } },
          { key: 'brand-warn', config: { color: '#ff6644', tonal: true } }
        ]
      }
    })
  ]
};
`;

const ROOT_CONFIG_WITH_IDENTIFIER_TEMPLATES = `import { provideDbxStyleService } from '@dereekb/dbx-web';

const APP_COLOR_TEMPLATES = [
  { key: 'brand-positive', config: { color: '#1f9b59', tone: 18 } }
];

export const appConfig = {
  providers: [
    provideDbxStyleService({
      dbxStyleConfig: { style: 'demo-app' },
      dbxColorServiceConfig: { templates: APP_COLOR_TEMPLATES }
    })
  ]
};
`;

const ROOT_CONFIG_NO_COLOR_BLOCK = `import { provideDbxStyleService } from '@dereekb/dbx-web';

export const appConfig = {
  providers: [
    provideDbxStyleService({ dbxStyleConfig: { style: 'demo-app' } })
  ]
};
`;

const ROOT_CONFIG_CROSS_FILE_REF = `import { provideDbxStyleService } from '@dereekb/dbx-web';
import { APP_COLOR_TEMPLATES } from './app.color.templates';

export const appConfig = {
  providers: [
    provideDbxStyleService({
      dbxStyleConfig: { style: 'demo-app' },
      dbxColorServiceConfig: { templates: APP_COLOR_TEMPLATES }
    })
  ]
};
`;

function inspectionWith(rootText: string): ColorTemplateInspection {
  return {
    apiDir: 'apps/demo',
    appExists: true,
    files: [{ relPath: 'src/root.app.config.ts', text: rootText }]
  };
}

describe('listAppColorTemplates', () => {
  it('extracts inline templates with key, config, and source line', () => {
    const report = listAppColorTemplates(inspectionWith(ROOT_CONFIG_WITH_INLINE_TEMPLATES));
    expect(report.templates).toHaveLength(2);
    expect(report.templates[0].key).toBe('brand-positive');
    expect(report.templates[0].config).toEqual({ color: '#1f9b59', contrast: 'white', tone: 18 });
    expect(report.templates[0].sourceFile).toContain('src/root.app.config.ts');
    expect(report.templates[0].sourceLine).toBeGreaterThan(0);
    expect(report.templates[1].key).toBe('brand-warn');
    expect(report.templates[1].config).toEqual({ color: '#ff6644', tonal: true });
    expect(report.warnings).toHaveLength(0);
    expect(report.provideCallLocation?.line).toBeGreaterThan(0);
  });

  it('resolves same-file identifier references', () => {
    const report = listAppColorTemplates(inspectionWith(ROOT_CONFIG_WITH_IDENTIFIER_TEMPLATES));
    expect(report.templates).toHaveLength(1);
    expect(report.templates[0].key).toBe('brand-positive');
    expect(report.warnings).toHaveLength(0);
  });

  it('emits a warning for cross-file identifier references', () => {
    const report = listAppColorTemplates(inspectionWith(ROOT_CONFIG_CROSS_FILE_REF));
    expect(report.templates).toHaveLength(0);
    expect(report.warnings).toHaveLength(1);
    expect(report.warnings[0].message).toContain('APP_COLOR_TEMPLATES');
  });

  it('reports zero templates without warning when dbxColorServiceConfig is absent', () => {
    const report = listAppColorTemplates(inspectionWith(ROOT_CONFIG_NO_COLOR_BLOCK));
    expect(report.templates).toHaveLength(0);
    expect(report.warnings).toHaveLength(0);
    expect(report.provideCallLocation).toBeDefined();
  });

  it('renders both markdown and JSON outputs', () => {
    const report = listAppColorTemplates(inspectionWith(ROOT_CONFIG_WITH_INLINE_TEMPLATES));
    const md = formatReportAsMarkdown(report);
    expect(md).toContain('# Color templates — apps/demo');
    expect(md).toContain('`brand-positive`');
    expect(md).toContain('color=`#1f9b59`');
    const parsed = JSON.parse(formatReportAsJson(report)) as { readonly templates: readonly { readonly key: string }[] };
    expect(parsed.templates.map((t) => t.key)).toEqual(['brand-positive', 'brand-warn']);
  });
});
