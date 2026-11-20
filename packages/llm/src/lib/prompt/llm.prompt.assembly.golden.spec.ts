/**
 * The byte replica — every byte-parity rule of the layout-driven assembly, pinned as golden literals.
 *
 * What a byte golden protects: a lost or doubled separator is invisible to `toContain`, and a prompt's cache prefix
 * moves silently when one piece changes its closing bytes. These literals are the captured goldens of the host this
 * assembly was extracted from, reproduced here through {@link assembleLlmCapabilityPrompt} and
 * {@link composeLlmCapabilityPrompt} over that host's (lettered) layout, its contract intro and footer passed through
 * `texts`, and two of its long prose constants swapped for the marked stand-ins `LINE-PROTOCOL` and `MUST-RESOLVE`.
 * The host-side rules (voice-keyed reply protocols, first-by-layer templates, frames) run through spec-local
 * stand-ins for its resolver and contributors, proving the seam carries them; the host's line-manner clause (stand-in
 * `LINE-MANNER`) arrives through a host contributor in its own frame slot, as segment `A-amendment`.
 *
 * A deliberate byte change must recapture these literals in a commit that says so.
 */
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { type LlmCapabilityDescriptor, type LlmCapabilityDescriptorReader } from '../capability/llm.capability.descriptor';
import { type LlmDispatchRequest } from '../dispatch/llm.dispatch.request';
import { resolveLlmReplyProtocol } from '../reply/llm.reply.protocol';
import { assembleLlmCapabilityPrompt, composeLlmCapabilityPrompt, type ComposeLlmCapabilityPromptConfig, type LlmAssembledPrompt, type LlmComposedCapabilityPrompt, type LlmPromptAssemblyTexts, type LlmPromptTemplateSegmentOrigin } from './llm.prompt.assembly';
import { type LlmPromptContribution, type LlmPromptContributor, resolveLlmPromptContributions } from './llm.prompt.contributor';
import { llmPromptCacheHash } from './llm.prompt.hash';
import { type LlmPromptLayout } from './llm.prompt.layout';
import { type LlmLiveContextBlock, type LlmLiveContextInput, llmLiveContextHeadingBlock } from './llm.prompt.live.context';
import { llmModelAddendumContribution, makeLlmModelAddendumPromptContributor, llmModelAddendumSegment } from './llm.prompt.model.addendum';
import { type LlmPromptSegment, llmPromptSegmentSpans } from './llm.prompt.segment';
import { type LlmPromptTemplate, type LlmPromptTemplateResolver, type LlmPromptTemplateTier, type LlmResolvedPromptTemplate, type LlmResolvedPromptTemplates } from './llm.prompt.template';

// MARK: Fixture
/**
 * The LETTERED layout of `llm.prompt.layout.spec.ts`, plus the host's line-manner frame slot `A-manner`.
 */
const LETTERED_LAYOUT: LlmPromptLayout = [
  { id: 'model-addendum', role: 'model-addendum', occupancy: 'single', separator: '\n\n' },
  { id: 'A0', role: 'frame', occupancy: 'single', separator: '\n\n' },
  { id: 'A0.5', role: 'frame', occupancy: 'single', separator: '\n\n' },
  { id: 'A0.7', role: 'frame', occupancy: 'single', separator: '\n\n' },
  { id: 'A', role: 'reply-protocol', occupancy: 'single', separator: '\n\n' },
  { id: 'A-amendment', role: 'reply-amendment', occupancy: 'single', separator: '\n\n' },
  { id: 'A-manner', role: 'frame', occupancy: 'single', separator: '\n\n' },
  { id: 'B', role: 'instructions', occupancy: 'single', separator: '\n\n' },
  { id: 'C-pre', role: 'context-pre', occupancy: 'single', separator: '\n\n' },
  { id: 'contract', role: 'contract', occupancy: 'single', separator: '\n\n' },
  { id: 'B1', role: 'frame', occupancy: 'single', separator: '\n\n' },
  { id: 'craft', role: 'craft', occupancy: 'many', separator: '\n\n' },
  { id: 'D', role: 'live', occupancy: 'many', separator: '\n\n', lastSeparator: '' },
  { id: 'C-post', role: 'context-post', occupancy: 'single', separator: '' },
  { id: 'correction', role: 'correction', occupancy: 'single', separator: '' },
  { id: 'follow-up', role: 'follow-up', occupancy: 'single', separator: '' }
];

const REPLICA_TEXTS: LlmPromptAssemblyTexts = {
  lineReplyProtocol: 'LINE-PROTOCOL',
  mustResolveClause: 'MUST-RESOLVE',
  outputContractIntro: 'Return the `lever` as a JSON object with these fields:',
  outputContractFooter: 'Never invent an id. Every id MUST be one shown in the live context below.'
};

