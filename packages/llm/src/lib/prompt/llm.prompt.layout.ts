/**
 * The prompt LAYOUT — the ordered array of slots a prompt is assembled in. The array IS the prompt order; a slot's
 * role only says what fills it (a contributor, the assembly, or the dispatcher), never where it sits. A host declares
 * its own layout (its own slot ids, its frame slots wherever it wants them); {@link DEFAULT_LLM_PROMPT_LAYOUT} names
 * every slot after its role.
 *
 * Each slot also carries the separator closing every piece placed in it, so the bytes between two pieces are a layout
 * fact rather than a rule scattered through the assembly.
 */

import { type Maybe } from '@dereekb/util';
import { type LlmPromptSegmentId } from './llm.prompt.segment';

/**
 * Every slot role the library knows, in no particular order (the LAYOUT orders slots, never the role).
 */
export const LLM_PROMPT_SLOT_ROLES = ['model-addendum', 'frame', 'reply-protocol', 'reply-amendment', 'instructions', 'context-pre', 'contract', 'craft', 'live', 'context-post', 'correction', 'follow-up'] as const;

/**
 * What fills a slot — the contract the assembly implements. Semantics only: a slot's position is its index in the
 * layout.
 *
 * - `model-addendum` — contributed: the resolved model's prompt addendum.
 * - `frame` — contributed: a preamble a host contributor places (a tone, a perspective, a style, a speaker's block). A
 *   frame may sit anywhere in the array, after the contract included.
 * - `reply-protocol` — assembly: the `reply-protocol` template, or the built-in line protocol for a `line` call.
 * - `reply-amendment` — assembly: the must-resolve clause (a JSON protocol + `mustResolve`) or the line-manner clause
 *   (`line` + `lineManner`); at most one per prompt.
 * - `instructions` — assembly: the `instructions` template.
 * - `context-pre` — assembly: the `context` template up to the FIRST `LLM_PROMPT_LIVE_CONTEXT_MARKER`, emitted RAW (no
 *   separator — the template's own bytes meet what follows) and emitted even when empty; without a marker, the whole
 *   body plus the separator.
 * - `contract` — assembly: the output contract, JSON protocols only.
 * - `craft` — contributed: selected notes, stable ones first then volatile, each group in contribution order.
 * - `live` — assembly + contributed: the capability's live blocks with this slot's contributions merged at their
 *   anchors (before the empty-block filter); the separator joins blocks and `lastSeparator` follows the last. Every
 *   assembled layout declares one; an empty live context still places one empty volatile segment (the cache boundary).
 * - `context-post` — assembly: the `context` template after the marker, only when non-empty (later markers stay
 *   literal), closed by the slot's separator (`''` in the default layout, so the template's bytes end as written).
 * - `correction` — dispatcher: a retry's correction appended to the sent prompt. The assembly skips it; declaring it
 *   names its segment id and separator.
 * - `follow-up` — dispatcher: a chained turn's whole message. The assembly skips it; declaring it names its segment id
 *   and separator.
 *
 * Bytes the assembly has for a role the layout does not declare fail loud.
 */
export type LlmPromptSlotRole = (typeof LLM_PROMPT_SLOT_ROLES)[number];

/**
 * How many pieces a slot holds — `single` (at most one; a second is a programming error) or `many`.
 */
export type LlmPromptSlotOccupancy = 'single' | 'many';

/**
 * A slot's id — the id of every segment placed in it. Open: a host's layout declares its own.
 */
export type LlmPromptSlotId = LlmPromptSegmentId;

/**
 * One slot of a layout.
 */
export interface LlmPromptSlot {
  /**
   * The slot's id — unique within the layout, and the id of every segment placed in it.
   */
  readonly id: LlmPromptSlotId;
  /**
   * What fills the slot ({@link LlmPromptSlotRole}) — semantics only, never order.
   */
  readonly role: LlmPromptSlotRole;
  /**
   * How many pieces the slot holds.
   */
  readonly occupancy: LlmPromptSlotOccupancy;
  /**
   * The separator appended after each piece placed in the slot.
   */
  readonly separator: string;
  /**
   * The separator appended after the slot's LAST piece instead of {@link separator}; absent ⇒ {@link separator}.
   */
  readonly lastSeparator?: string;
}

