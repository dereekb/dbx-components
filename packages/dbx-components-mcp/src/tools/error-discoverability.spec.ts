/**
 * Durable guard for the dbx-web HTTP error converters and error services: runs the real search/lookup tools over the
 * committed manifests so a dropped `@dbxUtil` / `@dbxWebComponent` tag or a missing bundled filename fails CI.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_BUNDLED_FILENAMES, loadUiComponentRegistry, loadUtilRegistry } from '@dereekb/dbx-cli';
import { createSearchUtilTool } from './search-util.tool.js';
import { createLookupUtilTool } from './lookup-util.tool.js';
import { createSearchUiTool } from './search-ui.tool.js';
import { createLookupUiTool } from './lookup-ui.tool.js';

type ToolResult = { isError?: boolean; content: { type: string; text: string }[] };

interface RunnableTool {
  run(args: unknown): unknown;
}

const WORKSPACE_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const GENERATED_DIR = resolve(WORKSPACE_ROOT, 'packages/dbx-cli/generated');
const HIT_SLUG_REGEX = /→ `dbx_(?:util|ui)_lookup topic="([^"]+)"`/g;

function runText(tool: RunnableTool, args: unknown): string {
  const result = tool.run(args) as ToolResult;
  expect(result.isError).toBeFalsy();
  return result.content[0].text;
}

function hitSlugs(text: string): string[] {
  return Array.from(text.matchAll(HIT_SLUG_REGEX), (match) => match[1]);
}

describe('dbx-web error discoverability (committed manifests)', () => {
  let searchUtil: RunnableTool;
  let lookupUtil: RunnableTool;
  let searchUi: RunnableTool;
  let lookupUi: RunnableTool;

  beforeAll(async () => {
    const { registry: utilRegistry } = await loadUtilRegistry({ cwd: WORKSPACE_ROOT, bundledManifestPaths: () => DEFAULT_BUNDLED_FILENAMES.map((name) => resolve(GENERATED_DIR, name)) });
    const { registry: uiRegistry } = await loadUiComponentRegistry({ cwd: WORKSPACE_ROOT, bundledManifestPaths: () => [resolve(GENERATED_DIR, 'dereekb-dbx-web.ui-components.mcp.generated.json')] });

    searchUtil = createSearchUtilTool({ registry: utilRegistry });
    lookupUtil = createLookupUtilTool({ registry: utilRegistry });
    searchUi = createSearchUiTool({ registry: uiRegistry });
    lookupUi = createLookupUiTool({ registry: uiRegistry });
  });

  it('util "server error response" ranks the HTTP converter and operator in the top 5', () => {
    const top5 = hitSlugs(runText(searchUtil, { query: 'server error response' })).slice(0, 5);
    expect(top5).toContain('convert-to-server-error-response');
    expect(top5).toContain('catch-server-error-response');
  });

  it('util "http error readable" finds the HTTP converter and operator', () => {
    const slugs = hitSlugs(runText(searchUtil, { query: 'http error readable' }));
    expect(slugs).toContain('catch-server-error-response');
    expect(slugs).toContain('convert-to-server-error-response');
  });

  it('the Firebase callable converter links to the HTTP converter', () => {
    const text = runText(lookupUtil, { topic: 'convert-https-callable-error-to-readable-error' });
    expect(text).toContain('convert-to-server-error-response');
  });

  it('ui "error widget" ranks error-widget-service in the top 3', () => {
    const top3 = hitSlugs(runText(searchUi, { query: 'error widget' })).slice(0, 3);
    expect(top3).toContain('error-widget-service');
  });

  it('ui "snackbar service" ranks error-snackbar-service in the top 3', () => {
    const top3 = hitSlugs(runText(searchUi, { query: 'snackbar service' })).slice(0, 3);
    expect(top3).toContain('error-snackbar-service');
  });

  it('ui lookup DbxErrorWidgetService resolves to the service entry', () => {
    const text = runText(lookupUi, { topic: 'DbxErrorWidgetService' });
    expect(text).toMatch(/\*\*slug:\*\* `error-widget-service`/);
    expect(text).toMatch(/\*\*kind:\*\* `service`/);
  });
});
