import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DBX_COLOR_SMELL_CHECK_TOOL } from './dbx-color-smell-check.tool.js';

const TS_FIXTURE = `import type { DbxColorConfig } from '@dereekb/dbx-web';

export const A: DbxColorConfig = { color: '#1F9B59', contrast: 'white', tone: 18 };
export const B: DbxColorConfig = { color: '#1f9b59', contrast: 'white', tone: 18 };
`;

const HTML_FIXTURE = `<div [dbxColor]="{ color: '#1f9b59', contrast: 'white', tone: 18 }">x</div>
<div [dbxColor]="{ color: '#FFF', tone: 50 }">y</div>
`;

const ROOT_CONFIG = `import { provideDbxStyleService } from '@dereekb/dbx-web';

export const appConfig = {
  providers: [
    provideDbxStyleService({
      dbxStyleConfig: { style: 'demo-app' },
      dbxColorServiceConfig: {
        templates: [
          { key: 'brand-positive', config: { color: '#1f9b59', contrast: 'white', tone: 18 } }
        ]
      }
    })
  ]
};
`;

describe('dbxColorSmellCheckTool', () => {
  it('reports duplicate groups and cross-references existing templates from an apiDir', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dbx-color-smell-'));
    try {
      const appDir = join(tmp, 'apps', 'demo');
      const featureDir = join(appDir, 'src', 'feature');
      mkdirSync(featureDir, { recursive: true });
      writeFileSync(join(featureDir, 'thing.ts'), TS_FIXTURE, 'utf8');
      writeFileSync(join(featureDir, 'thing.html'), HTML_FIXTURE, 'utf8');
      writeFileSync(join(appDir, 'src', 'root.app.config.ts'), ROOT_CONFIG, 'utf8');
      const originalCwd = process.cwd();
      process.chdir(tmp);
      try {
        const apiDir = relative(tmp, appDir).split(/[\\/]/).join('/');
        const tsPath = relative(tmp, join(featureDir, 'thing.ts')).split(/[\\/]/).join('/');
        const htmlPath = relative(tmp, join(featureDir, 'thing.html')).split(/[\\/]/).join('/');
        const result = await DBX_COLOR_SMELL_CHECK_TOOL.run({ paths: [tsPath, htmlPath], apiDir });
        const text = result.content[0].text;
        expect(text).toContain('# Color smell check');
        expect(text).toContain('brand-positive');
        expect(text).toContain('Findings (1)');
      } finally {
        process.chdir(originalCwd);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('rejects missing inputs', async () => {
    const result = await DBX_COLOR_SMELL_CHECK_TOOL.run({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Must provide at least one of');
  });
});