const CORPUS: LlmPromptTemplateTier = {
  source: 'corpus',
  templates: [
    { key: 'reply-protocol:character', role: 'reply-protocol', text: 'A-PROTOCOL' },
    { key: 'reply-protocol:director', role: 'reply-protocol', text: 'A-DIRECTOR' },
    { key: 'reply-protocol:prose', role: 'reply-protocol', text: 'A-PROSE' },
    { key: 'story-frame:character', text: 'A0-CHAR tone={{storyTone}}' },
    { key: 'story-frame:director', text: 'A0-DIRECTOR tone={{storyTone}}' },
    { key: 'story-frame:prose', text: 'A0-PROSE tone={{storyTone}}' },
    { key: 'writing-style-frame:character', text: 'A07-CHAR style={{writingStyle}}' },
    { key: 'writing-style-frame:director', text: 'A07-DIRECTOR style={{writingStyle}}' },
    { key: 'writing-style-frame:prose', text: 'A07-PROSE style={{writingStyle}}' },
    { key: 'perspective-frame:story:prose', text: 'A05-STORY-PROSE {{focalName}}|{{narrativePerson}}|{{narrativeTense}}' },
    { key: 'cap:resolve', role: 'instructions', capability: 'resolve', text: 'B-RESOLVE' },
    { key: 'ctx:resolve', role: 'context', capability: 'resolve', text: 'C-RESOLVE-PRE\n{{liveContext}}\nC-RESOLVE-POST' },
    { key: 'cap:speak', role: 'instructions', capability: 'speak', text: 'B-VOICE' },
    { key: 'ctx:speak', role: 'context', capability: 'speak', text: 'C-VOICE-NOMARKER' },
    { key: 'cap:narrate', role: 'instructions', capability: 'narrate', text: 'B-BEAT' },
    { key: 'ctx:narrate', role: 'context', capability: 'narrate', text: '{{liveContext}}' },
    { key: 'cap:interpret', role: 'instructions', capability: 'interpret', text: 'B-COMM' },
    { key: 'ctx:interpret', role: 'context', capability: 'interpret', text: '{{liveContext}}' }
  ]
};

interface ReplicaTraits {
  readonly voice?: string;
  readonly readerFacing?: boolean;
  readonly speaking?: boolean;
}

type ReplicaDescriptor = LlmCapabilityDescriptor<unknown, ReplicaTraits>;

interface ReplicaPerspective {
  readonly mode: string;
  readonly person: string;
  readonly tense: string;
  readonly focalName?: string;
}

interface ReplicaRequest extends LlmDispatchRequest {
  readonly tone?: string;
  readonly style?: string;
  readonly perspective?: ReplicaPerspective;
  readonly speech?: string;
  readonly lineManner?: boolean;
}

const RESOLVE_CONTRACT = {
  type: 'object',
  properties: {
    accept: { type: 'object', properties: { ref: { type: 'number' }, via: { type: 'number' } }, required: ['ref', 'via'] },
    clearRejections: { type: 'boolean' },
    composeAs: { type: 'object', properties: { templateId: { type: 'number' }, tone: { type: 'number' } }, required: ['templateId', 'tone'] },
    dropThreadPredicates: { type: 'array', items: { type: 'number' } }
  }
};

const NARRATE_CONTRACT = { type: 'object', properties: { narrative: { type: 'string' }, beats: { type: 'array', items: { type: 'string' } } }, required: ['narrative'] };

const SPEAK_CONTRACT = {
  type: 'object',
  properties: {
    line: { type: 'string' },
    affect: { type: 'object', properties: { congruence: { enum: ['congruent', 'incongruent'] }, desire: { type: 'number' }, magnitude: { type: 'number' } }, required: ['congruence', 'desire', 'magnitude'] },
    voicing: { type: 'array', items: { type: 'string' } }
  },
  required: ['line']
};

const INTERPRET_CONTRACT = {
  type: 'object',
  properties: {
    kind: { enum: ['command', 'exclamation', 'greeting', 'question', 'statement'] },
    tokens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          predicate: { anyOf: [{ type: 'number' }, { type: 'string' }] },
          lane: { enum: ['content', 'premise'] },
          negated: { type: 'boolean' },
          objectConcept: { anyOf: [{ type: 'number' }, { type: 'string' }] },
          objectEntity: { type: 'number' },
          scalar: { type: 'number' },
          subjectEntity: { type: 'number' },
          subjectRole: { enum: ['listener', 'speaker', 'world'] }
        },
        required: ['predicate']
      }
    },
    gist: { type: 'string' },
    terms: { type: 'array', items: { type: 'object', properties: { term: { type: 'string' }, negated: { type: 'boolean' }, variants: { type: 'array', items: { type: 'string' } } }, required: ['term'] } }
  },
  required: ['kind', 'tokens']
};

function replicaDescriptor(capability: string, contract: object, extra: Partial<ReplicaDescriptor> = {}): ReplicaDescriptor {
  return { capability, responseSchema: type('object'), parseValue: (value) => value, responseSchemaHint: () => contract, contractSchemaHint: () => contract, ...extra };
}

const DESCRIPTORS: Readonly<Record<string, ReplicaDescriptor>> = {
  resolve: replicaDescriptor('resolve', RESOLVE_CONTRACT),
  speak: replicaDescriptor('speak', SPEAK_CONTRACT, { traits: { voice: 'prose', speaking: true } }),
  narrate: replicaDescriptor('narrate', NARRATE_CONTRACT, { traits: { voice: 'prose', readerFacing: true } }),
  interpret: replicaDescriptor('interpret', INTERPRET_CONTRACT, { traits: { voice: 'director' }, mustResolve: true })
};

const DESCRIPTOR_OF: LlmCapabilityDescriptorReader<ReplicaDescriptor> = (capability) => DESCRIPTORS[capability];

interface ReplicaMergedTemplate {
  readonly template: LlmPromptTemplate;
  readonly source: string;
}

function resolvedOf(entry: ReplicaMergedTemplate): LlmResolvedPromptTemplate {
  return { key: entry.template.key, text: entry.template.text, source: entry.source };
}

