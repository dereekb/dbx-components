import { describe, expect, it } from 'vitest';
import { extractCssUtilityEntries } from './css-utilities-extract.js';

describe('extractCssUtilityEntries', () => {
  it('extracts a single annotated utility class', () => {
    const source = ['@mixin core() {', '  /// @dbx-utility flex-fill-0', '  /// @intent fill remaining flex space and allow children to truncate', '  /// @role flex', '  /// @see-also dbx-flex-fill, dbx-text-truncate', '  .dbx-flex-fill-0 {', '    flex: 1;', '    min-width: 0;', '  }', '}', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'flex.scss', source });
    expect(result.warnings).toEqual([]);
    expect(result.entries.length).toBe(1);
    const entry = result.entries[0];
    expect(entry.slug).toBe('flex-fill-0');
    expect(entry.selector).toBe('.dbx-flex-fill-0');
    expect(entry.role).toBe('flex');
    expect(entry.intent).toBe('fill remaining flex space and allow children to truncate');
    expect(entry.seeAlso).toEqual(['dbx-flex-fill', 'dbx-text-truncate']);
    expect(entry.declarations).toEqual([
      { property: 'flex', value: '1' },
      { property: 'min-width', value: '0' }
    ]);
  });

  it('skips unannotated rules (curation gate)', () => {
    const source = ['@mixin core() {', '  .dbx-pdf-merge-entry-row {', '    display: flex;', '    align-items: center;', '    gap: 8px;', '  }', '}', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'pdf.scss', source });
    expect(result.entries).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('picks the .dbx-* canonical selector from a comma list', () => {
    const source = ['@mixin core() {', '  /// @dbx-utility text-center', '  /// @intent horizontally centered text', '  /// @role text', '  .text-center,', '  .dbx-text-center {', '    text-align: center;', '  }', '}', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'text.scss', source });
    expect(result.warnings).toEqual([]);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].selector).toBe('.dbx-text-center');
    expect(result.entries[0].slug).toBe('text-center');
  });

  it('warns on unknown roles', () => {
    const source = ['/// @dbx-utility nope', '/// @role bogus', '.dbx-nope { display: block; }', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'x.scss', source });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].role).toBeUndefined();
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatchObject({ kind: 'unknown-role', role: 'bogus' });
  });

  it('skips nested rules when collecting declarations', () => {
    const source = ['/// @dbx-utility outer', '.dbx-outer {', '  display: block;', '  .dbx-inner {', '    color: red;', '  }', '  padding: 8px;', '}', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'x.scss', source });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].declarations).toEqual([
      { property: 'display', value: 'block' },
      { property: 'padding', value: '8px' }
    ]);
  });

  it('parses @parent into the entry', () => {
    const source = ['/// @dbx-utility list-two-line-item-icon', '/// @parent dbx-list-two-line-item', '/// @intent leading-icon slot', '/// @role layout', '.dbx-list-two-line-item-icon { padding: 0 16px; }', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'list.scss', source });
    expect(result.warnings).toEqual([]);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].parent).toBe('dbx-list-two-line-item');
  });

  it('strips a leading dot from @parent', () => {
    const source = ['/// @dbx-utility child', '/// @parent .dbx-parent', '.dbx-child { color: red; }', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'x.scss', source });
    expect(result.entries[0].parent).toBe('dbx-parent');
  });

  it('omits parent when no @parent annotation is present', () => {
    const source = ['/// @dbx-utility solo', '.dbx-solo { display: block; }', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'x.scss', source });
    expect(result.entries[0].parent).toBeUndefined();
  });

  it('captures a compound descendant selector with the first class as the host', () => {
    const source = ['/// @dbx-utility list-no-item-padding', '/// @intent zero inner padding on every nav-list row', '/// @role spacing', '.dbx-list-no-item-padding .dbx-list > .dbx-list-content .mat-mdc-list-item-content {', '  padding: 0;', '}', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'list.scss', source });
    expect(result.warnings).toEqual([]);
    expect(result.entries.length).toBe(1);
    const entry = result.entries[0];
    expect(entry.selector).toBe('.dbx-list-no-item-padding');
    expect(entry.slug).toBe('list-no-item-padding');
    expect(entry.selectorContext).toBe('.dbx-list-no-item-padding .dbx-list > .dbx-list-content .mat-mdc-list-item-content');
    expect(entry.declarations).toEqual([{ property: 'padding', value: '0' }]);
  });

  it('omits selectorContext for flat single-class selectors', () => {
    const source = ['/// @dbx-utility solo', '.dbx-solo { display: block; }', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'x.scss', source });
    expect(result.entries[0].selectorContext).toBeUndefined();
  });

  it('parses @component and @scope into the entry', () => {
    const source = ['/// @dbx-utility icon-tile', '/// @intent rounded padded icon container', '/// @role layout', '/// @component DbxIconTileComponent', '/// @scope component-class', '.dbx-icon-tile { padding: 8px; }', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'text.scss', source });
    expect(result.warnings).toEqual([]);
    expect(result.entries.length).toBe(1);
    const entry = result.entries[0];
    expect(entry.component).toBe('DbxIconTileComponent');
    expect(entry.scope).toBe('component-class');
  });

  it('omits component and scope when the annotations are absent', () => {
    const source = ['/// @dbx-utility solo', '.dbx-solo { display: block; }', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'x.scss', source });
    expect(result.entries[0].component).toBeUndefined();
    expect(result.entries[0].scope).toBeUndefined();
  });

  it('warns on unknown @scope values without dropping the entry', () => {
    const source = ['/// @dbx-utility weird', '/// @scope wonky', '.dbx-weird { display: block; }', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'x.scss', source });
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].scope).toBeUndefined();
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatchObject({ kind: 'unknown-scope', scope: 'wonky' });
  });

  it('captures tokensSet from --custom-property declarations', () => {
    const source = [
      '/// @dbx-utility step-block-badge',
      '.dbx-step-block-badge {',
      '  --dbx-icon-tile-padding: 0;',
      '  --dbx-icon-tile-border-radius: 50%;',
      '  --dbx-icon-tile-padding: 0;', // duplicate — should dedupe
      '}',
      ''
    ].join('\n');
    const result = extractCssUtilityEntries({ file: 'text.scss', source });
    const entry = result.entries[0];
    expect(entry.tokensSet).toEqual(['--dbx-icon-tile-border-radius', '--dbx-icon-tile-padding']);
  });

  it('captures tokensRead from var() references in declaration values', () => {
    const source = ['/// @dbx-utility icon-tile', '.dbx-icon-tile {', '  border-radius: var(--dbx-icon-tile-border-radius, 12px);', '  padding: var(--dbx-icon-tile-padding, 8px);', '  width: var(--dbx-icon-tile-width);', '}', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'text.scss', source });
    const entry = result.entries[0];
    expect(entry.tokensRead).toEqual(['--dbx-icon-tile-border-radius', '--dbx-icon-tile-padding', '--dbx-icon-tile-width']);
  });

  it('captures tokensRead from var() references inside nested rules', () => {
    const source = ['/// @dbx-utility icon-tile', '.dbx-icon-tile {', '  padding: var(--dbx-icon-tile-padding, 8px);', '  .mat-icon {', '    font-size: var(--dbx-icon-tile-icon-size, 24px);', '  }', '}', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'text.scss', source });
    const entry = result.entries[0];
    expect(entry.tokensRead).toEqual(['--dbx-icon-tile-icon-size', '--dbx-icon-tile-padding']);
  });

  it('captures tokensRead from nested var() fallbacks', () => {
    const source = ['/// @dbx-utility nested', '.dbx-nested {', '  width: var(--outer, var(--inner, 8px));', '}', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'text.scss', source });
    const entry = result.entries[0];
    expect(entry.tokensRead).toEqual(['--inner', '--outer']);
  });

  it('omits tokensRead/tokensSet when the rule references no custom properties', () => {
    const source = ['/// @dbx-utility solo', '.dbx-solo { display: block; padding: 8px; }', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'x.scss', source });
    const entry = result.entries[0];
    expect(entry.tokensRead).toBeUndefined();
    expect(entry.tokensSet).toBeUndefined();
  });

  it('rejects compound hosts (`.foo.bar …`) as unsupported', () => {
    const source = ['/// @dbx-utility nope', '.dbx-foo.dbx-bar .dbx-baz {', '  color: red;', '}', ''].join('\n');
    const result = extractCssUtilityEntries({ file: 'x.scss', source });
    expect(result.entries).toEqual([]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatchObject({ kind: 'unsupported-selector' });
  });
});
