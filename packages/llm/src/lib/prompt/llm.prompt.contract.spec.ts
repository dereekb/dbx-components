import { describe, expect, it } from 'vitest';
import { DEFAULT_LLM_OUTPUT_CONTRACT_FOOTER, renderLlmOutputContract } from './llm.prompt.contract';

const DEFAULT_HEAD = '## Output contract\n\nReturn a JSON object with these fields:\n';
const DEFAULT_TAIL = '\n\nUse these field names exactly, and leave out an optional field rather than invent a value for it.';

/**
 * A host's own intro and footer — the pairs below render with them so they match the captured bytes.
 */
const HOST_INTRO = 'Return the `lever` as a JSON object with these fields:';
const HOST_FOOTER = 'Never invent an id. Every id MUST be one shown in the live context below.';
const H = `## Output contract\n\n${HOST_INTRO}\n`;
const F = `\n\n${HOST_FOOTER}`;

function hostRender(schema: unknown, footer?: string): string {
  return renderLlmOutputContract({ schema, intro: HOST_INTRO, footer: footer ?? HOST_FOOTER });
}

const TITLE_SCHEMA = { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] };
const OVERRIDE_SCHEMA = { type: 'object', properties: { override_marker: { type: 'string' } }, required: ['override_marker'] };

/**
 * Nested objects and a primitive array, none required — the golden replica renders the same contract.
 */
const RESOLVE_CONTRACT = {
  type: 'object',
  properties: {
    accept: { type: 'object', properties: { ref: { type: 'number' }, via: { type: 'number' } }, required: ['ref', 'via'] },
    clearRejections: { type: 'boolean' },
    composeAs: { type: 'object', properties: { templateId: { type: 'number' }, tone: { type: 'number' } }, required: ['templateId', 'tone'] },
    dropThreadPredicates: { type: 'array', items: { type: 'number' } }
  }
};

function fieldLinesOf(rendered: string): ReadonlyArray<string> {
  return rendered.split('\n').filter((line) => line.trimStart().startsWith('- '));
}

