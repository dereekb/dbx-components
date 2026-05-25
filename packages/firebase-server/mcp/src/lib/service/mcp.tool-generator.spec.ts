import { buildDefaultMcpToolDescription, buildMcpToolName, DEFAULT_SPECIFIER_KEY, generateMcpToolDefinitions } from './mcp.tool-generator';
import { type ModelApiDetailsResult, type McpVisibilityContext } from '@dereekb/firebase-server';

function makeSchemaRef(name: string, throws?: boolean) {
  return {
    toJsonSchema: () => {
      if (throws) {
        throw new Error(`schema fail for ${name}`);
      }
      return { type: 'object', title: name };
    }
  };
}

function makeApiDetailsWithMcp(callType: string, mcp: object | undefined): ModelApiDetailsResult {
  return {
    models: {
      widget: {
        calls: {
          [callType]: {
            isSpecifier: false,
            specifiers: {
              _: { inputType: makeSchemaRef('WidgetParams'), mcp }
            }
          }
        }
      }
    }
  };
}

function makeOneEntry(mcp?: object): ModelApiDetailsResult {
  return {
    models: {
      guestbook: {
        calls: {
          query: {
            isSpecifier: false,
            specifiers: {
              _: { inputType: makeSchemaRef('QueryGuestbooksParams'), mcp }
            }
          }
        }
      }
    }
  };
}

describe('buildMcpToolName', () => {
  it('omits the specifier for the default `_` entry', () => {
    expect(buildMcpToolName('guestbook', 'create')).toBe('guestbook-create');
    expect(buildMcpToolName('guestbook', 'create', DEFAULT_SPECIFIER_KEY)).toBe('guestbook-create');
  });

  it('appends the specifier for non-default entries', () => {
    expect(buildMcpToolName('profile', 'update', 'username')).toBe('profile-update-username');
    expect(buildMcpToolName('storageFile', 'invoke', 'recomputeChecksums')).toBe('storageFile-invoke-recomputeChecksums');
  });
});

describe('buildDefaultMcpToolDescription', () => {
  it('formats the default-entry description', () => {
    expect(buildDefaultMcpToolDescription('guestbook', 'create')).toContain('"create"');
    expect(buildDefaultMcpToolDescription('guestbook', 'create')).toContain('"guestbook"');
  });

  it('mentions the specifier when provided', () => {
    const text = buildDefaultMcpToolDescription('profile', 'update', 'username');
    expect(text).toContain('"username"');
  });
});

