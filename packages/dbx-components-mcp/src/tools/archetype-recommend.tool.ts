/**
 * `dbx_model_archetype_recommend` tool.
 *
 * Primary entry point for the model-archetype recommender. Takes a filled
 * questionnaire describing a proposed Firestore model and returns the ranked
 * archetype match, the resolved axes, the implied `collectionKind`, peer
 * models in scope that already use the matched archetype, and the alternatives
 * considered.
 *
 * Pure scoring lives in `./archetype/score.ts`; this file owns input parsing,
 * downstream-catalog plumbing, and markdown assembly.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type } from 'arktype';
import { FIREBASE_MODELS, getDownstreamCatalog, resolveModelArchetype, type DownstreamCatalog, type FirebaseModel, type ModelArchetypeInfo } from '../registry/index.js';
import { ensurePathInsideCwd } from './validate-input.js';
import { toolError, type DbxTool, type ToolResult } from './types.js';
import { scoreCatalog, type ScoredArchetype } from './archetype/score.js';
import { deriveAddons, deriveAxes, deriveAxisAlternatives, type ResolvedAxes } from './archetype/axes.js';
import { formatRecommendation } from './archetype/format.js';
import type { ArchetypeQuestionnaire } from './archetype/types.js';

type RecommendScope = 'all' | 'upstream' | 'downstream';

const DEFAULT_PEER_COUNT = 5;
const DEFAULT_MAX_RESULTS = 3;

const QuestionnaireType = type({
  'candidateName?': 'string',
  'candidateGroup?': 'string',
  'domainDescription?': 'string',
  'docIdSource?': "'auto' | 'parent-id' | 'user-uid' | 'external-vendor-id' | 'geo-key' | 'bucket-code' | 'composite-flat-key' | 'numeric-short-id' | 'fixed'",
  'parentRelation?': "'none' | 'one-parent' | 'many-parents' | 'user-uid' | 'external-vendor-id' | 'region-key' | 'district-key' | 'composite-key'",
  'parentModelType?': 'string',
  'instancesPerParent?': "'one' | 'many'",
  'userRelation?': "'none' | 'owned-by-uid' | 'uid-is-doc-id' | 'references-user-key' | 'external-vendor-id-is-doc-id'",
  'isDenormalization?': 'boolean',
  'denormalizesFrom?': 'string[]',
  'aggregatesFrom?': 'string[]',
  'isSiblingAggregate?': 'boolean',
  'hasInheritance?': 'boolean',
  'isExternalMirror?': 'boolean',
  'externalSystemName?': 'string',
  'isEventLog?': 'boolean',
  'syncMode?': "'always-in-sync' | 'trigger-eventual' | 'flag-eventual' | 'scheduled-rebuild' | 'append-only' | 'pull-on-demand' | 'external-bidirectional'",
  'hasSyncFlag?': 'boolean',
  'hasLifecycleStates?': 'boolean',
  'lifecycleStateExamples?': 'string[]',
  'mutability?': "'mutable' | 'immutable'",
  'hasArchiveCounterpart?': 'boolean',
  'archiveCounterpartName?': 'string',
  'actors?': 'string[]',
  'hasSensitiveFields?': 'boolean',
  'needsFineGrainedPermissions?': 'boolean',
  'isGroupRoot?': 'boolean',
  'hasMembers?': 'boolean',
  'needsMemberSummary?': 'boolean',
  'isTreeNode?': 'boolean',
  'involvesFileUpload?': 'boolean',
  'sendsMessageToUser?': 'boolean',
  'isMultiCheckpointWorkflow?': 'boolean',
  'isSubsystemSingleton?': 'boolean',
  'estimatedItemsPerParent?': "'0-50' | '50-500' | '500+' | 'unknown'",
  'alwaysReadWithParent?': 'boolean'
});

const RecommendArgsType = type({
  questionnaire: QuestionnaireType,
  'archetypeHint?': 'string',
  'scope?': "'all' | 'upstream' | 'downstream'",
  'componentDirs?': 'string[]',
  'maxResults?': 'number',
  'peerCount?': 'number',
  'includeFieldLevelAddons?': 'boolean'
});

const DBX_MODEL_ARCHETYPE_RECOMMEND_TOOL: Tool = {
  name: 'dbx_model_archetype_recommend',
  description: [
    'Given a structured questionnaire describing a proposed Firestore model, returns the best-matching archetype, its derived axis values, the implied `collectionKind`, peer models that already use the archetype, and the alternatives considered.',
    '',
    'Use during the design phase (Phase 2 of `dbx__guide__design-models`), BEFORE scaffolding the model files. Pair with `dbx_model_archetype_lookup` to browse the catalog and `dbx_model_archetype_search` to find more peers.',
    '',
    'Optional inputs:',
    '  • `scope`: `"all"` (default), `"upstream"`, or `"downstream"` for the peer-model search.',
    '  • `componentDirs`: explicit downstream component directories — overrides the default `components/*-firebase` discovery.',
    '  • `archetypeHint`: free-form override (any archetype slug). Scoring still runs; the recommender compares the hint against the data-driven answer.',
    '  • `peerCount`: max peer models to surface (default 5).',
    '  • `maxResults`: max alternatives to surface (default 3).',
    '  • `includeFieldLevelAddons`: emit the `Field-level add-ons` line (default true).'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      questionnaire: {
        type: 'object',
        description: 'Filled questionnaire describing the proposed model.',
        additionalProperties: true
      },
      archetypeHint: {
        type: 'string',
        description: 'Optional override (any archetype slug) to bias toward a known answer.'
      },
      scope: {
        type: 'string',
        enum: ['all', 'upstream', 'downstream'],
        default: 'all'
      },
      componentDirs: {
        type: 'array',
        items: { type: 'string' }
      },
      maxResults: { type: 'integer', default: DEFAULT_MAX_RESULTS },
      peerCount: { type: 'integer', default: DEFAULT_PEER_COUNT },
      includeFieldLevelAddons: { type: 'boolean', default: true }
    },
    required: ['questionnaire']
  }
};

interface ParsedRecommendArgs {
  readonly questionnaire: ArchetypeQuestionnaire;
  readonly archetypeHint: string | undefined;
  readonly scope: RecommendScope;
  readonly componentDirs: readonly string[] | undefined;
  readonly maxResults: number;
  readonly peerCount: number;
  readonly includeFieldLevelAddons: boolean;
}

function parseArgs(raw: unknown): ParsedRecommendArgs {
  const parsed = RecommendArgsType(raw);
  if (parsed instanceof type.errors) {
    throw new TypeError(`Invalid arguments: ${parsed.summary}`);
  }
  const result: ParsedRecommendArgs = {
    questionnaire: parsed.questionnaire as ArchetypeQuestionnaire,
    archetypeHint: parsed.archetypeHint,
    scope: (parsed.scope ?? 'all') as RecommendScope,
    componentDirs: parsed.componentDirs,
    maxResults: parsed.maxResults ?? DEFAULT_MAX_RESULTS,
    peerCount: parsed.peerCount ?? DEFAULT_PEER_COUNT,
    includeFieldLevelAddons: parsed.includeFieldLevelAddons ?? true
  };
  return result;
}

interface BuildPeerPoolInput {
  readonly archetype: ModelArchetypeInfo;
  readonly axes: ResolvedAxes;
  readonly scope: RecommendScope;
  readonly downstream: DownstreamCatalog;
  readonly limit: number;
}

function buildPeerPool(input: BuildPeerPoolInput): readonly FirebaseModel[] {
  const pool: FirebaseModel[] = [];
  if (input.scope !== 'downstream') pool.push(...FIREBASE_MODELS);
  if (input.scope !== 'upstream') pool.push(...input.downstream.models);
  const slug = input.archetype.slug;
  const matched = pool.filter((m) => m.archetypes?.includes(slug) === true);
  // Try axis-tightened filter first; fall back to slug-only if the tightened filter is empty.
  const axisFilter = Object.entries(input.axes);
  let final = matched;
  if (axisFilter.length > 0) {
    const tightened = matched.filter((m) => {
      let ok = true;
      const slugAxes = m.archetypeAxesBySlug?.[slug];
      for (const [k, v] of axisFilter) {
        if (slugAxes?.[k] !== v) {
          ok = false;
          break;
        }
      }
      return ok;
    });
    if (tightened.length > 0) final = tightened;
  }
  return final.slice(0, input.limit);
}

const EMPTY_DOWNSTREAM_CATALOG: DownstreamCatalog = {
  models: [],
  modelGroups: [],
  packages: [],
  errors: [],
  discoveryUsed: false
};

/**
 * Handler for `dbx_model_archetype_recommend`.
 *
 * @param rawArgs - the unvalidated tool arguments
 * @returns the rendered recommendation, or an error result on validation failure
 */
