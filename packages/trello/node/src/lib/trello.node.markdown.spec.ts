import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeMarkdownPreservingBlocks } from './trello.node.markdown';

function render(desc: string, notes = '_(none)_'): string {
  return ['# Card', '', '## Notes', '', '<!-- notes:begin -->', notes, '<!-- notes:end -->', '', '## Description', '', desc, ''].join('\n');
}

describe('writeMarkdownPreservingBlocks()', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'trello-node-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes a missing file, creating its parent directories', async () => {
    const path = join(dir, 'a', 'b', 'card.md');
    const result = await writeMarkdownPreservingBlocks({ path, markdown: render('first') });

    expect(result).toEqual({ path, changed: true, markdown: render('first') });
    expect(readFileSync(path, 'utf8')).toBe(render('first'));
  });

  it('leaves the file untouched when the merged render equals it', async () => {
    const path = join(dir, 'card.md');
    writeFileSync(path, render('same', 'my notes'));
    const before = statSync(path).mtimeMs;

    const result = await writeMarkdownPreservingBlocks({ path, markdown: render('same') });

    expect(result.changed).toBe(false);
    expect(result.markdown).toBe(render('same', 'my notes'));
    expect(statSync(path).mtimeMs).toBe(before);
  });

  it('carries only the named blocks forward from the file on disk', async () => {
    const path = join(dir, 'card.md');
    writeFileSync(path, render('Quoted <!-- quote:begin -->old<!-- quote:end -->', 'my notes'));

    const result = await writeMarkdownPreservingBlocks({ path, markdown: render('Quoted <!-- quote:begin -->new<!-- quote:end -->'), names: ['notes'] });

    expect(result.changed).toBe(true);
    expect(result.markdown).toBe(render('Quoted <!-- quote:begin -->new<!-- quote:end -->', 'my notes'));
    expect(readFileSync(path, 'utf8')).toBe(result.markdown);
  });
});
