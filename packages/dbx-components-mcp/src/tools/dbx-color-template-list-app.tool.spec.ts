import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dbxColorTemplateListAppTool } from './dbx-color-template-list-app.tool.js';

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

describe('dbxColorTemplateListAppTool', () => {
  it('returns markdown report listing inline templates from a real fixture app', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'dbx-color-list-'));
    try {
      const appDir = join(tmp, 'apps', 'demo');
      mkdirSync(join(appDir, 'src'), { recursive: true });
      writeFileSync(join(appDir, 'src', 'root.app.config.ts'), ROOT_CONFIG, 'utf8');
      const originalCwd = process.cwd();
      process.chdir(tmp);
      try {
        const apiDir = relative(tmp, appDir).split(/[\\/]/).join('/');
        const result = await dbxColorTemplateListAppTool.run({ apiDir });
        const text = result.content[0].text;
        expect(text).toContain('# Color templates');
        expect(text).toContain('brand-positive');
        expect(text).toContain('color=`#1f9b59`');
      } finally {
        process.chdir(originalCwd);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('rejects invalid input', async () => {
    const result = await dbxColorTemplateListAppTool.run({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('rejects apiDir that escapes the server cwd', async () => {
    const result = await dbxColorTemplateListAppTool.run({ apiDir: '../escape' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('outside the server cwd');
  });
});