describe('renderLlmOutputContract()', () => {
  it('should render the heading, the default intro, one bullet and the default footer', () => {
    expect(renderLlmOutputContract({ schema: TITLE_SCHEMA })).toBe(`${DEFAULT_HEAD}- \`title\` (string, required)${DEFAULT_TAIL}`);
  });

  it("should render a host's own intro and footer byte for byte", () => {
    expect(hostRender(OVERRIDE_SCHEMA)).toBe(`${H}- \`override_marker\` (string, required)${F}`);
  });

  it('should close with a per-call footer, and treat an undefined footer as omitted', () => {
    const custom = 'Every id you name MUST be one shown below.';
    expect(renderLlmOutputContract({ schema: OVERRIDE_SCHEMA, intro: HOST_INTRO, footer: custom })).toBe(`${H}- \`override_marker\` (string, required)\n\n${custom}`);
    expect(renderLlmOutputContract({ schema: TITLE_SCHEMA, footer: undefined })).toBe(renderLlmOutputContract({ schema: TITLE_SCHEMA }));
    expect(renderLlmOutputContract({ schema: TITLE_SCHEMA, footer: custom }).replace(custom, DEFAULT_LLM_OUTPUT_CONTRACT_FOOTER)).toBe(renderLlmOutputContract({ schema: TITLE_SCHEMA }));
  });

  it("should drop the intro line for '' and the footer with its blank line for ''", () => {
    expect(renderLlmOutputContract({ schema: TITLE_SCHEMA, intro: '', footer: '' })).toBe('## Output contract\n\n- `title` (string, required)');
  });

  it('should label nested objects and a primitive array', () => {
    expect(fieldLinesOf(hostRender(RESOLVE_CONTRACT))).toEqual(['- `accept` (object { ref: number, via: number }, optional)', '- `clearRejections` (boolean, optional)', '- `composeAs` (object { templateId: number, tone: number }, optional)', '- `dropThreadPredicates` (number[], optional)']);
  });

  it("should carry a nested field's optionality as '?'", () => {
    const schema = { type: 'object', properties: { belief: { type: 'object', properties: { predicate: { type: 'number' }, text: { type: 'string' }, about: { type: 'number' } }, required: ['predicate', 'text'] } }, required: [] };
    expect(hostRender(schema)).toBe(`${H}- \`belief\` (object { predicate: number, text: string, about?: number }, optional)${F}`);
  });

  it("should mark '?' one object deeper and label a union inside an object", () => {
    const schema = { type: 'object', properties: { act: { type: 'object', properties: { hold: { type: 'object', properties: { point: { type: 'string' }, until: { enum: ['asked', 'later'] } }, required: ['point', 'until'] } } } } };
    expect(fieldLinesOf(hostRender(schema))).toEqual(['- `act` (object { hold?: object { point: string, until: "asked" | "later" } }, optional)']);
  });

  it('should expand a top-level array of objects with a 4-space indent', () => {
    const schema = { type: 'object', properties: { steps: { type: 'array', items: { type: 'object', properties: { step: { type: 'string' }, done: { type: 'boolean' }, note: { type: 'string' } }, required: ['step', 'done'] } } }, required: ['steps'] };
    expect(renderLlmOutputContract({ schema })).toContain('- `steps` (object[], required): an array where each item is an object with:\n    - `step` (string, required)\n    - `done` (boolean, required)\n    - `note` (string, optional)');
  });

  it('should label an enum and a const as literals, never unknown', () => {
    const schema = { type: 'object', properties: { class: { enum: ['observe', 'seed', 'terminate'] }, kind: { const: 'token' } }, required: ['class'] };
    const rendered = hostRender(schema);
    expect(rendered).toBe(`${H}- \`class\` ("observe" | "seed" | "terminate", required)\n- \`kind\` ("token", optional)${F}`);
    expect(rendered).not.toContain('unknown');
  });

  it('should append a whitespace-collapsed description after a colon, and leave an undescribed field plain', () => {
    const schema = { type: 'object', properties: { described: { type: 'string', description: 'A sentence\n  that wrapped in source.' }, bare: { type: 'number' } }, required: ['described'] };
    expect(hostRender(schema)).toBe(`${H}- \`described\` (string, required): A sentence that wrapped in source.\n- \`bare\` (number, optional)${F}`);
  });

  it("should describe an expanded array's item fields, and lead the header with the array's own sentence", () => {
    const items = { type: 'object', properties: { id: { type: 'number', description: 'The id.' } }, required: ['id'] };
    expect(hostRender({ type: 'object', properties: { rows: { type: 'array', items } } })).toBe(`${H}- \`rows\` (object[], optional): an array where each item is an object with:\n    - \`id\` (number, required): The id.${F}`);
    expect(hostRender({ type: 'object', properties: { rows: { type: 'array', description: 'One row per beat.', items } } })).toBe(`${H}- \`rows\` (object[], optional): One row per beat. Each item is an object with:\n    - \`id\` (number, required): The id.${F}`);
  });

  it('should expand nested arrays of objects wherever prose waits, at indents 4, 8 and 12', () => {
    const frames = { type: 'array', items: { type: 'object', properties: { band: { type: 'integer', description: 'How strongly it is held (0-8).' } }, required: ['band'] } };
    const beliefs = { type: 'array', items: { type: 'object', properties: { object: { type: 'integer', description: 'What the belief targets.' }, frames } } };
    const schema = { type: 'object', properties: { spawns: { type: 'array', items: { type: 'object', properties: { beliefs } } } } };
    expect(fieldLinesOf(renderLlmOutputContract({ schema }))).toEqual([
      '- `spawns` (object[], optional): an array where each item is an object with:',
      '    - `beliefs` (object[], optional): an array where each item is an object with:',
      '        - `object` (integer, optional): What the belief targets.',
      '        - `frames` (object[], optional): an array where each item is an object with:',
      '            - `band` (integer, required): How strongly it is held (0-8).'
    ]);
  });

  it("should lead a nested array's header with its own sentence", () => {
    const stances = { type: 'array', description: 'Supersedes `stance` when both are given.', items: { type: 'object', properties: { band: { type: 'integer', description: 'The band.' } }, required: ['band'] } };
    const schema = { type: 'object', properties: { entries: { type: 'array', items: { type: 'object', properties: { stances } } } } };
    expect(renderLlmOutputContract({ schema })).toContain('    - `stances` (object[], optional): Supersedes `stance` when both are given. Each item is an object with:\n        - `band` (integer, required): The band.');
  });

  it('should keep a nested array of objects inline when its expansion carries no prose', () => {
    const bare = { type: 'array', items: { type: 'object', properties: { a: { type: 'number' } }, required: ['a'] } };
    const schema = { type: 'object', properties: { rows: { type: 'array', items: { type: 'object', properties: { nested: bare }, required: [] } } } };
    const rendered = hostRender(schema);
    expect(rendered).toBe(`${H}- \`rows\` (object[], optional): an array where each item is an object with:\n    - \`nested\` (object { a: number }[], optional)${F}`);
    expect(rendered.split('\n').some((line) => line.startsWith('        '))).toBe(false);
  });

  it('should never expand a nested plain object, even a described one', () => {
    const schema = { type: 'object', properties: { decay: { type: 'object', description: 'Decay knobs.', properties: { alpha: { type: 'integer', description: 'The alpha.' }, beta: { type: 'integer' } } } } };
    const rendered = renderLlmOutputContract({ schema });
    expect(rendered).toContain('- `decay` (object { alpha?: integer, beta?: integer }, optional): Decay knobs.');
    expect(rendered).not.toContain('    - `alpha`');
  });

  it('should expand nothing below the top level when nothing is described', () => {
    const level3 = { type: 'array', items: { type: 'object', properties: { c: { type: 'number' } } } };
    const level2 = { type: 'array', items: { type: 'object', properties: { level3 } } };
    const schema = { type: 'object', properties: { level1: { type: 'array', items: { type: 'object', properties: { level2 } } } } };
    expect(
      renderLlmOutputContract({ schema })
        .split('\n')
        .some((line) => line.startsWith('        '))
    ).toBe(false);
  });

  it("should label anyOf / oneOf branches and a type array as a ' | ' union", () => {
    const schema = {
      type: 'object',
      properties: {
        any: { anyOf: [{ type: 'number' }, { type: 'string' }] },
        one: { oneOf: [{ type: 'number' }, { type: 'string' }] },
        odd: { anyOf: [{ type: 'number' }, true] },
        nullable: { type: ['string', 'null'] },
        empty: { type: [] }
      }
    };
    expect(fieldLinesOf(renderLlmOutputContract({ schema }))).toEqual(['- `any` (number | string, optional)', '- `one` (number | string, optional)', '- `odd` (number | unknown, optional)', '- `nullable` (string | null, optional)', '- `empty` (unknown, optional)']);
  });

  it('should fall back to unknown and never throw on a missing or malformed node', () => {
    const schema = { type: 'object', properties: { untyped: {}, list: { type: 'array' }, never: false, missing: null }, required: 'untyped' };
    expect(fieldLinesOf(renderLlmOutputContract({ schema }))).toEqual(['- `untyped` (unknown, optional)', '- `list` (unknown[], optional)', '- `never` (unknown, optional)', '- `missing` (unknown, optional)']);
    expect(fieldLinesOf(renderLlmOutputContract({ schema: { type: 'object' } }))).toEqual([]);
    expect(renderLlmOutputContract({ schema: 'not a schema' })).toBe(`${DEFAULT_HEAD}${DEFAULT_TAIL.slice(1)}`);
    expect(renderLlmOutputContract({ schema: null })).toBe(renderLlmOutputContract({ schema: {} }));
  });

  it('should add no tail for an empty, blank or non-string description', () => {
    const schema = { type: 'object', properties: { a: { type: 'string', description: '' }, b: { type: 'string', description: '   ' }, c: { type: 'string', description: 42 } } };
    expect(fieldLinesOf(renderLlmOutputContract({ schema }))).toEqual(['- `a` (string, optional)', '- `b` (string, optional)', '- `c` (string, optional)']);
  });
});
