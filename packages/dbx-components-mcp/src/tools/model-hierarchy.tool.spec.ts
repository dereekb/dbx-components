import { describe, expect, it } from 'vitest';
import { runModelHierarchy } from './model-hierarchy.tool.js';

function textOf(result: { readonly content: readonly { readonly type: 'text'; readonly text: string }[]; readonly isError?: boolean }): string {
  expect(result.content).toHaveLength(1);
  return result.content[0].text;
}

describe('runModelHierarchy', () => {
  it('renders the upstream forest in markdown by default', async () => {
    const result = await runModelHierarchy({ scope: 'upstream' });
    expect(result.isError).toBeUndefined();
    const text = textOf(result);
    expect(text).toContain('# Firebase model hierarchy');
    expect(text).toContain('## Tree');
    expect(text).toContain('**NotificationBox**');
    expect(text).toContain('**Notification**');
    expect(text).toContain('**NotificationWeek**');
    expect(text).toContain('**StorageFile**');
  });

  it('returns valid JSON when output=json', async () => {
    const result = await runModelHierarchy({ scope: 'upstream', output: 'json', format: 'both' });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.summary.rootCount).toBeGreaterThan(0);
    expect(Array.isArray(parsed.tree)).toBe(true);
    expect(Array.isArray(parsed.flat)).toBe(true);
    const nb = parsed.tree.find((n: { name: string }) => n.name === 'NotificationBox');
    expect(nb).toBeDefined();
    expect(nb.children.map((c: { name: string }) => c.name).sort()).toEqual(['Notification', 'NotificationWeek']);
  });

  it('returns just the requested subtree when rootModel is supplied', async () => {
    const result = await runModelHierarchy({ scope: 'upstream', rootModel: 'NotificationBox', output: 'json', format: 'tree' });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.summary.rootCount).toBe(1);
    expect(parsed.tree).toHaveLength(1);
    expect(parsed.tree[0].name).toBe('NotificationBox');
    expect(parsed.tree[0].children.map((c: { name: string }) => c.name).sort()).toEqual(['Notification', 'NotificationWeek']);
  });

  it('resolves rootModel by collection prefix', async () => {
    const result = await runModelHierarchy({ scope: 'upstream', rootModel: 'nb', output: 'json' });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.tree[0].name).toBe('NotificationBox');
  });

  it('resolves rootModel by identity const', async () => {
    const result = await runModelHierarchy({ scope: 'upstream', rootModel: 'notificationBoxIdentity', output: 'json' });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.tree[0].name).toBe('NotificationBox');
  });

  it('clamps with maxDepth=0 and reports truncation', async () => {
    const result = await runModelHierarchy({ scope: 'upstream', rootModel: 'NotificationBox', maxDepth: 0, output: 'json' });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.tree[0].children).toEqual([]);
    expect(parsed.summary.truncatedAtDepth).toBe(0);
  });

  it("returns flat-only entries when format='flat'", async () => {
    const result = await runModelHierarchy({ scope: 'upstream', rootModel: 'NotificationBox', format: 'flat', output: 'json' });
    const parsed = JSON.parse(textOf(result));
    expect(parsed.tree).toBeUndefined();
    expect(parsed.flat).toHaveLength(3);
    expect(parsed.flat[0]).toMatchObject({ name: 'NotificationBox', depth: 0 });
    const child = parsed.flat.find((e: { name: string }) => e.name === 'Notification');
    expect(child).toMatchObject({ depth: 1, parent: 'notificationBoxIdentity' });
  });

  it('returns toolError with fuzzy candidates when rootModel is unknown', async () => {
    const result = await runModelHierarchy({ scope: 'upstream', rootModel: 'NotARealModel' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No Firebase model matched');
  });

  it('rejects componentDirs entries that escape the cwd', async () => {
    const result = await runModelHierarchy({ scope: 'all', componentDirs: ['../escape'] });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/resolves outside the server cwd/);
  });

  it('rejects negative maxDepth via arktype validation', async () => {
    const result = await runModelHierarchy({ scope: 'upstream', maxDepth: -1 });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/Invalid arguments/);
  });
});