/**
 * A prompt layout — the slots in prompt ORDER (the array order).
 */
export type LlmPromptLayout = ReadonlyArray<LlmPromptSlot>;

/**
 * The roles a prompt contributor fills.
 */
export const LLM_PROMPT_CONTRIBUTION_SLOT_ROLES: ReadonlySet<LlmPromptSlotRole> = new Set<LlmPromptSlotRole>(['model-addendum', 'frame', 'craft', 'live']);

/**
 * The roles the assembly fills (`live` is filled by both the assembly and contributors).
 */
export const LLM_PROMPT_ASSEMBLY_SLOT_ROLES: ReadonlySet<LlmPromptSlotRole> = new Set<LlmPromptSlotRole>(['reply-protocol', 'reply-amendment', 'instructions', 'context-pre', 'contract', 'live', 'context-post']);

/**
 * The roles the dispatcher fills after assembly.
 */
export const LLM_PROMPT_DISPATCHER_SLOT_ROLES: ReadonlySet<LlmPromptSlotRole> = new Set<LlmPromptSlotRole>(['correction', 'follow-up']);

/**
 * The library's default layout — every slot id equal to its role name, `'\n\n'` separators except where a role's
 * bytes meet what follows raw. It declares no frame slot: a host that frames declares its own layout.
 */
export const DEFAULT_LLM_PROMPT_LAYOUT: LlmPromptLayout = [
  { id: 'model-addendum', role: 'model-addendum', occupancy: 'single', separator: '\n\n' },
  { id: 'reply-protocol', role: 'reply-protocol', occupancy: 'single', separator: '\n\n' },
  { id: 'reply-amendment', role: 'reply-amendment', occupancy: 'single', separator: '\n\n' },
  { id: 'instructions', role: 'instructions', occupancy: 'single', separator: '\n\n' },
  { id: 'context-pre', role: 'context-pre', occupancy: 'single', separator: '\n\n' },
  { id: 'contract', role: 'contract', occupancy: 'single', separator: '\n\n' },
  { id: 'craft', role: 'craft', occupancy: 'many', separator: '\n\n' },
  { id: 'live', role: 'live', occupancy: 'many', separator: '\n\n', lastSeparator: '' },
  { id: 'context-post', role: 'context-post', occupancy: 'single', separator: '' },
  { id: 'correction', role: 'correction', occupancy: 'single', separator: '' },
  { id: 'follow-up', role: 'follow-up', occupancy: 'single', separator: '' }
];

const LLM_PROMPT_SLOT_ROLE_SET: ReadonlySet<string> = new Set<string>(LLM_PROMPT_SLOT_ROLES);

/**
 * The issues of one slot taken alone.
 *
 * @param slot - The slot, as given (it may come from JSON).
 * @returns The slot's issues.
 */
function llmPromptSlotIssuesOf(slot: LlmPromptSlot): string[] {
  const issues: string[] = [];
  const { id, role, occupancy, separator, lastSeparator } = slot;

  if (typeof id !== 'string' || id === '') {
    issues.push('a slot has an empty id');
  }

  if (!LLM_PROMPT_SLOT_ROLE_SET.has(role)) {
    issues.push(`slot '${id}' has unknown role '${String(role)}'`);
  }

  if (occupancy !== 'single' && occupancy !== 'many') {
    issues.push(`slot '${id}' has unknown occupancy '${String(occupancy)}'`);
  }

  if (typeof separator !== 'string') {
    issues.push(`slot '${id}' separator is not a string`);
  }

  if (lastSeparator != null && typeof lastSeparator !== 'string') {
    issues.push(`slot '${id}' lastSeparator is not a string`);
  }

  if (role === 'live' && occupancy !== 'many') {
    issues.push(`slot '${id}' (live) must be 'many'`);
  } else if (role !== 'live' && (LLM_PROMPT_ASSEMBLY_SLOT_ROLES.has(role) || LLM_PROMPT_DISPATCHER_SLOT_ROLES.has(role)) && occupancy !== 'single') {
    issues.push(`slot '${id}' (${role}) must be 'single'`);
  }

  return issues;
}

