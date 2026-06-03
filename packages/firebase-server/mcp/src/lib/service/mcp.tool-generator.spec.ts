import { abbreviateMcpCallType, buildDefaultMcpToolDescription, buildDisambiguatedMcpToolName, buildMcpToolName, DEFAULT_SPECIFIER_KEY, generateMcpToolDefinitions, MCP_TOOL_NAME_MAX_LENGTH, MCP_TOOL_NAME_WARN_LENGTH, validateMcpToolName, type McpToolGenerationNamingOptions } from './mcp.tool-generator';
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

  it('uses the specifier in place of the call-type for non-default entries', () => {
    expect(buildMcpToolName('profile', 'update', 'username')).toBe('profile-username');
    expect(buildMcpToolName('storageFile', 'invoke', 'recomputeChecksums')).toBe('storageFile-recomputeChecksums');
  });

  it('uses the provided model segment in place of the model type', () => {
    expect(buildMcpToolName('wk', 'update', 'syncCheckHqEmployee')).toBe('wk-syncCheckHqEmployee');
    expect(buildMcpToolName('wk', 'create')).toBe('wk-create');
  });
});

describe('abbreviateMcpCallType', () => {
  it('abbreviates each known CRUDQ + invoke call type to a single character', () => {
    expect(abbreviateMcpCallType('create')).toBe('c');
    expect(abbreviateMcpCallType('read')).toBe('r');
    expect(abbreviateMcpCallType('update')).toBe('u');
    expect(abbreviateMcpCallType('delete')).toBe('d');
    expect(abbreviateMcpCallType('query')).toBe('q');
    expect(abbreviateMcpCallType('invoke')).toBe('i');
  });

  it('returns a custom call type unchanged', () => {
    expect(abbreviateMcpCallType('recompute')).toBe('recompute');
  });
});

describe('buildDisambiguatedMcpToolName', () => {
  it('re-inserts the abbreviated call type for non-default entries', () => {
    expect(buildDisambiguatedMcpToolName('worker', 'update', 'syncCheckHqEmployee')).toBe('worker-u-syncCheckHqEmployee');
    expect(buildDisambiguatedMcpToolName('widget', 'read', 'foo')).toBe('widget-r-foo');
  });

  it('uses the full custom call type for non-default entries', () => {
    expect(buildDisambiguatedMcpToolName('widget', 'recompute', 'foo')).toBe('widget-recompute-foo');
  });

  it('leaves the default `_` entry in its `<segment>-<callType>` form', () => {
    expect(buildDisambiguatedMcpToolName('worker', 'create')).toBe('worker-create');
    expect(buildDisambiguatedMcpToolName('worker', 'create', DEFAULT_SPECIFIER_KEY)).toBe('worker-create');
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
    expect(byName.has('storageFile-recomputeChecksums')).toBe(true);
    expect(byName.has('guestbook-create')).toBe(true);

    const invokeTool = byName.get('storageFile-recomputeChecksums')!;
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

    expect(byName.get('widget-always')?.filterMetadata.visibilityKind).toBe('always');

    const declarativeMeta = byName.get('widget-declarative')?.filterMetadata;
    expect(declarativeMeta?.visibilityKind).toBe('declarative');
    if (declarativeMeta?.visibilityKind === 'declarative') {
      expect(declarativeMeta.rule).toBe(rule);
    }

    const dynamicMeta = byName.get('widget-dynamic')?.filterMetadata;
    expect(dynamicMeta?.visibilityKind).toBe('dynamic');
    if (dynamicMeta?.visibilityKind === 'dynamic') {
      expect(dynamicMeta.visibilityFn).toBe(fn);
    }

    expect(byName.get('widget-bare')?.filterMetadata.visibilityKind).toBe('always');

    expect(neverVisibleTools.map((t) => t.name)).toEqual(['widget-never']);
    expect(byName.has('widget-never')).toBe(false);
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
  });
});