/**
 * A stand-in for the host's template cascade: merged with `Map.set` (an overridden key keeps its FIRST position, and
 * the text and source of its last definition); the reply protocol keyed by the descriptor's voice with a `character`
 * fallback; instructions and context the first merged template of that role scoped to the capability.
 *
 * @param tiers - The tiers, lowest first.
 * @returns The resolver.
 */
function replicaResolver(tiers: ReadonlyArray<LlmPromptTemplateTier>): LlmPromptTemplateResolver<ReplicaRequest, ReplicaDescriptor> {
  const merged = new Map<string, ReplicaMergedTemplate>();
  tiers.forEach((tier) => tier.templates.forEach((template) => merged.set(template.key, { template, source: tier.source })));
  const all = Array.from(merged.values());
  const byKey = (key: string) => {
    const entry = merged.get(key);
    return entry == null ? undefined : resolvedOf(entry);
  };

  return ({ request, descriptor }) => {
    const scoped = (role: LlmPromptTemplate['role']) => {
      const entry = all.find((x) => x.template.role === role && x.template.capability === request.capability);
      return entry == null ? undefined : resolvedOf(entry);
    };
    const replyProtocol = byKey(`reply-protocol:${descriptor?.traits?.voice ?? 'character'}`) ?? byKey('reply-protocol:character');
    const instructions = scoped('instructions');
    const context = scoped('context');
    const templates: LlmResolvedPromptTemplates = {
      roles: { ...(replyProtocol == null ? {} : { 'reply-protocol': replyProtocol }), ...(instructions == null ? {} : { instructions }), ...(context == null ? {} : { context }) },
      byKey
    };
    return Promise.resolve(templates);
  };
}

interface ReplicaFrameConfig {
  readonly slot: string;
  readonly template: LlmResolvedPromptTemplate;
  readonly fills: ReadonlyArray<readonly [string, string]>;
}

function replicaFrame(config: ReplicaFrameConfig): LlmPromptContribution {
  const { slot, template, fills } = config;
  const text = fills.reduce((body, [marker, value]) => body.split(marker).join(value), template.text);
  const origin: LlmPromptTemplateSegmentOrigin = { kind: 'template', templateKey: template.key, ...(template.source == null ? {} : { source: template.source }), fills: fills.map(([marker]) => marker) };
  return { contributor: 'frames', slot, id: slot, key: template.key, text, origin, reason: `the ${slot} frame` };
}

/**
 * A stand-in for the host's frames contributor: tone, perspective and style frames before the reply protocol, the
 * speech block after the contract. A blank tone, style or speech places nothing; a filled value is placed untrimmed.
 */
const REPLICA_FRAMES: LlmPromptContributor<ReplicaRequest, ReplicaDescriptor> = {
  id: 'frames',
  slots: ['A0', 'A0.5', 'A0.7', 'B1'],
  resolve: ({ request, descriptor, templates }) => {
    const contributions: LlmPromptContribution[] = [];

    if (descriptor != null) {
      const voice = descriptor.traits?.voice ?? 'character';
      const familyOf = (family: string) => (templates.byKey(`${family}:${voice}`) ?? templates.byKey(`${family}:character`)) as LlmResolvedPromptTemplate;
      const { tone, style, perspective, speech } = request;

      if (tone != null && tone.trim() !== '') {
        contributions.push(replicaFrame({ slot: 'A0', template: familyOf('story-frame'), fills: [['{{storyTone}}', tone]] }));
      }

      const perspectiveTemplate = perspective == null ? undefined : (templates.byKey(`perspective-frame:${perspective.mode}:${voice}`) ?? templates.byKey(`perspective-frame:${perspective.mode}:prose`));

      if (descriptor.traits?.readerFacing === true && perspective != null && perspectiveTemplate != null) {
        contributions.push(
          replicaFrame({
            slot: 'A0.5',
            template: perspectiveTemplate,
            fills: [
              ['{{focalName}}', perspective.focalName ?? ''],
              ['{{narrativePerson}}', perspective.person],
              ['{{narrativeTense}}', perspective.tense]
            ]
          })
        );
      }

      if (style != null && style.trim() !== '') {
        contributions.push(replicaFrame({ slot: 'A0.7', template: familyOf('writing-style-frame'), fills: [['{{writingStyle}}', style]] }));
      }

      if (descriptor.traits?.speaking === true && speech != null && speech.trim() !== '') {
        contributions.push({ contributor: 'frames', slot: 'B1', id: 'B1', text: speech, origin: { kind: 'speech-style' }, reason: 'the speech block' });
      }
    }

    return { contributions };
  }
};

/**
 * A stand-in for the host's line-manner contributor: when the host's request asks and the effective protocol is
 * `line`, the host's clause in its own frame slot, as segment `A-amendment`.
 */
const REPLICA_LINE_MANNER: LlmPromptContributor<ReplicaRequest, ReplicaDescriptor> = {
  id: 'line-manner',
  slots: ['A-manner'],
  resolve: ({ request, descriptor }) => {
    const asked = request.lineManner === true && resolveLlmReplyProtocol({ request, descriptor, defaultReplyProtocol: 'json-envelope' }) === 'line';
    return { contributions: asked ? [{ contributor: 'line-manner', slot: 'A-manner', id: 'A-amendment', text: 'LINE-MANNER', origin: { kind: 'generated', generator: 'line-manner-amendment' }, reason: 'the host asks a line call for its delivery note' }] : [] };
  }
};