/**
 * Validate a layout and return it unchanged — every issue is collected, then thrown as ONE error.
 *
 * Checked: unique non-empty ids; known roles; a `single` / `many` occupancy; string separators; at most one slot per
 * assembly or dispatcher role; a `many` live slot and a `single` slot for every other assembly / dispatcher role; and a
 * `context-post` slot only after a `context-pre` slot with a `live` slot between them. Contribution-only roles
 * (`model-addendum`, `frame`, `craft`) may repeat and take either occupancy.
 *
 * @param slots - The slots, in prompt order.
 * @returns The same `slots` array.
 * @throws {Error} When the layout has any issue (every issue is listed in the message).
 *
 * @example
 * ```ts
 * const layout = makeLlmPromptLayout([
 *   { id: 'brand-voice', role: 'frame', occupancy: 'single', separator: '\n\n' },
 *   { id: 'task', role: 'instructions', occupancy: 'single', separator: '\n\n' },
 *   { id: 'live', role: 'live', occupancy: 'many', separator: '\n\n', lastSeparator: '' }
 * ]);
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmPromptLayout(slots: ReadonlyArray<LlmPromptSlot>): LlmPromptLayout {
  const issues: string[] = [];
  const ids = new Set<string>();
  const ownedRoles = new Set<LlmPromptSlotRole>();
  let contextPreIndex = -1;
  let liveAfterContextPre = false;

  slots.forEach((slot, index) => {
    const { id, role } = slot;
    issues.push(...llmPromptSlotIssuesOf(slot));

    if (typeof id === 'string' && id !== '') {
      if (ids.has(id)) {
        issues.push(`slot id '${id}' is declared twice`);
      }

      ids.add(id);
    }

    if (LLM_PROMPT_ASSEMBLY_SLOT_ROLES.has(role) || LLM_PROMPT_DISPATCHER_SLOT_ROLES.has(role)) {
      if (ownedRoles.has(role)) {
        issues.push(`role '${role}' is declared twice`);
      }

      ownedRoles.add(role);
    }

    if (role === 'context-pre') {
      contextPreIndex = index;
    } else if (role === 'live' && contextPreIndex >= 0) {
      liveAfterContextPre = true;
    } else if (role === 'context-post') {
      if (contextPreIndex < 0) {
        issues.push(`slot '${id}' (context-post) has no context-pre slot before it`);
      } else if (!liveAfterContextPre) {
        issues.push(`slot '${id}' (context-post) has no live slot between it and the context-pre slot`);
      }
    }
  });

  if (issues.length > 0) {
    throw new Error(`llm prompt layout: ${issues.join('; ')}`);
  }

  return slots;
}

/**
 * The slot with an id, when the layout declares one.
 *
 * @param layout - The layout.
 * @param id - The slot id.
 * @returns The slot, or `undefined`.
 *
 * @example
 * ```ts
 * llmPromptSlotOf(DEFAULT_LLM_PROMPT_LAYOUT, 'live')?.lastSeparator; // ''
 * ```
 */
export function llmPromptSlotOf(layout: LlmPromptLayout, id: LlmPromptSlotId): Maybe<LlmPromptSlot> {
  return layout.find((slot) => slot.id === id);
}

/**
 * Every slot of one role, in layout order.
 *
 * @param layout - The layout.
 * @param role - The role.
 * @returns The role's slots.
 *
 * @example
 * ```ts
 * llmPromptSlotsOfRole(layout, 'frame').map((slot) => slot.id);
 * ```
 */
export function llmPromptSlotsOfRole(layout: LlmPromptLayout, role: LlmPromptSlotRole): ReadonlyArray<LlmPromptSlot> {
  return layout.filter((slot) => slot.role === role);
}