describe('generateMcpToolDefinitions', () => {
  it('produces one tool per (modelType, callType, specifier) leaf', () => {
    const apiDetails: ModelApiDetailsResult = {
      models: {
        storageFile: {
          calls: {
            invoke: {
              isSpecifier: true,
              specifiers: {
                recomputeChecksums: { inputType: makeSchemaRef('RecomputeChecksumsParams') }
              }
            }
          }
        },
        guestbook: {
          calls: {
            create: {
              isSpecifier: false,
              specifiers: {
                _: { inputType: makeSchemaRef('CreateGuestbookParams') }
              }
            }
          }
        }
      }
    };

    const result = generateMcpToolDefinitions(apiDetails);

    expect(result.tools).toHaveLength(2);
    const byName = new Map(result.tools.map((t) => [t.name, t]));
    expect(byName.has('storageFile-invoke-recomputeChecksums')).toBe(true);
    expect(byName.has('guestbook-create')).toBe(true);

    const invokeTool = byName.get('storageFile-invoke-recomputeChecksums')!;
    expect(invokeTool.dispatch).toEqual({ call: 'invoke', modelType: 'storageFile', specifier: 'recomputeChecksums' });
    expect(invokeTool.inputSchema).toEqual({ type: 'object', title: 'RecomputeChecksumsParams' });

    const createTool = byName.get('guestbook-create')!;
    expect(createTool.dispatch).toEqual({ call: 'create', modelType: 'guestbook', specifier: undefined });
  });

  it('honors handler-level mcp.name override', () => {
    const apiDetails: ModelApiDetailsResult = {
      models: {
        widget: {
          calls: {
            invoke: {
              isSpecifier: false,
              specifiers: {
                _: {
                  inputType: makeSchemaRef('WidgetInvokeParams'),
                  mcp: { name: 'custom-widget-tool' }
                }
              }
            }
          }
        }
      }
    };

    const { tools } = generateMcpToolDefinitions(apiDetails);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('custom-widget-tool');
  });

  it('skips handlers without an inputType and reports the gap', () => {
    const apiDetails: ModelApiDetailsResult = {
      models: {
        widget: {
          calls: {
            invoke: {
              isSpecifier: false,
              specifiers: {
                _: {} // no inputType
              }
            }
          }
        }
      }
    };

    const { tools, skipped } = generateMcpToolDefinitions(apiDetails);
    expect(tools).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toBe('missing_input_type');
  });

  it('reports schema-generation failures', () => {
    const apiDetails: ModelApiDetailsResult = {
      models: {
        widget: {
          calls: {
            invoke: {
              isSpecifier: false,
              specifiers: {
                _: { inputType: makeSchemaRef('BadSchema', true) }
              }
            }
          }
        }
      }
    };

    const { tools, skipped } = generateMcpToolDefinitions(apiDetails);
    expect(tools).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toBe('schema_generation_failed');
    expect(skipped[0].error?.message).toContain('schema fail');
  });
});

