import { type CliApiManifestEntry, type CliModelManifest, type CliModelManifestEntry, MCP_MANIFEST_VERSION } from '@dereekb/dbx-cli';
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

function render(entries: ReadonlyArray<CliApiManifestEntry>, modelManifest?: CliModelManifest) {
  return renderMcpManifest({ apiManifest: entries, modelManifest }, FIXED_NOW).manifest;
}

function renderFull(entries: ReadonlyArray<CliApiManifestEntry>, modelManifest?: CliModelManifest) {
  return renderMcpManifest({ apiManifest: entries, modelManifest }, FIXED_NOW);
}

function makeModelEntry(overrides: Partial<CliModelManifestEntry> = {}): CliModelManifestEntry {
  return {
    modelType: 'guestbook',
    modelName: 'Guestbook',
    identityConst: 'guestbookIdentity',
    collectionPrefix: 'gb',
    sourcePackage: 'demo-firebase',
    sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.ts',
    fields: [{ name: 'n', longName: 'name', optional: false, tsType: 'string' }],
    ...overrides
  };
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

  it('prefers the MCP-mapped result fields/description over the raw result for outputSchema', () => {
    const result = render([
      makeEntry({
        resultTypeDescription: 'Raw, untrimmed page.',
        resultFields: [{ name: 'secret', typeText: 'string', description: 'Should not be exposed.' }],
        mcpResultTypeDescription: 'Trimmed projection for MCP clients.',
        mcpResultFields: [{ name: 'count', typeText: 'number', description: 'Number of entries.' }]
      })
    ]);

    expect(result.tools['guestbook.query._']?.outputSchema).toEqual({
      type: 'object',
      description: 'Trimmed projection for MCP clients.',
      properties: {
        count: { type: 'number', description: 'Number of entries.' }
      }
    });
  });

  it('falls back to the raw result for outputSchema when no mapped result is present', () => {
    const result = render([makeEntry({ resultTypeDescription: 'Raw page.', resultFields: [{ name: 'entries', typeText: 'GuestbookEntry[]' }] })]);
    const schema = result.tools['guestbook.query._']?.outputSchema as { description?: string; properties: Record<string, object> };
    expect(schema.description).toBe('Raw page.');
    expect(schema.properties['entries']).toEqual({ type: 'array' });
  });

  it('carries mcpResultTypeName onto the wire entry when the source leaf was annotated', () => {
    const result = render([makeEntry({ mcpResultTypeName: 'GuestbookPageMcpResult', mcpResultFields: [{ name: 'count', typeText: 'number' }] })]);
    expect(result.tools['guestbook.query._']?.mcpResultTypeName).toBe('GuestbookPageMcpResult');
  });

  it('omits mcpResultTypeName when the source leaf was not annotated', () => {
    const result = render([makeEntry({ resultFields: [{ name: 'entries', typeText: 'GuestbookEntry[]' }] })]);
    expect(result.tools['guestbook.query._']).not.toHaveProperty('mcpResultTypeName');
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

  describe('model manifest', () => {
    it('omits models when no model manifest is supplied', () => {
      const result = render([makeEntry({})]);
      expect(result.models).toBeUndefined();
    });

    it('omits models when the supplied manifest is empty', () => {
      const result = render([makeEntry({})], []);
      expect(result.models).toBeUndefined();
    });

    it('projects each model entry, dropping converter text and keeping field metadata', () => {
      const result = render(
        [makeEntry({})],
        [
          makeModelEntry({
            modelGroup: 'Guestbook',
            description: 'A guestbook.',
            fields: [
              { name: 'n', longName: 'name', optional: false, tsType: 'string', description: 'The name.', converter: 'firestoreString()' },
              { name: 'cat', longName: 'createdAt', optional: false, tsType: 'Date', converter: 'firestoreDate()' }
            ]
          })
        ]
      );

      expect(result.models).toEqual([
        {
          modelType: 'guestbook',
          modelName: 'Guestbook',
          modelGroup: 'Guestbook',
          identityConst: 'guestbookIdentity',
          collectionPrefix: 'gb',
          description: 'A guestbook.',
          sourcePackage: 'demo-firebase',
          sourceFile: 'components/demo-firebase/src/lib/model/guestbook/guestbook.ts',
          fields: [
            { name: 'n', longName: 'name', optional: false, tsType: 'string', description: 'The name.' },
            { name: 'cat', longName: 'createdAt', optional: false, tsType: 'Date' }
          ]
        }
      ]);
    });

    it('recurses into nestedFields for object-array and sub-object fields', () => {
      const result = render(
        [makeEntry({})],
        [
          makeModelEntry({
            fields: [
              {
                name: 'r',
                longName: 'recipients',
                optional: false,
                tsType: 'Recipient[]',
                converter: 'firestoreObjectArray(...)',
                nestedFields: [
                  { name: 'id', longName: 'id', optional: false, tsType: 'string' },
                  { name: 'em', longName: 'email', optional: true, tsType: 'Maybe<string>' }
                ],
                nestedIsArray: true
              }
            ]
          })
        ]
      );

      expect(result.models?.[0].fields[0]).toEqual({
        name: 'r',
        longName: 'recipients',
        optional: false,
        tsType: 'Recipient[]',
        nestedFields: [
          { name: 'id', longName: 'id', optional: false, tsType: 'string' },
          { name: 'em', longName: 'email', optional: true, tsType: 'Maybe<string>' }
        ],
        nestedIsArray: true
      });
    });

    it('keeps parentIdentityConst on subcollection entries', () => {
      const result = render([makeEntry({})], [makeModelEntry({ modelType: 'guestbookEntry', identityConst: 'guestbookEntryIdentity', collectionPrefix: 'gbe', parentIdentityConst: 'guestbookIdentity' })]);

      expect(result.models?.[0]).toMatchObject({
        modelType: 'guestbookEntry',
        parentIdentityConst: 'guestbookIdentity'
      });
    });

    it('projects mcpToolNameSegment when present', () => {
      const result = render([makeEntry({})], [makeModelEntry({ mcpToolNameSegment: 'gb' })]);
      expect(result.models?.[0]).toMatchObject({ mcpToolNameSegment: 'gb' });
    });

    it('omits mcpToolNameSegment when absent', () => {
      const result = render([makeEntry({})], [makeModelEntry({})]);
      expect(result.models?.[0]).not.toHaveProperty('mcpToolNameSegment');
    });
  });
});

describe('renderMcpManifest tool name validation', () => {
  it('returns no warnings or errors for short names', () => {
    const result = renderFull([makeEntry({ verb: 'query' })]);
    expect(result.warnings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('errors when an auto-generated name exceeds the 64-char cap', () => {
    const result = renderFull([makeEntry({ verb: 'update', specifier: 'a'.repeat(70) })]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('over the 64-char MCP cap');
  });

  it('warns when an auto-generated name exceeds the soft limit but fits the cap', () => {
    const result = renderFull([makeEntry({ verb: 'update', specifier: 'a'.repeat(50) })]); // guestbook- (10) + 50 = 60
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('soft limit');
  });

  it('disambiguates two entries that resolve to the same tool name with the abbreviated call type', () => {
    const result = renderFull([makeEntry({ model: 'widget', verb: 'read', specifier: 'foo' }), makeEntry({ model: 'widget', verb: 'update', specifier: 'foo' })]);
    expect(result.errors).toEqual([]);
    // Both colliding entries are re-derived; the warning names the disambiguated form rather than dropping one.
    expect(result.warnings.some((w) => w.includes('produced by more than one entry') && w.includes('widget-r-foo'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('widget-u-foo'))).toBe(true);
  });

  it('errors when disambiguating a collision pushes the name over the cap', () => {
    const specifier = 'a'.repeat(57); // widget- (7) + 57 = 64 (fits); widget-u- (9) + 57 = 66 (over cap)
    const result = renderFull([makeEntry({ model: 'widget', verb: 'read', specifier }), makeEntry({ model: 'widget', verb: 'update', specifier })]);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors.some((e) => e.includes('over the 64-char MCP cap'))).toBe(true);
  });

  it('uses a per-model segment from the model manifest, keeping an otherwise-too-long name under the cap', () => {
    const longSpecifier = 'a'.repeat(58); // guestbook- (10) + 58 = 68 (error); gb- (3) + 58 = 61 (warn)
    const apiManifest = [makeEntry({ model: 'guestbook', verb: 'update', specifier: longSpecifier })];

    const withoutSegment = renderFull(apiManifest, [makeModelEntry({})]);
    expect(withoutSegment.errors).toHaveLength(1);

    const withSegment = renderFull(apiManifest, [makeModelEntry({ mcpToolNameSegment: 'gb' })]);
    expect(withSegment.errors).toEqual([]);
    expect(withSegment.warnings).toHaveLength(1);
  });
});
