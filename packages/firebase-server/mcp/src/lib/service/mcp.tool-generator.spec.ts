import { buildDefaultMcpToolDescription, buildMcpToolName, DEFAULT_SPECIFIER_KEY, generateMcpToolDefinitions } from './mcp.tool-generator';
import { type ModelApiDetailsResult } from '@dereekb/firebase-server';

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

  it('honors handler-level mcp.name and mcp.description overrides', () => {
    const apiDetails: ModelApiDetailsResult = {
      models: {
        widget: {
          calls: {
            invoke: {
              isSpecifier: false,
              specifiers: {
                _: {
                  inputType: makeSchemaRef('WidgetInvokeParams'),
                  mcp: { name: 'custom-widget-tool', description: 'Custom description' }
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
    expect(tools[0].description).toBe('Custom description');
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
