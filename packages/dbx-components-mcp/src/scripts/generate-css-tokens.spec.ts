import { describe, expect, it } from 'vitest';
import { componentScopeForFile, findDbxVarUses, parseComponentTokensInScss } from '../../scripts/generate-css-tokens.mjs';

describe('findDbxVarUses', () => {
  it('captures a simple fallback', () => {
    const uses = findDbxVarUses('width: var(--dbx-sidenav-width, 240px);');
    expect(uses).toEqual([{ cssVar: '--dbx-sidenav-width', fallback: '240px' }]);
  });

  it('captures a nested var() fallback chain with balanced parens', () => {
    const uses = findDbxVarUses('border-radius: var(--dbx-section-container-shape, var(--mat-sys-corner-medium, 12px));');
    expect(uses[0]).toEqual({ cssVar: '--dbx-section-container-shape', fallback: 'var(--mat-sys-corner-medium, 12px)' });
  });

  it('records nested --dbx- tokens inside fallbacks as their own uses', () => {
    const uses = findDbxVarUses('height: var(--dbx-icon-tile-height, var(--dbx-step-block-badge-size, 32px));');
    expect(uses.map((u) => u.cssVar)).toEqual(['--dbx-icon-tile-height', '--dbx-step-block-badge-size']);
    expect(uses[1].fallback).toBe('32px');
  });

  it('records a use with no fallback', () => {
    const uses = findDbxVarUses('color: var(--dbx-sidenav-text-color);');
    expect(uses).toEqual([{ cssVar: '--dbx-sidenav-text-color', fallback: undefined }]);
  });

  it('ignores non-dbx tokens', () => {
    expect(findDbxVarUses('color: var(--mat-sys-primary);')).toEqual([]);
  });
});

describe('parseComponentTokensInScss', () => {
  it('separates declarations from pure override-point consumptions', () => {
    const scss = ['.dbx-thing {', '  --dbx-thing-gap: 8px;', '  width: var(--dbx-thing-width, 100px);', '}'].join('\n');
    const { declarations, consumptions } = parseComponentTokensInScss(scss);
    expect(declarations.get('--dbx-thing-gap')).toEqual({ value: '8px', doc: undefined });
    expect(consumptions.get('--dbx-thing-width')).toEqual({ fallback: '100px' });
  });

  it('attaches a sassdoc block immediately above a declaration', () => {
    const scss = ['.dbx-thing {', '  /// Gap between thing items.', '  /// @role spacing', '  --dbx-thing-gap: 8px;', '}'].join('\n');
    const { declarations } = parseComponentTokensInScss(scss);
    const decl = declarations.get('--dbx-thing-gap');
    expect(decl?.doc?.description).toBe('Gap between thing items.');
    expect(decl?.doc?.role).toBe('spacing');
  });

  it('prefers the first consumption that carries a fallback', () => {
    const scss = ['a { width: var(--dbx-thing-width); }', 'b { width: var(--dbx-thing-width, 50px); }'].join('\n');
    const { consumptions } = parseComponentTokensInScss(scss);
    expect(consumptions.get('--dbx-thing-width')).toEqual({ fallback: '50px' });
  });
});

describe('componentScopeForFile', () => {
  it('strips the partial underscore and extension', () => {
    expect(componentScopeForFile('/x/layout/section/_section.scss')).toBe('section');
  });

  it('strips a trailing .component suffix', () => {
    expect(componentScopeForFile('/x/button/progress/bar.button.component.scss')).toBe('bar.button');
  });
});
