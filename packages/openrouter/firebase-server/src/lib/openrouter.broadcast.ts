import { type Maybe } from '@dereekb/util';
import { type OpenRouterRunTaskKey, type OpenRouterRunUsage } from '@dereekb/openrouter';
import { type OpenRouterRunTaskFirestoreCollections } from '@dereekb/openrouter/firebase';

/**
 * The generation fields a broadcast span carries.
 *
 * Structurally the `OpenRouterGenerationInfo` that `@dereekb/nestjs/openrouter` already extracts from an
 * OTLP span; declared independently so this package does not depend on the NestJS entry just for a shape.
 */
export interface OpenRouterBroadcastGenerationInfo {
  readonly generationId?: Maybe<string>;
  readonly model?: Maybe<string>;
  readonly provider?: Maybe<string>;
  readonly promptTokens?: Maybe<number>;
  readonly completionTokens?: Maybe<number>;
  readonly totalTokens?: Maybe<number>;
  readonly cost?: Maybe<number>;
}

/**
 * The attribute key OpenRouter surfaces a `trace: { runTaskKey }` property under.
 *
 * OpenRouter's docs: "custom metadata from the `trace` field is included as span attributes in the OTLP
 * JSON payload". The exact prefix is not contractual, so several candidates are checked.
 */
export const OPENROUTER_BROADCAST_RUN_TASK_KEY_ATTRIBUTES: readonly string[] = ['runTaskKey', 'trace.runTaskKey', 'openrouter.trace.runTaskKey', 'gen_ai.trace.runTaskKey'];

/**
 * Reads the run task key out of a span's attribute map.
 *
 * @param attributes - The flattened span attributes.
 * @returns The run task key, when the span carries one.
 */
export function openRouterRunTaskKeyFromBroadcastAttributes(attributes: Maybe<Map<string, string | number | boolean>>): Maybe<OpenRouterRunTaskKey> {
  let result: Maybe<OpenRouterRunTaskKey>;

  if (attributes != null) {
    for (const key of OPENROUTER_BROADCAST_RUN_TASK_KEY_ATTRIBUTES) {
      const value = attributes.get(key);

      if (value != null) {
        result = String(value);
        break;
      }
    }
  }

  return result;
}

/**
 * Params for {@link reconcileOpenRouterRunTaskFromBroadcast}.
 */
export interface ReconcileOpenRouterRunTaskFromBroadcastParams {
  /**
   * The run task collections.
   */
  readonly collections: OpenRouterRunTaskFirestoreCollections;
  /**
   * The run task the span belongs to.
   */
  readonly key: Maybe<OpenRouterRunTaskKey>;
  /**
   * The generation info extracted from the span.
   */
  readonly generation: OpenRouterBroadcastGenerationInfo;
}

/**
 * Result of a reconciliation attempt.
 */
export interface ReconcileOpenRouterRunTaskFromBroadcastResult {
  /**
   * Whether a run task was found and updated.
   */
  readonly reconciled: boolean;
}

/**
 * Reconciles generation id, usage, and cost onto a run task from a broadcast span.
 *
 * This exists for the one thing the runner cannot always know: cost is finalised server-side, so the
 * value the runner wrote from the response can be provisional.
 *
 * TELEMETRY ONLY — it never changes `s`, and a span it cannot match is dropped silently. Broadcast is
 * enabled account-wide rather than per request, delivery is asynchronous and best-effort, and a dropped
 * trace must not be able to strand a task. Putting control flow here would make a missing trace look
 * exactly like a stuck run.
 *
 * @param params - The collections, run task key, and generation info.
 * @returns Whether anything was written.
 */
export async function reconcileOpenRouterRunTaskFromBroadcast(params: ReconcileOpenRouterRunTaskFromBroadcastParams): Promise<ReconcileOpenRouterRunTaskFromBroadcastResult> {
  const { collections, key, generation } = params;
  let reconciled = false;

  if (key) {
    const document = collections.openRouterRunTaskCollection.documentAccessor().loadDocumentForId(key);
    const task = await document.snapshotData();

    if (task != null) {
      const generationIds = generation.generationId == null ? task.gi : Array.from(new Set([...(task.gi ?? []), generation.generationId]));
      const usage = mergedOpenRouterRunUsage(task.u, generation);

      await document.update({ gi: generationIds, u: usage });
      reconciled = true;
    }
  }

  return { reconciled };
}

/**
 * Merges broadcast-reported usage into the usage already stored on a task.
 *
 * The broadcast value wins where it is present — it is the later, authoritative measurement — and the
 * stored value is kept where the span is silent, so an incomplete span cannot erase what the runner knew.
 *
 * @param existing - Usage already stored.
 * @param generation - The span's generation info.
 * @returns The merged usage.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function mergedOpenRouterRunUsage(existing: Maybe<OpenRouterRunUsage>, generation: OpenRouterBroadcastGenerationInfo): OpenRouterRunUsage {
  // Every field is spread conditionally rather than assigned. Usage is persisted as passthrough JSON, so
  // an absent measurement written as an explicit `undefined` is not "no value" to Firestore — it is a
  // rejected write, and it takes the whole reconciliation down with it.
  return {
    ...definedUsageValue('inputTokens', generation.promptTokens ?? existing?.inputTokens),
    ...definedUsageValue('outputTokens', generation.completionTokens ?? existing?.outputTokens),
    ...definedUsageValue('totalTokens', generation.totalTokens ?? existing?.totalTokens),
    ...definedUsageValue('reasoningTokens', existing?.reasoningTokens),
    ...definedUsageValue('cachedTokens', existing?.cachedTokens),
    ...definedUsageValue('cost', generation.cost ?? existing?.cost),
    ...definedUsageValue('isByok', existing?.isByok)
  };
}

function definedUsageValue<K extends keyof OpenRouterRunUsage>(key: K, value: OpenRouterRunUsage[K]): Partial<OpenRouterRunUsage> {
  return value == null ? {} : { [key]: value };
}