describe('generateMcpToolDefinitions filter metadata', () => {
  it('classifies all three visibility forms at boot', () => {
    const fn = (_ctx: McpVisibilityContext) => true;
    const rule = { requiredRoles: ['admin'] };
    const apiDetails: ModelApiDetailsResult = {
      models: {
        widget: {
          calls: {
            read: {
              isSpecifier: true,
              specifiers: {
                always: { inputType: makeSchemaRef('A'), mcp: { visibility: true } },
                never: { inputType: makeSchemaRef('B'), mcp: { visibility: false } },
                declarative: { inputType: makeSchemaRef('C'), mcp: { visibility: rule } },
                dynamic: { inputType: makeSchemaRef('D'), mcp: { visibility: fn } },
                bare: { inputType: makeSchemaRef('E') }
              }
            }
          }
        }
      }
    };

    const { tools, neverVisibleTools } = generateMcpToolDefinitions(apiDetails);
    const byName = new Map(tools.map((t) => [t.name, t]));

    expect(byName.get('widget-read-always')?.filterMetadata.visibilityKind).toBe('always');
    expect(byName.get('widget-read-declarative')?.filterMetadata.visibilityKind).toBe('declarative');
    expect(byName.get('widget-read-declarative')?.filterMetadata.rule).toBe(rule);
    expect(byName.get('widget-read-dynamic')?.filterMetadata.visibilityKind).toBe('dynamic');
    expect(byName.get('widget-read-dynamic')?.filterMetadata.visibilityFn).toBe(fn);
    expect(byName.get('widget-read-bare')?.filterMetadata.visibilityKind).toBe('always');

    expect(neverVisibleTools.map((t) => t.name)).toEqual(['widget-read-never']);
    expect(byName.has('widget-read-never')).toBe(false);
  });

  it('precomputes requiredScope from the call type', () => {
    const cases: Array<[string, string | undefined]> = [
      ['create', 'model.create'],
      ['read', 'model.read'],
      ['update', 'model.update'],
      ['delete', 'model.delete'],
      ['query', 'model.query'],
      ['invoke', 'model.invoke']
    ];

    for (const [callType, expected] of cases) {
      const { tools } = generateMcpToolDefinitions(makeApiDetailsWithMcp(callType, undefined));
      expect(tools[0].filterMetadata.requiredScope).toBe(expected);
    }
  });

  it('leaves requiredScope undefined for unknown call types', () => {
    const { tools } = generateMcpToolDefinitions(makeApiDetailsWithMcp('customVerb', undefined));
    expect(tools[0].filterMetadata.requiredScope).toBeUndefined();
  });

  it('resolves effectiveReadOnly from explicit override or call-type inference', () => {
    const overrideTrue = generateMcpToolDefinitions(makeApiDetailsWithMcp('create', { readOnly: true })).tools[0];
    expect(overrideTrue.filterMetadata.effectiveReadOnly).toBe(true);

    const overrideFalse = generateMcpToolDefinitions(makeApiDetailsWithMcp('read', { readOnly: false })).tools[0];
    expect(overrideFalse.filterMetadata.effectiveReadOnly).toBe(false);

    const inferredRead = generateMcpToolDefinitions(makeApiDetailsWithMcp('read', undefined)).tools[0];
    expect(inferredRead.filterMetadata.effectiveReadOnly).toBe(true);

    const inferredQuery = generateMcpToolDefinitions(makeApiDetailsWithMcp('query', undefined)).tools[0];
    expect(inferredQuery.filterMetadata.effectiveReadOnly).toBe(true);

    const inferredCreate = generateMcpToolDefinitions(makeApiDetailsWithMcp('create', undefined)).tools[0];
    expect(inferredCreate.filterMetadata.effectiveReadOnly).toBe(false);

    const inferredUpdate = generateMcpToolDefinitions(makeApiDetailsWithMcp('update', undefined)).tools[0];
    expect(inferredUpdate.filterMetadata.effectiveReadOnly).toBe(false);

    const inferredDelete = generateMcpToolDefinitions(makeApiDetailsWithMcp('delete', undefined)).tools[0];
    expect(inferredDelete.filterMetadata.effectiveReadOnly).toBe(false);

    const unknown = generateMcpToolDefinitions(makeApiDetailsWithMcp('invoke', undefined)).tools[0];
    expect(unknown.filterMetadata.effectiveReadOnly).toBeUndefined();
  });

  it('defaults visibility to always when mcp.visibility is omitted', () => {
    const { tools } = generateMcpToolDefinitions(makeApiDetailsWithMcp('read', undefined));
    expect(tools[0].filterMetadata.visibilityKind).toBe('always');
    expect(tools[0].filterMetadata.rule).toBeUndefined();
    expect(tools[0].filterMetadata.visibilityFn).toBeUndefined();
  });
});

describe('generateMcpToolDefinitions manifest integration', () => {
  it('resolves description in order: manifest > default', () => {
    const manifest = new Map([['guestbook.query._', { description: 'manifest description' }]]);

    const withManifest = generateMcpToolDefinitions(makeOneEntry(), undefined, manifest);
    expect(withManifest.tools[0].description).toBe('manifest description');

    const noManifest = generateMcpToolDefinitions(makeOneEntry());
    expect(noManifest.tools[0].description).toContain('"query"');
  });

  it('prefers manifest inputSchema over the ArkType-derived schema', () => {
    const manifest = new Map([['guestbook.query._', { inputSchema: { type: 'object', title: 'FromManifest' } }]]);
    const result = generateMcpToolDefinitions(makeOneEntry(), undefined, manifest);
    expect(result.tools[0].inputSchema).toEqual({ type: 'object', title: 'FromManifest' });
  });

  it('attaches outputSchema from the manifest entry', () => {
    const outputSchema = { type: 'object', properties: { count: { type: 'number' } } };
    const manifest = new Map([['guestbook.query._', { outputSchema }]]);
    const result = generateMcpToolDefinitions(makeOneEntry(), undefined, manifest);
    expect(result.tools[0].outputSchema).toEqual(outputSchema);
  });

  it('leaves outputSchema undefined when no manifest entry exists', () => {
    const result = generateMcpToolDefinitions(makeOneEntry());
    expect(result.tools[0].outputSchema).toBeUndefined();
  });
});