const ADDENDA: Readonly<Record<string, string>> = { 'census/fast': 'ADDENDUM for census/fast' };

/**
 * The library's model-addendum contributor: the resolved model's addendum, first.
 */
const REPLICA_ADDENDUM: LlmPromptContributor<ReplicaRequest, ReplicaDescriptor> = makeLlmModelAddendumPromptContributor<ReplicaRequest, ReplicaDescriptor>({ promptAddendumByModel: ADDENDA });

const D_LIVE = '## Live context\n\nDirective: hold the line.\n\nCast:\n- Ben\n- Mara';

const D_BLOCKS: ReadonlyArray<LlmLiveContextBlock> = [llmLiveContextHeadingBlock(), { key: 'directive', text: 'Directive: hold the line.' }, { key: 'cast', text: 'Cast:\n- Ben\n- Mara' }];

const STORY_PERSPECTIVE: ReplicaPerspective = { mode: 'story', person: 'third', tense: 'past', focalName: 'Ben' };

function replicaRequest(capability: string, extra: Partial<ReplicaRequest> = {}): ReplicaRequest {
  return { capability, renderLiveContext: () => D_BLOCKS, ...extra };
}

interface AssembleReplicaConfig {
  readonly tiers?: ReadonlyArray<LlmPromptTemplateTier>;
  readonly liveContext?: LlmLiveContextInput;
  readonly contributions?: ReadonlyArray<LlmPromptContribution>;
}

/**
 * Path (a): the awaited resolver output, the frames stand-in's contributions and a pre-joined live context through
 * the synchronous assembly.
 *
 * @param request - The request.
 * @param config - Tier, live context and extra contribution overrides.
 * @returns The assembled prompt.
 */
async function assembleReplica(request: ReplicaRequest, config: AssembleReplicaConfig = {}): Promise<LlmAssembledPrompt> {
  const descriptor = DESCRIPTOR_OF(request.capability);
  const templates = await replicaResolver(config.tiers ?? [CORPUS])({ request, descriptor });
  const { contributions } = await resolveLlmPromptContributions([REPLICA_FRAMES, REPLICA_LINE_MANNER], { request, descriptor, templates, liveBlockKeys: [] });
  return assembleLlmCapabilityPrompt({
    layout: LETTERED_LAYOUT,
    capability: request.capability,
    descriptor,
    templates,
    liveContext: config.liveContext ?? D_LIVE,
    replyProtocol: request.replyProtocol,
    defaultReplyProtocol: 'json-envelope',
    contributions: [...contributions, ...(config.contributions ?? [])],
    texts: REPLICA_TEXTS
  });
}

/**
 * Path (b): the whole pipeline over the block-form live context.
 *
 * @param request - The request.
 * @param extra - Compose overrides.
 * @returns The composed prompt.
 */
function composeReplica(request: ReplicaRequest, extra: Partial<ComposeLlmCapabilityPromptConfig<ReplicaRequest, ReplicaDescriptor>> = {}): Promise<LlmComposedCapabilityPrompt> {
  return composeLlmCapabilityPrompt<ReplicaRequest, ReplicaDescriptor>({
    request,
    layout: LETTERED_LAYOUT,
    descriptorOf: DESCRIPTOR_OF,
    templateResolver: replicaResolver([CORPUS]),
    contributors: [REPLICA_ADDENDUM, REPLICA_FRAMES, REPLICA_LINE_MANNER],
    defaultReplyProtocol: 'json-envelope',
    texts: REPLICA_TEXTS,
    ...extra
  });
}

function idsOf(assembled: LlmAssembledPrompt): ReadonlyArray<string> {
  return assembled.segments.map((segment) => segment.id);
}

function segmentOf(assembled: LlmAssembledPrompt, id: string): LlmPromptSegment | undefined {
  return assembled.segments.find((segment) => segment.id === id);
}

// MARK: Golden shapes
interface GoldenShape {
  readonly name: string;
  readonly request: ReplicaRequest;
  readonly live?: ReadonlyArray<LlmLiveContextBlock>;
  readonly liveText?: string;
  readonly ids: ReadonlyArray<string>;
  readonly prompt: string;
  readonly cachePrefix: string;
}

