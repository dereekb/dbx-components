import { type Maybe } from '@dereekb/util';
import { type ConversationState, type ConversationStatus, type InputsUnion, type OpenRouterAttachedFileReference, type OpenRouterInputMessage, type OpenRouterRunTaskKey, type StateAccessor, type Tool, openRouterMessagesWithFreshFileAttachments, openRouterMessagesWithoutFileAttachmentData } from '@dereekb/openrouter';
import { type OpenRouterRunTask, type OpenRouterRunTaskDocument, OpenRouterRunTaskState } from '@dereekb/openrouter/firebase';

/**
 * Maps a run task state to the SDK's conversation status.
 *
 * @param state - The run task state.
 * @returns The conversation status.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function conversationStatusForOpenRouterRunTaskState(state: OpenRouterRunTaskState): ConversationStatus {
  let result: ConversationStatus;

  switch (state) {
    case OpenRouterRunTaskState.COMPLETE:
      result = 'complete';
      break;
    case OpenRouterRunTaskState.FAILED:
      result = 'interrupted';
      break;
    case OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS:
      // The SDK's vocabulary for "paused holding tool calls we did not execute ourselves".
      result = 'awaiting_approval';
      break;
    case OpenRouterRunTaskState.RUNNING:
      result = 'in_progress';
      break;
    case OpenRouterRunTaskState.QUEUED:
    default:
      result = 'in_progress';
      break;
  }

  return result;
}

/**
 * Maps a conversation status back to the run task state to persist.
 *
 * @param status - The conversation status.
 * @param hasPendingToolCalls - Whether the state carries tool calls this process cannot resolve.
 * @returns The run task state.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterRunTaskStateForConversationStatus(status: ConversationStatus, hasPendingToolCalls: boolean): OpenRouterRunTaskState {
  let result: OpenRouterRunTaskState;

  if (hasPendingToolCalls) {
    // Pending calls win over the reported status: whatever the SDK called it, the run cannot proceed
    // until something outside this process supplies those results.
    result = OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS;
  } else {
    switch (status) {
      case 'complete':
        result = OpenRouterRunTaskState.COMPLETE;
        break;
      case 'awaiting_approval':
        result = OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS;
        break;
      case 'interrupted':
      case 'in_progress':
      default:
        result = OpenRouterRunTaskState.RUNNING;
        break;
    }
  }

  return result;
}

/**
 * Builds a {@link ConversationState} from a run task.
 *
 * `updatedAt` is derived rather than stored: the run task's existing timestamps already order the
 * lifecycle (`fat` > `lat` > `sat` > `qat`), and the SDK uses the value informationally.
 *
 * @param key - The run task key, which is the conversation id.
 * @param task - The run task.
 * @returns The conversation state.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function conversationStateForOpenRouterRunTask<TTools extends readonly Tool[] = readonly Tool[]>(key: OpenRouterRunTaskKey, task: OpenRouterRunTask): ConversationState<TTools> {
  const updatedAt = task.fat ?? task.lat ?? task.sat ?? task.qat;

  return {
    id: key,
    messages: (task.msg ?? []) as unknown as InputsUnion,
    pendingToolCalls: (task.ptc ?? []).map((call) => ({ id: call.callId, name: call.name, arguments: call.arguments })) as ConversationState<TTools>['pendingToolCalls'],
    unsentToolResults: (task.utr ?? []).map((result) => ({ callId: result.callId, name: result.name, output: result.output, error: result.error ?? undefined })) as ConversationState<TTools>['unsentToolResults'],
    status: conversationStatusForOpenRouterRunTaskState(task.s),
    createdAt: task.qat.getTime(),
    updatedAt: updatedAt.getTime()
  };
}

/**
 * The subset of a run task that a conversation-state save writes.
 */
export type OpenRouterRunTaskStateUpdate = Pick<OpenRouterRunTask, 's' | 'msg' | 'ptc' | 'utr'>;

