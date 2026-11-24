import { describe, expect, it } from 'vitest';
import { parseMarkdownFrontmatter, splitMarkdownFrontmatter } from './frontmatter';

/**
 * A markdown text from frontmatter lines and a body.
 *
 * @param frontmatter - The frontmatter lines.
 * @param body - The body.
 * @returns The text.
 */
function frontmatterText(frontmatter: ReadonlyArray<string>, body = 'Name what shows.'): string {
  return ['---', ...frontmatter, '---', body, ''].join('\n');
}

/**
 * The `line N: message` problems of a parse.
 *
 * @param text - The text.
 * @returns The problems.
 */
function problemsOf(text: string): ReadonlyArray<string> {
  return parseMarkdownFrontmatter(text).problems.map((problem) => `line ${problem.line}: ${problem.message}`);
}

const VALID = ['id: apparel-plain', 'title: Plain apparel pages', 'sites: [product-page, release-notes]'];

describe('splitMarkdownFrontmatter()', () => {
  it('should split a closed block from its body', () => {
    expect(splitMarkdownFrontmatter('---\ntitle: Setup\n---\n# Setup\n')).toEqual({ hasFrontmatter: true, unclosed: false, frontmatterLines: ['title: Setup'], body: '# Setup\n' });
  });

  it('should leave the whole text as the body when the block is never closed', () => {
    expect(splitMarkdownFrontmatter('---\ntitle: Setup\n')).toEqual({ hasFrontmatter: false, unclosed: true, frontmatterLines: [], body: '---\ntitle: Setup\n' });
  });

  it('should leave the whole text as the body when there is no opening fence', () => {
    expect(splitMarkdownFrontmatter('# Setup\n---\n')).toEqual({ hasFrontmatter: false, unclosed: false, frontmatterLines: [], body: '# Setup\n---\n' });
  });

  it('should return an empty body for a frontmatter-only text with no trailing newline', () => {
    expect(splitMarkdownFrontmatter('---\ntitle: Setup\n---').body).toBe('');
  });

  it('should accept indented fence lines', () => {
    expect(splitMarkdownFrontmatter('  ---  \ntitle: Setup\n --- \nbody').frontmatterLines).toEqual(['title: Setup']);
  });

  it('should drop a BOM and normalize CRLF and a lone CR, in the body too', () => {
    expect(splitMarkdownFrontmatter(`${String.fromCodePoint(0xfeff)}---\r\ntitle: Setup\r---\r\na\rb\r\n`)).toEqual({ hasFrontmatter: true, unclosed: false, frontmatterLines: ['title: Setup'], body: 'a\nb\n' });
    expect(splitMarkdownFrontmatter(`${String.fromCodePoint(0xfeff)}# Setup`).body).toBe('# Setup');
  });
});