export async function runArchetypeRecommend(rawArgs: unknown): Promise<ToolResult> {
  let args: ParsedRecommendArgs;
  try {
    args = parseArgs(rawArgs);
  } catch (err) {
    return toolError(err instanceof Error ? err.message : String(err));
  }

  const cwd = process.cwd();
  if (args.componentDirs) {
    try {
      for (const dir of args.componentDirs) ensurePathInsideCwd(dir, cwd);
    } catch (err) {
      return toolError(err instanceof Error ? err.message : String(err));
    }
  }

  const downstream = args.scope === 'upstream' ? EMPTY_DOWNSTREAM_CATALOG : await getDownstreamCatalog({ workspaceRoot: cwd, componentDirs: args.componentDirs });

  const scoreResult = scoreCatalog(args.questionnaire);
  let top = scoreResult.top;
  if (args.archetypeHint) {
    const resolved = resolveModelArchetype(args.archetypeHint);
    if (resolved) {
      const hinted = scoreResult.ranked.find((r) => r.archetype.slug === resolved.archetype.slug);
      if (hinted) top = hinted;
    }
  }

  const axes = deriveAxes(top.archetype, args.questionnaire);
  const axisAlternatives = deriveAxisAlternatives(top.archetype, args.questionnaire);
  const addons = args.includeFieldLevelAddons ? deriveAddons(args.questionnaire) : [];
  const peers = buildPeerPool({
    archetype: top.archetype,
    axes,
    scope: args.scope,
    downstream,
    limit: args.peerCount
  });

  const alternatives: ScoredArchetype[] = scoreResult.ranked.filter((r) => r.archetype.slug !== top.archetype.slug).slice(0, args.maxResults);

  const scopeLabel = `scope=${args.scope}`;
  const text = formatRecommendation({
    top,
    tied: scoreResult.tied,
    axes,
    axisAlternatives,
    addons,
    peers,
    alternatives,
    scopeLabel,
    shortCircuited: scoreResult.shortCircuited && top.archetype.slug === scoreResult.top.archetype.slug
  });
  return { content: [{ type: 'text', text }] };
}

export const archetypeRecommendTool: DbxTool = {
  definition: DBX_MODEL_ARCHETYPE_RECOMMEND_TOOL,
  run: runArchetypeRecommend
};
