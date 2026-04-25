import { describe, expect, it } from 'vitest';
import { runLookupUi } from './lookup-ui.tool.js';

function firstText(result: ReturnType<typeof runLookupUi>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_ui_lookup', () => {
  it('rejects missing topic via arktype validation', () => {
    const result = runLookupUi({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('resolves a slug to a single full entry with sections', () => {
    const text = firstText(runLookupUi({ topic: 'section' }));
    expect(text).toMatch(/# DbxSectionComponent/);
    expect(text).toMatch(/\*\*slug:\*\* `section`/);
    expect(text).toMatch(/## Inputs/);
    expect(text).toMatch(/## Example/);
  });

  it('brief depth omits inputs/outputs/example sections', () => {
    const text = firstText(runLookupUi({ topic: 'section', depth: 'brief' }));
    expect(text).toMatch(/## DbxSectionComponent/);
    expect(text).not.toMatch(/## Inputs/);
    expect(text).not.toMatch(/## Example/);
  });

  it('resolves a class name (case-insensitive)', () => {
    const text = firstText(runLookupUi({ topic: 'DBXSECTIONCOMPONENT' }));
    expect(text).toMatch(/# DbxSectionComponent/);
  });

  it('resolves an Angular selector (element form)', () => {
    const text = firstText(runLookupUi({ topic: 'dbx-section' }));
    expect(text).toMatch(/# DbxSectionComponent/);
  });

  it('resolves an Angular selector (attribute form)', () => {
    const text = firstText(runLookupUi({ topic: '[dbxContent]' }));
    expect(text).toMatch(/# DbxContentDirective/);
  });

  it('resolves a category name to a group', () => {
    const text = firstText(runLookupUi({ topic: 'layout' }));
    expect(text).toMatch(/# UI components: category = layout/);
    expect(text).toMatch(/## component/);
  });

  it('resolves the "list" alias to the full catalog', () => {
    const text = firstText(runLookupUi({ topic: 'list' }));
    expect(text).toMatch(/# UI catalog/);
    expect(text).toMatch(/## layout/);
    expect(text).toMatch(/## button/);
  });

  it('suggests fuzzy candidates for partial-word queries', () => {
    const text = firstText(runLookupUi({ topic: 'sect' }));
    expect(text).toMatch(/No UI component matched/);
    expect(text).toMatch(/Did you mean/);
    expect(text).toMatch(/section/);
  });

  it('falls through to catalog hint when no substring overlap exists', () => {
    const text = firstText(runLookupUi({ topic: 'zzzz-not-a-thing' }));
    expect(text).toMatch(/No UI component matched/);
    expect(text).toMatch(/browse the catalog/);
  });
});