describe('parseMarkdownFrontmatter()', () => {
  it('should read the full format: comments, a JSON-quoted value, flow lists and a nested map', () => {
    const parsed = parseMarkdownFrontmatter(
      frontmatterText([
        'id: apparel-plain            # the id',
        'title: Plain apparel pages',
        'sites: [product-page, "support-reply"]   # two sites',
        '# a whole-line comment',
        'where:',
        '  category: [apparel]',
        '  bundle: true',
        'ask: "`brief` describes a garment with no logo. # not a comment"   # optional',
        'unserved: include',
        'priority: 3',
        'floor: -0.5'
      ])
    );

    expect(parsed.problems).toEqual([]);
    expect(parsed.hasFrontmatter).toBe(true);
    expect(parsed.unclosed).toBe(false);
    expect(parsed.values).toEqual({
      id: 'apparel-plain',
      title: 'Plain apparel pages',
      sites: ['product-page', 'support-reply'],
      where: { category: ['apparel'], bundle: true },
      ask: '`brief` describes a garment with no logo. # not a comment',
      unserved: 'include',
      priority: 3,
      floor: -0.5
    });
    expect(Object.fromEntries(parsed.lines)).toEqual({ id: 2, title: 3, sites: 4, where: 6, 'where.category': 7, 'where.bundle': 8, ask: 9, unserved: 10, priority: 11, floor: 12 });
    expect(parsed.body).toBe('Name what shows.\n');
  });

  it('should keep null, ~ and exponent numbers as strings', () => {
    expect(parseMarkdownFrontmatter(frontmatterText(['a: null', 'b: ~', 'c: 1e5', 'd: yes', 'e: "true"'])).values).toEqual({ a: 'null', b: '~', c: '1e5', d: 'yes', e: 'true' });
  });

  it('should read every scalar as a string when typedScalars is false', () => {
    const parsed = parseMarkdownFrontmatter(frontmatterText(['tags: 2024', 'on: true', 'list: [1, false]', 'block:', '  - 3']), { typedScalars: false });
    expect(parsed.values).toEqual({ tags: '2024', on: 'true', list: ['1', 'false'], block: ['3'] });
  });

  it('should return the raw body after a BOM and CRLF', () => {
    const text = `${String.fromCodePoint(0xfeff)}${['---', ...VALID, '---', '', '', '  Line one.', 'Line two.', '', ''].join('\r\n')}`;
    const parsed = parseMarkdownFrontmatter(text);
    expect(parsed.values['id']).toBe('apparel-plain');
    expect(parsed.body).toBe('\n\n  Line one.\nLine two.\n\n');
  });

  it('should report nothing for a text with no opening fence', () => {
    expect(parseMarkdownFrontmatter('id: x\n')).toEqual({ hasFrontmatter: false, unclosed: false, body: 'id: x\n', values: {}, lines: new Map(), problems: [] });
  });

  it('should report an unclosed block at line 1 and keep the whole text as the body', () => {
    const parsed = parseMarkdownFrontmatter('---\nid: abc\n');
    expect(parsed.hasFrontmatter).toBe(false);
    expect(parsed.unclosed).toBe(true);
    expect(parsed.values).toEqual({});
    expect(parsed.body).toBe('---\nid: abc\n');
    expect(problemsOf('---\nid: abc\n')).toEqual(['line 1: the frontmatter is never closed with a `---` line']);
  });

  it('should refuse a malformed row at its line', () => {
    expect(problemsOf(frontmatterText([...VALID, 'not a row']))).toEqual(['line 5: expected `key: value`']);
    expect(problemsOf(frontmatterText([...VALID, '- a']))).toEqual(['line 5: expected `key: value`']);
    expect(problemsOf(frontmatterText([...VALID, '\tpriority: 2']))).toEqual(['line 5: indent with spaces, not tabs']);
    expect(problemsOf(frontmatterText([...VALID, '  category: [shoes]']))).toEqual(['line 5: `category` is indented, but no key above it opens a map']);
    expect(problemsOf(frontmatterText([...VALID, '  - shoes']))).toEqual(['line 5: a `- item` row is indented, but no key above it opens a list']);
    expect(problemsOf(frontmatterText([...VALID, 'where:', '  category:']))).toEqual(['line 6: `where.category` has no value (only one level of nesting)']);
    expect(problemsOf(frontmatterText([...VALID, 'title: again']))).toEqual(['line 5: `title` is set twice']);
    expect(problemsOf(frontmatterText([...VALID, 'where:', '  category: shoes', '  category: shoes']))).toEqual(['line 7: `where.category` is set twice']);
  });

  it('should keep the first value of a duplicate key and leave a refused row out', () => {
    const parsed = parseMarkdownFrontmatter(frontmatterText(['title: first', 'title: second', 'ask: "open']));
    expect(parsed.values).toEqual({ title: 'first' });
    expect(parsed.lines.get('title')).toBe(2);
    expect(parsed.lines.has('ask')).toBe(false);
  });

  it('should refuse a malformed value at its line', () => {
    expect(problemsOf(frontmatterText([...VALID, 'ask: "`brief` unterminated']))).toEqual(['line 5: `ask`: an unterminated quoted string']);
    expect(problemsOf(frontmatterText([...VALID, String.raw`ask: "bad \q escape"`]))).toEqual(['line 5: `ask`: a quoted string that is not valid JSON']);
    expect(problemsOf(frontmatterText([...VALID, 'where:', '  category: [shoes']))).toEqual(['line 6: `where.category`: an unclosed `[` list']);
    expect(problemsOf(frontmatterText([...VALID, 'where:', '  category: [shoes, ]']))).toEqual(['line 6: `where.category`: an empty list item']);
    expect(problemsOf(frontmatterText([...VALID, 'where:', '  category: [shoes boots']))).toEqual(['line 6: `where.category`: an unclosed `[` list']);
    expect(problemsOf(frontmatterText([...VALID, 'where:', '  category: ["shoes" boots]']))).toEqual(['line 6: `where.category`: a list item followed by something other than `,` or `]`']);
    expect(problemsOf(frontmatterText([...VALID, 'ask: "`brief`" trailing']))).toEqual(['line 5: `ask`: unexpected text after the value (quote a value that holds `"` or `[`)']);
    expect(problemsOf(frontmatterText([...VALID, 'tags: [a] b']))).toEqual(['line 5: `tags`: unexpected text after the value (quote a value that holds `"` or `[`)']);
  });

  it('should read an empty flow list', () => {
    expect(parseMarkdownFrontmatter(frontmatterText(['tags: []', 'where:', '  category: [ ]'])).values).toEqual({ tags: [], where: { category: [] } });
  });

  describe('block lists', () => {
    it('should read typed, quoted and commented items', () => {
      const parsed = parseMarkdownFrontmatter(frontmatterText(['sites:', '  - product-page   # first', '  - "support-reply"', "  - 'release notes'", '  - 3', '  - true', 'title: t']));
      expect(parsed.problems).toEqual([]);
      expect(parsed.values).toEqual({ sites: ['product-page', 'support-reply', 'release notes', 3, true], title: 't' });
      expect(parsed.lines.get('sites')).toBe(2);
    });

    it('should refuse an empty item and a flow list item', () => {
      expect(problemsOf(frontmatterText(['sites:', '  -', '  - # just a comment']))).toEqual(['line 3: `sites`: an empty list item', 'line 4: `sites`: an empty list item']);
      expect(problemsOf(frontmatterText(['sites:', '  - [a]']))).toEqual(['line 3: `sites`: a `- item` holds a `[` list (list items are scalars)']);
      expect(parseMarkdownFrontmatter(frontmatterText(['sites:', '  - [a]', '  - b'])).values).toEqual({ sites: ['b'] });
    });

    it('should refuse a block that mixes list and map rows', () => {
      expect(problemsOf(frontmatterText(['sites:', '  - a', '  b: c']))).toEqual(['line 4: `sites` mixes `- item` rows and `key: value` rows']);
      expect(problemsOf(frontmatterText(['where:', '  b: c', '  - a']))).toEqual(['line 4: `where` mixes `- item` rows and `key: value` rows']);
      expect(parseMarkdownFrontmatter(frontmatterText(['where:', '  b: c', '  - a'])).values).toEqual({ where: { b: 'c' } });
    });
  });

  describe('single quotes', () => {
    it("should unquote a single-quoted value, reading '' as '", () => {
      expect(parseMarkdownFrontmatter(frontmatterText(["title: 'it''s plain'   # c", "empty: ''", "hash: 'a # b'", "nums: '12'"])).values).toEqual({ title: "it's plain", empty: '', hash: 'a # b', nums: '12' });
    });

    it('should read single-quoted flow list items', () => {
      expect(parseMarkdownFrontmatter(frontmatterText(["tags: ['a, b', 'it''s', c]"])).values).toEqual({ tags: ['a, b', "it's", 'c'] });
    });

    it('should refuse an unterminated single quote and text after the closing quote', () => {
      expect(problemsOf(frontmatterText(["title: 'open"]))).toEqual(['line 2: `title`: an unterminated quoted string']);
      expect(problemsOf(frontmatterText(["tags: ['open]"]))).toEqual(['line 2: `tags`: an unterminated quoted string']);
      expect(problemsOf(frontmatterText(["ask: 'brief' asks for more"]))).toEqual(['line 2: `ask`: unexpected text after the value (quote a value that holds `"` or `[`)']);
    });
  });

  it('should accept space before the colon', () => {
    expect(parseMarkdownFrontmatter(frontmatterText(['title : Setup', 'where :', '  a  : 1'])).values).toEqual({ title: 'Setup', where: { a: 1 } });
  });

  it('should read a bare key with nothing below it as null', () => {
    const parsed = parseMarkdownFrontmatter(frontmatterText(['tags:', 'where: # a comment', 'title: t']));
    expect(parsed.values).toEqual({ tags: null, where: null, title: 't' });
    expect(parsed.lines.get('tags')).toBe(2);
  });

  it('should keep an un-typed bar as a string', () => {
    expect(parseMarkdownFrontmatter(frontmatterText(['body: |', 'fold: >'])).values).toEqual({ body: '|', fold: '>' });
  });

  it('should read rows split by a lone CR with the right lines', () => {
    const parsed = parseMarkdownFrontmatter('---\rtitle: t\rbad row\r---\rbody');
    expect(parsed.values).toEqual({ title: 't' });
    expect(parsed.problems).toEqual([{ line: 3, message: 'expected `key: value`' }]);
    expect(parsed.body).toBe('body');
  });
});