const GOLDEN_SHAPES: ReadonlyArray<GoldenShape> = [
  {
    name: 'json + marker context with prose after the marker',
    request: replicaRequest('resolve'),
    ids: ['A', 'B', 'C-pre', 'contract', 'D', 'C-post'],
    prompt:
      'A-PROTOCOL\n\nB-RESOLVE\n\nC-RESOLVE-PRE\n## Output contract\n\nReturn the `lever` as a JSON object with these fields:\n- `accept` (object { ref: number, via: number }, optional)\n- `clearRejections` (boolean, optional)\n- `composeAs` (object { templateId: number, tone: number }, optional)\n- `dropThreadPredicates` (number[], optional)\n\nNever invent an id. Every id MUST be one shown in the live context below.\n\n## Live context\n\nDirective: hold the line.\n\nCast:\n- Ben\n- Mara\nC-RESOLVE-POST',
    cachePrefix:
      'A-PROTOCOL\n\nB-RESOLVE\n\nC-RESOLVE-PRE\n## Output contract\n\nReturn the `lever` as a JSON object with these fields:\n- `accept` (object { ref: number, via: number }, optional)\n- `clearRejections` (boolean, optional)\n- `composeAs` (object { templateId: number, tone: number }, optional)\n- `dropThreadPredicates` (number[], optional)\n\nNever invent an id. Every id MUST be one shown in the live context below.\n\n'
  },
  {
    name: 'line + no-marker context',
    request: replicaRequest('speak', { replyProtocol: 'line' }),
    ids: ['A', 'B', 'C-pre', 'D'],
    prompt: 'LINE-PROTOCOL\n\nB-VOICE\n\nC-VOICE-NOMARKER\n\n## Live context\n\nDirective: hold the line.\n\nCast:\n- Ben\n- Mara',
    cachePrefix: 'LINE-PROTOCOL\n\nB-VOICE\n\nC-VOICE-NOMARKER\n\n'
  },
  {
    name: 'reader-facing: tone + perspective + style',
    request: replicaRequest('narrate', { tone: 'gritty survival', perspective: STORY_PERSPECTIVE, style: 'Diction: terse.' }),
    ids: ['A0', 'A0.5', 'A0.7', 'A', 'B', 'C-pre', 'contract', 'D'],
    prompt:
      'A0-PROSE tone=gritty survival\n\nA05-STORY-PROSE Ben|third|past\n\nA07-PROSE style=Diction: terse.\n\nA-PROSE\n\nB-BEAT\n\n## Output contract\n\nReturn the `lever` as a JSON object with these fields:\n- `narrative` (string, required)\n- `beats` (string[], optional)\n\nNever invent an id. Every id MUST be one shown in the live context below.\n\n## Live context\n\nDirective: hold the line.\n\nCast:\n- Ben\n- Mara',
    cachePrefix:
      'A0-PROSE tone=gritty survival\n\nA05-STORY-PROSE Ben|third|past\n\nA07-PROSE style=Diction: terse.\n\nA-PROSE\n\nB-BEAT\n\n## Output contract\n\nReturn the `lever` as a JSON object with these fields:\n- `narrative` (string, required)\n- `beats` (string[], optional)\n\nNever invent an id. Every id MUST be one shown in the live context below.\n\n'
  },
  {
    name: 'speaking: tone + style + B1 speech block',
    request: replicaRequest('speak', { tone: 'gritty survival', style: 'Diction: terse.', speech: '## How this character speaks\n\nClipped.' }),
    ids: ['A0', 'A0.7', 'A', 'B', 'C-pre', 'contract', 'B1', 'D'],
    prompt:
      'A0-PROSE tone=gritty survival\n\nA07-PROSE style=Diction: terse.\n\nA-PROSE\n\nB-VOICE\n\nC-VOICE-NOMARKER\n\n## Output contract\n\nReturn the `lever` as a JSON object with these fields:\n- `line` (string, required)\n- `affect` (object { congruence: "congruent" | "incongruent", desire: number, magnitude: number }, optional)\n- `voicing` (string[], optional)\n\nNever invent an id. Every id MUST be one shown in the live context below.\n\n## How this character speaks\n\nClipped.\n\n## Live context\n\nDirective: hold the line.\n\nCast:\n- Ben\n- Mara',
    cachePrefix:
      'A0-PROSE tone=gritty survival\n\nA07-PROSE style=Diction: terse.\n\nA-PROSE\n\nB-VOICE\n\nC-VOICE-NOMARKER\n\n## Output contract\n\nReturn the `lever` as a JSON object with these fields:\n- `line` (string, required)\n- `affect` (object { congruence: "congruent" | "incongruent", desire: number, magnitude: number }, optional)\n- `voicing` (string[], optional)\n\nNever invent an id. Every id MUST be one shown in the live context below.\n\n## How this character speaks\n\nClipped.\n\n'
  },
  {
    name: 'mustResolve amendment',
    request: replicaRequest('interpret'),
    ids: ['A', 'A-amendment', 'B', 'C-pre', 'contract', 'D'],
    prompt:
      'A-DIRECTOR\n\nMUST-RESOLVE\n\nB-COMM\n\n## Output contract\n\nReturn the `lever` as a JSON object with these fields:\n- `kind` ("command" | "exclamation" | "greeting" | "question" | "statement", required)\n- `tokens` (object[], required): an array where each item is an object with:\n    - `predicate` (number | string, required)\n    - `lane` ("content" | "premise", optional)\n    - `negated` (boolean, optional)\n    - `objectConcept` (number | string, optional)\n    - `objectEntity` (number, optional)\n    - `scalar` (number, optional)\n    - `subjectEntity` (number, optional)\n    - `subjectRole` ("listener" | "speaker" | "world", optional)\n- `gist` (string, optional)\n- `terms` (object[], optional): an array where each item is an object with:\n    - `term` (string, required)\n    - `negated` (boolean, optional)\n    - `variants` (string[], optional)\n\nNever invent an id. Every id MUST be one shown in the live context below.\n\n## Live context\n\nDirective: hold the line.\n\nCast:\n- Ben\n- Mara',
    cachePrefix:
      'A-DIRECTOR\n\nMUST-RESOLVE\n\nB-COMM\n\n## Output contract\n\nReturn the `lever` as a JSON object with these fields:\n- `kind` ("command" | "exclamation" | "greeting" | "question" | "statement", required)\n- `tokens` (object[], required): an array where each item is an object with:\n    - `predicate` (number | string, required)\n    - `lane` ("content" | "premise", optional)\n    - `negated` (boolean, optional)\n    - `objectConcept` (number | string, optional)\n    - `objectEntity` (number, optional)\n    - `scalar` (number, optional)\n    - `subjectEntity` (number, optional)\n    - `subjectRole` ("listener" | "speaker" | "world", optional)\n- `gist` (string, optional)\n- `terms` (object[], optional): an array where each item is an object with:\n    - `term` (string, required)\n    - `negated` (boolean, optional)\n    - `variants` (string[], optional)\n\nNever invent an id. Every id MUST be one shown in the live context below.\n\n'
  },
  {
    name: 'no instructions / context at all',
    request: replicaRequest('unknown'),
    ids: ['A', 'D'],
    prompt: 'A-PROTOCOL\n\n## Live context\n\nDirective: hold the line.\n\nCast:\n- Ben\n- Mara',
    cachePrefix: 'A-PROTOCOL\n\n'
  },
  {
    name: 'an empty live context',
    request: replicaRequest('resolve', { renderLiveContext: () => [] }),
    liveText: '',
    ids: ['A', 'B', 'C-pre', 'contract', 'D', 'C-post'],
    prompt:
      'A-PROTOCOL\n\nB-RESOLVE\n\nC-RESOLVE-PRE\n## Output contract\n\nReturn the `lever` as a JSON object with these fields:\n- `accept` (object { ref: number, via: number }, optional)\n- `clearRejections` (boolean, optional)\n- `composeAs` (object { templateId: number, tone: number }, optional)\n- `dropThreadPredicates` (number[], optional)\n\nNever invent an id. Every id MUST be one shown in the live context below.\n\n\nC-RESOLVE-POST',
    cachePrefix:
      'A-PROTOCOL\n\nB-RESOLVE\n\nC-RESOLVE-PRE\n## Output contract\n\nReturn the `lever` as a JSON object with these fields:\n- `accept` (object { ref: number, via: number }, optional)\n- `clearRejections` (boolean, optional)\n- `composeAs` (object { templateId: number, tone: number }, optional)\n- `dropThreadPredicates` (number[], optional)\n\nNever invent an id. Every id MUST be one shown in the live context below.\n\n'
  }
];