/**
 * Builds the run task update for a conversation state.
 *
 * @param state - The conversation state to persist.
 * @returns The fields to write.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterRunTaskUpdateForConversationState(state: ConversationState): OpenRouterRunTaskStateUpdate {
  const pendingToolCalls = state.pendingToolCalls ?? [];

  return {
    s: openRouterRunTaskStateForConversationStatus(state.status, pendingToolCalls.length > 0),
    // Attachment payloads are stripped on the way in. They are resolved per attempt — a signed url has
    // already expired and inline base64 is the whole file — and `msg` is a Firestore field with a 1 MiB
    // document budget behind it. `load()` re-points the stripped parts, so nothing is lost.
    msg: openRouterConversationValueForFirestore(openRouterMessagesWithoutFileAttachmentData((state.messages ?? []) as unknown as OpenRouterInputMessage[])),
    ptc: pendingToolCalls.map((call) => ({ callId: call.id, name: call.name as string, taskId: call.id, arguments: openRouterConversationValueForFirestore(call.arguments as Maybe<Record<string, unknown>>) ?? null })),
    utr: (state.unsentToolResults ?? []).map((result) => ({ callId: result.callId, name: result.name as string, output: openRouterConversationValueForFirestore(result.output) ?? null, error: result.error ?? null }))
  };
}

/**
 * Strips `undefined` out of a value on its way into Firestore, at ANY DEPTH.
 *
 * This is the deep counterpart to the run task converter's shallow passthrough-JSON field, and it makes a
 * genuinely different claim: conversation state is whatever the SDK hands back, arbitrarily nested, and its
 * response items carry explicit `undefined`s for absent optional fields at every level. Firestore rejects
 * `undefined` outright, so persisting one unfiltered fails the whole write — and it fails inside the SDK's
 * `saveStateSafely`, which surfaces as an opaque "Failed to persist conversation state" rather than as the
 * run-task write it actually is. There is no deep undefined-filter in `@dereekb/util`, and a JSON
 * round-trip is the right tool anyway precisely because this data IS json: it came off the wire and is
 * going back onto it.
 *
 * @param value - The value to sanitize.
 * @returns The value with every `undefined` removed.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterConversationValueForFirestore<T>(value: T): T {
  // NOT `structuredClone`. It PRESERVES `undefined`-valued keys, which is the one thing this function
  // exists to remove — so `unicorn/prefer-structured-clone`'s autofix would silently break it.
  // eslint-disable-next-line unicorn/prefer-structured-clone
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/**
 * Config for {@link firestoreOpenRouterStateAccessor}.
 */
export interface FirestoreOpenRouterStateAccessorConfig {
  /**
   * The conversation to start from when the run task has no history yet.
   *
   * The SDK never records the request's own input into conversation state — it only appends what comes
   * BACK — so a run that resumes from state alone would resume having forgotten what it was asked. The
   * runner seeds the assembled request input here so the persisted conversation is the whole
   * conversation, and passes an empty `input` on the request itself to avoid sending it twice.
   */
  readonly initialMessages?: Maybe<OpenRouterInputMessage[]>;
  /**
   * The files attached for THIS attempt.
   *
   * Loaded history is re-pointed at these attachments, so a resume hours later does not replay a signed
   * url that expired minutes after the attempt that persisted it — or, in inline mode, a part whose
   * payload was deliberately stripped on save.
   */
  readonly attachedFiles?: Maybe<OpenRouterAttachedFileReference[]>;
}

/**
 * Creates a {@link StateAccessor} backed by a run task document.
 *
 * This is the persistent backend the SDK's docs ask for — its own example is a `Map`, with the note to
 * "implement `StateAccessor` with a persistent backend". Because OpenRouter allocates no conversation
 * id (and rejects `previous_response_id` outright), the conversation id is ours: the run task key.
 *
 * A single-shot run simply never populates `msg` / `ptc` / `utr`, so nothing is paid for not using it.
 *
 * @param document - The run task document to read and write.
 * @param config - The initial conversation and this attempt's attached files.
 * @returns The state accessor.
 */
export function firestoreOpenRouterStateAccessor<TTools extends readonly Tool[] = readonly Tool[]>(document: OpenRouterRunTaskDocument, config?: Maybe<FirestoreOpenRouterStateAccessorConfig>): StateAccessor<TTools> {
  const { initialMessages, attachedFiles } = config ?? {};

  return {
    load: async () => {
      const task = await document.snapshotData();
      let result: Maybe<ConversationState<TTools>>;

      if (task != null) {
        const stored = task.msg ?? [];
        const messages = openRouterMessagesWithFreshFileAttachments(stored.length > 0 ? stored : (initialMessages ?? []), attachedFiles);
        result = conversationStateForOpenRouterRunTask<TTools>(document.id, { ...task, msg: messages });
      }

      return result ?? null;
    },
    save: async (state) => {
      await document.update(openRouterRunTaskUpdateForConversationState(state as ConversationState));
    }
  };
}
