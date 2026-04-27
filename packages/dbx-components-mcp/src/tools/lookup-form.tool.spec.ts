import { describe, expect, it } from 'vitest';
import { FORM_FIELDS, type FormFieldInfo } from '../registry/index.js';
import { createForgeFieldRegistryFromEntries } from '../registry/forge-fields.js';
import { createLookupFormTool } from './lookup-form.tool.js';
import { resolveTopicAlias } from './form-alias-resolver.js';

const tool = createLookupFormTool({
  registry: createForgeFieldRegistryFromEntries({ entries: FORM_FIELDS, loadedSources: ['@dereekb/dbx-form'] })
});

const DERIVATIVE_FIXTURE: FormFieldInfo = {
  slug: 'fixture-derivative',
  factoryName: 'dbxForgeFixtureDerivative',
  tier: 'field-derivative',
  produces: 'string',
  arrayOutput: 'no',
  configInterface: 'DbxForgeFixtureDerivativeConfig',
  derivedFromSlug: 'text',
  description: 'Test derivative wrapping the text field with presets baked in.',
  sourcePath: 'fixtures/fixture-derivative.ts',
  config: {},
  example: `dbxForgeFixtureDerivative({ key: 'fixture' })`,
  minimalExample: `dbxForgeFixtureDerivative({ key: 'fixture' })`
};

const TEMPLATE_FIXTURE: FormFieldInfo = {
  slug: 'fixture-template',
  factoryName: 'dbxForgeFixtureTemplate',
  tier: 'template-builder',
  produces: 'FieldDef[]',
  arrayOutput: 'no',
  configInterface: 'DbxForgeFixtureTemplateConfig',
  returnsSlugs: ['fixture-a', 'fixture-b'],
  description: 'Test template returning two related fields.',
  sourcePath: 'fixtures/fixture-template.ts',
  config: {},
  example: `dbxForgeFixtureTemplate({})`,
  minimalExample: `dbxForgeFixtureTemplate({})`
};

const tieredTool = createLookupFormTool({
  registry: createForgeFieldRegistryFromEntries({ entries: [...FORM_FIELDS, DERIVATIVE_FIXTURE, TEMPLATE_FIXTURE], loadedSources: ['@dereekb/dbx-form', 'fixtures'] })
});

function firstText(result: ReturnType<typeof tool.run>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_form_lookup', () => {
  it('rejects missing topic via arktype validation', () => {
    const result = tool.run({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('resolves a canonical slug to a single full entry', () => {
    const text = firstText(tool.run({ topic: 'text' }));
    expect(text).toMatch(/# dbxForgeTextField/);
    expect(text).toMatch(/\*\*slug:\*\* `text`/);
    expect(text).toMatch(/## Factory/);
    expect(text).toMatch(/## Config/);
    expect(text).toMatch(/## Example/);
  });

  it('brief depth omits factory/config/example sections and returns just the summary', () => {
    const text = firstText(tool.run({ topic: 'text', depth: 'brief' }));
    expect(text).toMatch(/## dbxForgeTextField/);
    expect(text).not.toMatch(/## Factory/);
    expect(text).not.toMatch(/## Config/);
    expect(text).not.toMatch(/## Example/);
  });

  it('resolves factory names (case-insensitive)', () => {
    const text = firstText(tool.run({ topic: 'DBXFORGETEXTFIELD' }));
    expect(text).toMatch(/# dbxForgeTextField/);
  });

  it('resolves aliases', () => {
    expect(resolveTopicAlias('datepicker')).toBe('date');
    expect(resolveTopicAlias('chips')).toBe('pickable-chip');
    const text = firstText(tool.run({ topic: 'datepicker' }));
    expect(text).toMatch(/# dbxForgeDateField/);
  });

  it('resolves a produces value to a grouped list spanning tiers', () => {
    const text = firstText(tool.run({ topic: 'RowField' }));
    expect(text).toMatch(/# Form entries producing `RowField`/);
    expect(text).toMatch(/## composite-builder/);
    expect(text).toMatch(/## primitive/);
  });

  it('resolves a tier name to a full-tier list', () => {
    const text = firstText(tool.run({ topic: 'primitive' }));
    expect(text).toMatch(/# Form entries: tier = primitive/);
    expect(text).toMatch(/dbxForgeRow/);
    expect(text).toMatch(/dbxForgeGroup/);
  });

  it('resolves the "list" alias to the full catalog', () => {
    const text = firstText(tool.run({ topic: 'list' }));
    expect(text).toMatch(/# Form catalog/);
    expect(text).toMatch(/## field-factory/);
    expect(text).toMatch(/## composite-builder/);
    expect(text).toMatch(/## primitive/);
    expect(text).toMatch(/## Output primitives/);
  });

  it('suggests fuzzy candidates for partial-word queries', () => {
    const text = firstText(tool.run({ topic: 'addr' }));
    expect(text).toMatch(/No form entry matched/);
    expect(text).toMatch(/Did you mean/);
    expect(text).toMatch(/dbxForgeAddress/);
  });

  it('falls through to catalog hint when no substring overlap exists', () => {
    const text = firstText(tool.run({ topic: 'zzzz-not-a-thing' }));
    expect(text).toMatch(/No form entry matched/);
    expect(text).toMatch(/browse the catalog/);
  });

  it('renders the field-derivative tier with the Derived from / ## Field Derivative sections', () => {
    const briefText = firstText(tieredTool.run({ topic: 'fixture-derivative', depth: 'brief' }));
    expect(briefText).toMatch(/derived from: `text`/);

    const fullText = firstText(tieredTool.run({ topic: 'fixture-derivative' }));
    expect(fullText).toMatch(/## Field Derivative/);
    expect(fullText).toMatch(/\*\*derived from:\*\* `text`/);
  });

  it('renders the template-builder tier with the Returns fields / ## Template sections', () => {
    const briefText = firstText(tieredTool.run({ topic: 'fixture-template', depth: 'brief' }));
    expect(briefText).toMatch(/returns fields: `fixture-a`, `fixture-b`/);

    const fullText = firstText(tieredTool.run({ topic: 'fixture-template' }));
    expect(fullText).toMatch(/## Template/);
    expect(fullText).toMatch(/\*\*returns fields:\*\* `fixture-a`, `fixture-b`/);
  });

  it('groups entries by tier name `field-derivative`', () => {
    const text = firstText(tieredTool.run({ topic: 'field-derivative' }));
    expect(text).toMatch(/# Form entries: tier = field-derivative/);
    expect(text).toMatch(/fixture-derivative/);
  });

  it('groups entries by tier name `template-builder`', () => {
    const text = firstText(tieredTool.run({ topic: 'template-builder' }));
    expect(text).toMatch(/# Form entries: tier = template-builder/);
    expect(text).toMatch(/fixture-template/);
  });
});