describe('generateMcpToolDefinitions manifest integration', () => {
  it('resolves description in order: manifest > default', () => {
    const manifest = new Map([['guestbook.query._', { description: 'manifest description' }]]);

    const withManifest = generateMcpToolDefinitions(makeOneEntry(), undefined, { manifest });
    expect(withManifest.tools[0].description).toBe('manifest description');

    const noManifest = generateMcpToolDefinitions(makeOneEntry());
    expect(noManifest.tools[0].description).toContain('"query"');
  });

  it('prefers manifest inputSchema over the ArkType-derived schema', () => {
    const manifest = new Map([['guestbook.query._', { inputSchema: { type: 'object', title: 'FromManifest' } }]]);
    const result = generateMcpToolDefinitions(makeOneEntry(), undefined, { manifest });
    expect(result.tools[0].inputSchema).toEqual({ type: 'object', title: 'FromManifest' });
  });

  it('attaches outputSchema from the manifest entry', () => {
    const outputSchema = { type: 'object', properties: { count: { type: 'number' } } };
    const manifest = new Map([['guestbook.query._', { outputSchema }]]);
    const result = generateMcpToolDefinitions(makeOneEntry(), undefined, { manifest });
    expect(result.tools[0].outputSchema).toEqual(outputSchema);
  });

  it('leaves outputSchema undefined when no manifest entry exists', () => {
    const result = generateMcpToolDefinitions(makeOneEntry());
    expect(result.tools[0].outputSchema).toBeUndefined();
  });
});

describe('generateMcpToolDefinitions mcp-result mapping consistency', () => {
  const mapper = { mapSuccessfulResult: () => ({}) };

  it('warns when a handler has mapSuccessfulResult but the manifest entry is not mapped', () => {
    const manifest = new Map([['guestbook.query._', { outputSchema: { type: 'object' } }]]);
    const result = generateMcpToolDefinitions(makeOneEntry(mapper), undefined, { manifest });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toBe('mapper_without_mapped_manifest');
    expect(result.warnings[0].toolName).toBe('guestbook-query');
  });

  it('does not warn when the handler maps and the manifest entry carries mcpResultTypeName', () => {
    const manifest = new Map([['guestbook.query._', { mcpResultTypeName: 'GuestbookPageMcpResult' }]]);
    const result = generateMcpToolDefinitions(makeOneEntry(mapper), undefined, { manifest });
    expect(result.warnings).toHaveLength(0);
  });

  it('warns when the manifest entry is mapped but the handler no longer maps', () => {
    const manifest = new Map([['guestbook.query._', { mcpResultTypeName: 'GuestbookPageMcpResult' }]]);
    const result = generateMcpToolDefinitions(makeOneEntry(), undefined, { manifest });
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toBe('mapped_manifest_without_mapper');
  });

  it('does not warn about mappers when no manifest is supplied', () => {
    const result = generateMcpToolDefinitions(makeOneEntry(mapper));
    expect(result.warnings).toHaveLength(0);
  });
});

describe('validateMcpToolName', () => {
  it('classifies names against the soft/hard limits', () => {
    expect(validateMcpToolName('a'.repeat(MCP_TOOL_NAME_WARN_LENGTH)).level).toBe('ok');
    expect(validateMcpToolName('a'.repeat(MCP_TOOL_NAME_WARN_LENGTH + 1)).level).toBe('warn');
    expect(validateMcpToolName('a'.repeat(MCP_TOOL_NAME_MAX_LENGTH)).level).toBe('warn');
    expect(validateMcpToolName('a'.repeat(MCP_TOOL_NAME_MAX_LENGTH + 1)).level).toBe('error');
  });

  it('reports the measured length', () => {
    expect(validateMcpToolName('worker-create')).toEqual({ name: 'worker-create', length: 13, level: 'ok' });
  });
});