const SHAPE = Object.fromEntries(GOLDEN_SHAPES.map((shape) => [shape.name, shape]));

describe('the golden replica', () => {
  describe('golden shapes', () => {
    for (const shape of GOLDEN_SHAPES) {
      it(`should reproduce the captured bytes through the assembly for: ${shape.name}`, async () => {
        const assembled = await assembleReplica(shape.request, { liveContext: shape.liveText ?? D_LIVE });

        expect(assembled.prompt).toBe(shape.prompt);
        expect(assembled.cacheSegments.cachePrefix).toBe(shape.cachePrefix);
        expect(assembled.cacheSegments.volatileSuffix).toBe(shape.prompt.slice(shape.cachePrefix.length));
        expect(idsOf(assembled)).toEqual(shape.ids);

        const spans = llmPromptSegmentSpans(assembled.segments);
        expect(spans[0]?.start).toBe(0);
        expect(spans.at(-1)?.end).toBe(shape.prompt.length);
        spans.forEach((span, index) => {
          expect(span.start).toBe(index === 0 ? 0 : spans[index - 1].end);
          expect(shape.prompt.slice(span.start, span.end)).toBe(span.segment.promptSegment);
        });
      });

      it(`should reproduce the captured bytes through compose for: ${shape.name}`, async () => {
        const composed = await composeReplica(shape.request);

        expect(composed.prompt).toBe(shape.prompt);
        expect(composed.cacheSegments.cachePrefix).toBe(shape.cachePrefix);
        expect(composed.cacheSegments.volatileSuffix).toBe(shape.prompt.slice(shape.cachePrefix.length));
      });
    }
  });

  describe('rules', () => {
    it('should place every slot in the documented order', () => {
      const templates: LlmResolvedPromptTemplates = {
        roles: { 'reply-protocol': { key: 'reply-protocol', text: 'A-PROTOCOL' }, instructions: { key: 'cap:test', text: 'B-CAP' }, context: { key: 'ctx:test', text: 'C-CTX\n{{liveContext}}\nC-POST' } },
        byKey: () => undefined
      };
      const contribution = (slot: string, text: string, extra: Partial<LlmPromptContribution> = {}): LlmPromptContribution => ({ contributor: 'host', slot, id: slot, text, origin: { kind: 'frame' }, reason: 'spec', ...extra });
      const contributions: ReadonlyArray<LlmPromptContribution> = [
        contribution('D', 'D-SUP', { key: 'sup' }),
        contribution('craft', 'CRAFT-STABLE', { key: 'craft-stable' }),
        contribution('craft', 'CRAFT-VOLATILE', { key: 'craft-judged', volatile: true }),
        contribution('B1', 'B1-SPEECH'),
        contribution('A0.7', 'A07-STYLE'),
        contribution('A0.5', 'A05-PERSPECTIVE'),
        contribution('A0', 'A0-TONE'),
        llmModelAddendumContribution({ model: 'm/x', promptAddendum: 'ADDENDUM' })
      ];
      const assembled = assembleLlmCapabilityPrompt({ layout: LETTERED_LAYOUT, capability: 'test', templates, liveContext: [llmLiveContextHeadingBlock(), { key: 'facts', text: 'facts: here' }], contributions, texts: REPLICA_TEXTS });

      expect(idsOf(assembled)).toEqual(['model-addendum', 'A0', 'A0.5', 'A0.7', 'A', 'B', 'C-pre', 'B1', 'craft', 'craft', 'D', 'D', 'D', 'C-post']);
      expect(assembled.segments.filter((segment) => segment.id === 'craft').map((segment) => segment.key)).toEqual(['craft-stable', 'craft-judged']);
      expect(assembled.segments.filter((segment) => segment.id === 'D').map((segment) => segment.key)).toEqual(['heading', 'facts', 'sup']);
      expect(assembled.prompt).toBe('ADDENDUM\n\nA0-TONE\n\nA05-PERSPECTIVE\n\nA07-STYLE\n\nA-PROTOCOL\n\nB-CAP\n\nC-CTX\nB1-SPEECH\n\nCRAFT-STABLE\n\nCRAFT-VOLATILE\n\n## Live context\n\nfacts: here\n\nD-SUP\nC-POST');
      expect(assembled.cacheSegments.cachePrefix.endsWith('CRAFT-STABLE\n\n')).toBe(true);
      expect(assembled.segments[0]).toEqual(llmModelAddendumSegment({ model: 'm/x', promptAddendum: 'ADDENDUM', layout: LETTERED_LAYOUT }));
    });

    it('should split at the first marker only and keep later markers literal', async () => {
      const workspace: LlmPromptTemplateTier = { source: 'workspace', templates: [{ key: 'ctx:resolve', role: 'context', capability: 'resolve', text: 'PRE\n{{liveContext}}\nMID\n{{liveContext}}\nPOST' }] };
      const assembled = await assembleReplica(replicaRequest('resolve'), { tiers: [CORPUS, workspace] });
      expect(segmentOf(assembled, 'C-pre')?.promptSegment).toBe('PRE\n');
      expect(segmentOf(assembled, 'C-post')?.promptSegment).toBe('\nMID\n{{liveContext}}\nPOST');
    });

    it('should place an empty context-pre and no context-post when the marker opens the body', async () => {
      for (const name of ['reader-facing: tone + perspective + style', 'mustResolve amendment']) {
        const assembled = await assembleReplica(SHAPE[name].request);
        expect(segmentOf(assembled, 'C-pre')?.promptSegment).toBe('');
        expect(idsOf(assembled)).not.toContain('C-post');
      }
    });

    it('should record the marker fill on both halves of a marker context, and no fills without a marker', async () => {
      const origin = { kind: 'template', templateKey: 'ctx:resolve', source: 'corpus', fills: ['{{liveContext}}'] };
      const resolved = await assembleReplica(SHAPE['json + marker context with prose after the marker'].request);
      expect(segmentOf(resolved, 'C-pre')?.origin).toEqual(origin);
      expect(segmentOf(resolved, 'C-post')?.origin).toEqual(origin);

      const spoken = await assembleReplica(SHAPE['line + no-marker context'].request);
      expect(segmentOf(spoken, 'C-pre')?.origin).toEqual({ kind: 'template', templateKey: 'ctx:speak', source: 'corpus' });
    });

    it('should keep an empty live context as one empty volatile segment', async () => {
      const shape = SHAPE['an empty live context'];
      const assembled = await assembleReplica(shape.request, { liveContext: '' });
      const live = assembled.segments.filter((segment) => segment.id === 'D');
      expect(live).toHaveLength(1);
      expect(live[0]).toMatchObject({ promptSegment: '', volatile: true });
      expect('key' in live[0]).toBe(false);
    });

    it('should anchor a live contribution on a block before the empty filter drops it', async () => {
      const sup: LlmPromptContribution = { contributor: 'host', slot: 'D', id: 'D', key: 'sup', text: 'D-SUP', origin: { kind: 'supplement' }, reason: 'spec', anchor: { after: 'heading' } };
      const assembled = await assembleReplica(replicaRequest('resolve'), {
        liveContext: [
          { key: 'heading', text: '' },
          { key: 'facts', text: 'facts: here' }
        ],
        contributions: [sup]
      });
      expect(assembled.segments.filter((segment) => segment.id === 'D').map((segment) => segment.key)).toEqual(['sup', 'facts']);
      expect(assembled.prompt).toContain('\n\nD-SUP\n\nfacts: here\nC-RESOLVE-POST');
    });

    it('should force the last block volatile when every block declares itself stable, replacing its reason', async () => {
      const assembled = await assembleReplica(replicaRequest('resolve'), {
        liveContext: [
          { key: 'heading', text: '## Live context', volatile: false },
          { key: 'cast', text: 'Cast:\n- Ben', volatile: false, reason: 'the cast rarely changes' }
        ]
      });
      const live = assembled.segments.filter((segment) => segment.id === 'D');
      expect(live.map((segment) => segment.volatile)).toEqual([false, true]);
      expect(live[1].reason).toContain('forced volatile');
      expect(assembled.cacheSegments.volatileSuffix).toBe('Cast:\n- Ben\nC-RESOLVE-POST');
    });

    it('should fall back to the character reply protocol when the voice has none', async () => {
      const corpus: LlmPromptTemplateTier = { source: 'corpus', templates: CORPUS.templates.filter((template) => template.key !== 'reply-protocol:prose') };
      const assembled = await assembleReplica(replicaRequest('narrate'), { tiers: [corpus] });
      expect(segmentOf(assembled, 'A')?.promptSegment).toBe('A-PROTOCOL\n\n');
    });

    it('should resolve first-by-layer: an overridden key keeps its position and takes its last source', async () => {
      const workspace: LlmPromptTemplateTier = {
        source: 'workspace',
        templates: [
          { key: 'cap:resolve', role: 'instructions', capability: 'resolve', text: 'B-RESOLVE-WS' },
          { key: 'cap:resolve-2', role: 'instructions', capability: 'resolve', text: 'B-RESOLVE-LATER' }
        ]
      };
      const assembled = await assembleReplica(replicaRequest('resolve'), { tiers: [CORPUS, workspace] });
      expect(segmentOf(assembled, 'B')).toMatchObject({ promptSegment: 'B-RESOLVE-WS\n\n', key: 'cap:resolve', origin: { kind: 'template', templateKey: 'cap:resolve', source: 'workspace' } });
      expect(assembled.prompt).not.toContain('B-RESOLVE-LATER');
    });

    it('should carry the frames through the seam: untrimmed fills, literal $ patterns, a blank tone placing nothing', async () => {
      const toned = await assembleReplica(replicaRequest('resolve', { tone: '  $& wry  ' }));
      expect(segmentOf(toned, 'A0')?.promptSegment).toBe('A0-CHAR tone=  $& wry  \n\n');

      const blank = await assembleReplica(replicaRequest('resolve', { tone: '   ' }));
      expect(idsOf(blank)).not.toContain('A0');
    });

    it("should carry the host's line-manner clause through its own frame slot, as segment A-amendment", async () => {
      const assembled = await assembleReplica(replicaRequest('speak', { replyProtocol: 'line', lineManner: true }));
      expect(assembled.prompt.startsWith('LINE-PROTOCOL\n\nLINE-MANNER\n\nB-VOICE\n\n')).toBe(true);
      expect(idsOf(assembled).slice(0, 2)).toEqual(['A', 'A-amendment']);

      const json = await assembleReplica(replicaRequest('speak', { lineManner: true }));
      expect(idsOf(json)).not.toContain('A-amendment');
    });
  });

  describe('census rows', () => {
    const CENSUS_CONTRACT = { type: 'object', properties: { pick: { type: 'number', description: 'the chosen id' }, note: { type: 'string' } }, required: ['pick'] };
    const CENSUS_BLOCKS: ReadonlyArray<LlmLiveContextBlock> = [
      { key: 'heading', text: '## Live context', volatile: false },
      { key: 'cast', text: 'Cast:\n- Ben 🙂\n- Mara' }
    ];

    function census(request: Partial<ReplicaRequest> & Pick<ReplicaRequest, 'capability'>): Promise<LlmComposedCapabilityPrompt> {
      return composeReplica(replicaRequest(request.capability, { renderLiveContext: () => CENSUS_BLOCKS, ...request }), { contractSchemaHint: CENSUS_CONTRACT, model: 'census/fast' });
    }

    function rowOf(composed: LlmComposedCapabilityPrompt): string {
      return `${idsOf(composed).join('|')} #${llmPromptCacheHash(composed.prompt)} ${composed.prompt.length}/${composed.cacheSegments.cachePrefix.length}`;
    }

    function labelsOf(composed: LlmComposedCapabilityPrompt): ReadonlyArray<string> {
      return composed.segments.map((segment) => (segment.key == null ? segment.id : `${segment.id}:${segment.key}`));
    }

    it('should assemble the plain row by hand', async () => {
      const composed = await census({ capability: 'resolve' });
      expect(composed.prompt).toBe(
        'ADDENDUM for census/fast\n\nA-PROTOCOL\n\nB-RESOLVE\n\nC-RESOLVE-PRE\n## Output contract\n\nReturn the `lever` as a JSON object with these fields:\n- `pick` (number, required): the chosen id\n- `note` (string, optional)\n\nNever invent an id. Every id MUST be one shown in the live context below.\n\n## Live context\n\nCast:\n- Ben 🙂\n- Mara\nC-RESOLVE-POST'
      );
      expect(composed.cacheSegments.cachePrefix.endsWith('below.\n\n## Live context\n\n')).toBe(true);
      expect(idsOf(composed).join('|')).toBe('model-addendum|A|B|C-pre|contract|D|D|C-post');
      expect(labelsOf(composed)).toEqual(['model-addendum:census/fast', 'A:reply-protocol:character', 'B:cap:resolve', 'C-pre:ctx:resolve', 'contract', 'D:heading', 'D:cast', 'C-post:ctx:resolve']);
    });

    it('should give every live segment, and only those, an explicit volatile flag', async () => {
      const composed = await census({ capability: 'resolve' });
      expect(composed.segments.filter((segment) => segment.id === 'D').map((segment) => segment.volatile)).toEqual([false, true]);
      expect(composed.segments.filter((segment) => segment.id !== 'D').some((segment) => 'volatile' in segment)).toBe(false);
    });

    it('should pin the census rows', async () => {
      const rows = [
        await census({ capability: 'resolve' }),
        await census({ capability: 'narrate', tone: 'gritty survival', perspective: STORY_PERSPECTIVE, style: 'Diction: terse.' }),
        await census({ capability: 'speak', tone: 'gritty survival', style: 'Diction: terse.', speech: '## How this character speaks\n\nClipped.', replyProtocol: 'line', lineManner: true })
      ].map(rowOf);
      expect(rows).toEqual(['model-addendum|A|B|C-pre|contract|D|D|C-post #7a619077028e3b05 338/302', 'model-addendum|A0|A0.5|A0.7|A|B|C-pre|contract|D|D #dc9dbc03525290e4 399/378', 'model-addendum|A0|A0.7|A|A-amendment|B|C-pre|B1|D|D #5f194af25cf7fd14 223/202']);
    });
  });
});
