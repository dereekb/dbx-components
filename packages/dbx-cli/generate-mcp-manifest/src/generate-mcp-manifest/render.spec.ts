import { type CliApiManifest, type CliApiManifestEntry, MCP_MANIFEST_VERSION } from '@dereekb/dbx-cli';
import { renderMcpManifest } from './render';

const FIXED_NOW = new Date('2026-05-25T00:00:00.000Z');

function makeEntry(overrides: Partial<CliApiManifestEntry> = {}): CliApiManifestEntry {
  return {
    model: 'guestbook',
    verb: 'query',
    groupName: 'Guestbook',
    sourceFile: 'apps/demo-cli/src/lib/manifest/api.manifest.generated.ts',
    ...overrides
  };
}

function render(entries: ReadonlyArray<CliApiManifestEntry>) {
  return renderMcpManifest(entries as CliApiManifest, FIXED_NOW);
}

describe('renderMcpManifest', () => {
  it('stamps the version and ISO timestamp', () => {
    const result = render([]);
    expect(result.version).toBe(MCP_MANIFEST_VERSION);
    expect(result.generatedAt).toBe('2026-05-25T00:00:00.000Z');
    expect(result.tools).toEqual({});
  });

  it('keys tools by mcpManifestKey and collapses default specifier to "_"', () => {
    const result = render([makeEntry({ model: 'guestbook', verb: 'query' }), makeEntry({ model: 'profile', verb: 'update', specifier: 'username' }), makeEntry({ model: 'profile', verb: 'update', specifier: '_' })]);

    expect(Object.keys(result.tools).sort((a, b) => a.localeCompare(b))).toEqual(['guestbook.query._', 'profile.update._', 'profile.update.username']);
  });

  it('skips standalone entries', () => {
    const result = render([makeEntry({ verb: 'standalone' }), makeEntry({ verb: 'query' })]);
    expect(Object.keys(result.tools)).toEqual(['guestbook.query._']);
  });

  it('merges description and paramsTypeDescription with a blank line', () => {
    const result = render([
      makeEntry({
        verb: 'query',
        description: 'List published entries.',
        paramsTypeDescription: 'Params: cursor + limit.'
      })
    ]);

    expect(result.tools['guestbook.query._']?.description).toBe('List published entries.\n\nParams: cursor + limit.');
  });

  it('uses just the description when paramsTypeDescription is missing', () => {
    const result = render([makeEntry({ description: 'List published entries.' })]);
    expect(result.tools['guestbook.query._']?.description).toBe('List published entries.');
  });

  it('uses just paramsTypeDescription when description is missing', () => {
    const result = render([makeEntry({ paramsTypeDescription: 'Pure params docs.' })]);
    expect(result.tools['guestbook.query._']?.description).toBe('Pure params docs.');
  });

  it('omits description entirely when both sources are absent', () => {
    const result = render([makeEntry({})]);
    expect(result.tools['guestbook.query._']?.description).toBeUndefined();
  });

  it('synthesizes inputSchema from paramsFields when no validator is present', () => {
    const result = render([
      makeEntry({
        paramsFields: [
          { name: 'cursor', typeText: 'string', description: 'Cursor returned by the previous page.' },
          { name: 'limit', typeText: 'number' }
        ]
      })
    ]);

    expect(result.tools['guestbook.query._']?.inputSchema).toEqual({
      type: 'object',
      properties: {
        cursor: { description: 'Cursor returned by the previous page.', type: 'string' },
        limit: { type: 'number' }
      }
    });
  });

  it('enriches a validator-derived inputSchema without overwriting existing descriptions', () => {
    const validator = { toJsonSchema: () => ({ type: 'object', properties: { cursor: { type: 'string', description: 'preset' }, limit: { type: 'number' } } }) } as unknown as CliApiManifestEntry['paramsValidator'];

    const result = render([
      makeEntry({
        paramsValidator: validator,
        paramsFields: [
          { name: 'cursor', typeText: 'string', description: 'fallback' },
          { name: 'limit', typeText: 'number', description: 'How many to return.' }
        ]
      })
    ]);

    const schema = result.tools['guestbook.query._']?.inputSchema as { properties: Record<string, { description?: string; type?: string }> };
    expect(schema.properties['cursor'].description).toBe('preset');
    expect(schema.properties['limit'].description).toBe('How many to return.');
  });

  it('omits inputSchema when neither validator nor paramsFields are present', () => {
    const result = render([makeEntry({})]);
    expect(result.tools['guestbook.query._']?.inputSchema).toBeUndefined();
  });

  it('synthesizes outputSchema from resultFields and resultTypeDescription', () => {
    const result = render([
      makeEntry({
        resultTypeDescription: 'A page of guestbook entries.',
        resultFields: [
          { name: 'entries', typeText: 'GuestbookEntry[]', description: 'Page contents.' },
          { name: 'nextCursor', typeText: 'Maybe<string>', description: 'Cursor for the next page.' }
        ]
      })
    ]);

    expect(result.tools['guestbook.query._']?.outputSchema).toEqual({
      type: 'object',
      description: 'A page of guestbook entries.',
      properties: {
        entries: { type: 'array', description: 'Page contents.' },
        nextCursor: { type: 'string', description: 'Cursor for the next page.' }
      }
    });
  });

  it('omits outputSchema when both resultFields and resultTypeDescription are absent', () => {
    const result = render([makeEntry({})]);
    expect(result.tools['guestbook.query._']?.outputSchema).toBeUndefined();
  });

  it('drops paramsTypeName, resultTypeName, paramsValidator, groupName, sourceFile from the rendered entry', () => {
    const result = render([
      makeEntry({
        paramsTypeName: 'QueryGuestbookParams',
        resultTypeName: 'GuestbookEntryPage',
        paramsValidator: { toJsonSchema: () => ({ type: 'object' }) } as unknown as CliApiManifestEntry['paramsValidator']
      })
    ]);

    const entry = result.tools['guestbook.query._']!;
    expect(entry).not.toHaveProperty('paramsTypeName');
    expect(entry).not.toHaveProperty('resultTypeName');
    expect(entry).not.toHaveProperty('paramsValidator');
    expect(entry).not.toHaveProperty('groupName');
    expect(entry).not.toHaveProperty('sourceFile');
  });

  it('falls back to undefined type when typeText cannot be classified', () => {
    const result = render([makeEntry({ resultFields: [{ name: 'created', typeText: 'CustomShape' }] })]);
    const schema = result.tools['guestbook.query._']?.outputSchema as { properties: Record<string, object> };
    expect(schema.properties['created']).toEqual({});
  });
});