describe('generateMcpToolDefinitions name-length handling', () => {
  function makeNamedSpecifier(modelType: string, callType: string, specifierKey: string): ModelApiDetailsResult {
    return {
      models: {
        [modelType]: {
          calls: {
            [callType]: {
              isSpecifier: true,
              specifiers: {
                [specifierKey]: { inputType: makeSchemaRef('Params') }
              }
            }
          }
        }
      }
    };
  }

  it('skips a tool whose resolved name exceeds the hard cap', () => {
    const longSpecifier = 'a'.repeat(MCP_TOOL_NAME_MAX_LENGTH); // `widget-` + this is well over the cap
    const { tools, skipped, warnings } = generateMcpToolDefinitions(makeNamedSpecifier('widget', 'invoke', longSpecifier));

    expect(tools).toHaveLength(0);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toBe('name_too_long');
    expect(warnings).toHaveLength(0);
  });

  it('registers a tool over the soft limit without a runtime warning (the manifest renderer surfaces length drift)', () => {
    const specifier = 'a'.repeat(MCP_TOOL_NAME_WARN_LENGTH); // `widget-` + this is over warn, under cap
    const { tools, warnings } = generateMcpToolDefinitions(makeNamedSpecifier('widget', 'invoke', specifier));

    expect(tools).toHaveLength(1);
    expect(warnings).toHaveLength(0);
  });

  it('disambiguates two visible tools that collide on the dropped-call-type name', () => {
    const apiDetails: ModelApiDetailsResult = {
      models: {
        widget: {
          calls: {
            read: { isSpecifier: true, specifiers: { foo: { inputType: makeSchemaRef('ReadFoo') } } },
            update: { isSpecifier: true, specifiers: { foo: { inputType: makeSchemaRef('UpdateFoo') } } }
          }
        }
      }
    };

    const { tools, skipped, warnings } = generateMcpToolDefinitions(apiDetails);

    // Both survive: the abbreviated call type is re-inserted to break the clash. Disambiguation is
    // silent at runtime — the manifest renderer surfaces the collision at build time.
    expect(tools.map((t) => t.name)).toEqual(['widget-r-foo', 'widget-u-foo']);
    expect(skipped).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('does not treat a hidden tool as colliding with a visible one of the same name', () => {
    const apiDetails: ModelApiDetailsResult = {
      models: {
        widget: {
          calls: {
            read: { isSpecifier: true, specifiers: { foo: { inputType: makeSchemaRef('ReadFoo'), mcp: { visibility: false } } } },
            update: { isSpecifier: true, specifiers: { foo: { inputType: makeSchemaRef('UpdateFoo') } } }
          }
        }
      }
    };

    const { tools, neverVisibleTools, skipped } = generateMcpToolDefinitions(apiDetails);

    expect(tools.map((t) => t.name)).toEqual(['widget-foo']);
    expect(neverVisibleTools.map((t) => t.name)).toEqual(['widget-foo']);
    expect(skipped).toHaveLength(0);
  });

  it('uses the full custom call type when disambiguating a custom-call-type collision', () => {
    const apiDetails: ModelApiDetailsResult = {
      models: {
        widget: {
          calls: {
            read: { isSpecifier: true, specifiers: { foo: { inputType: makeSchemaRef('ReadFoo') } } },
            recompute: { isSpecifier: true, specifiers: { foo: { inputType: makeSchemaRef('RecomputeFoo') } } }
          }
        }
      }
    };

    const { tools, skipped } = generateMcpToolDefinitions(apiDetails);

    expect(tools.map((t) => t.name)).toEqual(['widget-r-foo', 'widget-recompute-foo']);
    expect(skipped).toHaveLength(0);
  });

  it('keeps the short name for a named specifier with no colliding sibling', () => {
    const { tools, skipped, warnings } = generateMcpToolDefinitions(makeNamedSpecifier('widget', 'update', 'syncCheckHqEmployee'));

    expect(tools.map((t) => t.name)).toEqual(['widget-syncCheckHqEmployee']);
    expect(skipped).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});

describe('generateMcpToolDefinitions per-model name segment', () => {
  it('substitutes the configured segment for the model type', () => {
    const apiDetails: ModelApiDetailsResult = {
      models: {
        worker: {
          calls: {
            create: { isSpecifier: false, specifiers: { _: { inputType: makeSchemaRef('CreateWorkerParams') } } },
            update: { isSpecifier: true, specifiers: { syncCheckHqEmployee: { inputType: makeSchemaRef('SyncParams') } } }
          }
        }
      }
    };
    const naming: McpToolGenerationNamingOptions = { modelSegments: new Map([['worker', 'wk']]) };

    const { tools } = generateMcpToolDefinitions(apiDetails, undefined, { naming });
    const names = tools.map((t) => t.name).sort();

    expect(names).toEqual(['wk-create', 'wk-syncCheckHqEmployee']);
  });

  it('falls back to the model type for models without a configured segment', () => {
    const naming: McpToolGenerationNamingOptions = { modelSegments: new Map([['other', 'xx']]) };
    const { tools } = generateMcpToolDefinitions(makeOneEntry(), undefined, { naming });

    expect(tools[0].name).toBe('guestbook-query');
  });
});
