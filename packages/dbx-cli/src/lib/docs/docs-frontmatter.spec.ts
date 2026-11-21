import { describe, expect, it } from 'vitest';
import { parseDocsFrontmatter, readDocsFrontmatterList } from './docs-frontmatter';

describe('parseDocsFrontmatter()', () => {
  it('should read an empty key as an empty list', () => {
    const result = parseDocsFrontmatter(['---', 'title: Setup', 'tags:', '---', '# Setup'].join('\n'));
    expect(result.values).toEqual({ title: 'Setup', tags: [] });
    expect(result.problems).toEqual([]);
  });

  it('should keep every scalar a string', () => {
    const result = parseDocsFrontmatter(['---', 'tags: 2024', 'draft: true', 'audience: [1, false]', 'list:', '  - 3', '---'].join('\n'));
    expect(result.values).toEqual({ tags: '2024', draft: 'true', audience: ['1', 'false'], list: ['3'] });
  });

  it('should leave out a nested map and report it at its line', () => {
    const result = parseDocsFrontmatter(['---', 'title: Setup', 'meta:', '  owner: admin', 'bad row', '---'].join('\n'));
    expect(result.values).toEqual({ title: 'Setup' });
    expect(result.problems).toEqual([
      { line: 3, message: '"meta" holds nested keys. Use "key: value", "key: [a, b]" or a "- item" list.' },
      { line: 5, message: 'expected `key: value`' }
    ]);
  });

  it('should unescape a double-quoted value and read a single-quoted one', () => {
    const result = parseDocsFrontmatter(['---', String.raw`title: "Say \"hi\""`, "description: 'it''s here'", '---'].join('\n'));
    expect(result.values).toEqual({ title: 'Say "hi"', description: "it's here" });
  });

  it('should drop a key whose inline list is broken and report it', () => {
    const result = parseDocsFrontmatter(['---', 'title: Setup', 'audience: [admin, user', '---'].join('\n'));
    expect(result.values).toEqual({ title: 'Setup' });
    expect(result.problems).toEqual([{ line: 3, message: '`audience`: an unclosed `[` list' }]);
  });

  it('should report problems at 1-based file lines', () => {
    const result = parseDocsFrontmatter(['---', '', '# comment', 'not a row', '---'].join('\n'));
    expect(result.problems.map((problem) => problem.line)).toEqual([4]);
  });

  it('should drop a value comment', () => {
    expect(parseDocsFrontmatter(['---', 'title: Setup # the title', '---'].join('\n')).values).toEqual({ title: 'Setup' });
  });
});

describe('readDocsFrontmatterList()', () => {
  it('should split a scalar on commas and trim list items', () => {
    expect(readDocsFrontmatterList('admin, user,, ')).toEqual(['admin', 'user']);
    expect(readDocsFrontmatterList([' admin ', ''])).toEqual(['admin']);
    expect(readDocsFrontmatterList(undefined)).toBeUndefined();
  });
});
