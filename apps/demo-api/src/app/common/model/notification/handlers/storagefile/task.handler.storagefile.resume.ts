import { StorageFileProcessingState, copyStoragePath, delayCompletion } from '@dereekb/firebase';
import { type StorageFileProcessingPurposeSubtaskCleanupOutput, type StorageFileProcessingPurposeSubtaskInput, type StorageFileProcessingPurposeSubtaskProcessorConfig, type StorageFileProcessingPurposeSubtaskResult } from '@dereekb/firebase-server/model';
import { type OpenRouterFileReference, type OpenRouterRunTaskKey } from '@dereekb/openrouter';
import { type OpenRouterRunTaskService, openRouterRunTaskOutcome } from '@dereekb/openrouter/firebase-server';
import { MS_IN_MINUTE, type Milliseconds, slashPathName } from '@dereekb/util';
import { DEMO_RESUME_CHECK_PROMPT_KEY, type ProfileFirestoreCollection, type ProfileResume, ProfileResumeState, USER_RESUME_FILE_PURPOSE, USER_RESUME_FILE_PURPOSE_RETRIEVE_SUBTASK, USER_RESUME_FILE_PURPOSE_SEND_SUBTASK, type UserResumeFileMetadata, type UserResumeFileProcessingSubtask, type UserResumeFileProcessingSubtaskMetadata, demoResumeCheckVerdictFromOutput } from 'demo-firebase';

/**
 * How long `retrieve` waits before looking at an in-flight run again.
 *
 * A sweep tick is the unit of progress here, so anything shorter is just a re-read of the same document.
 */
export const DEMO_RESUME_CHECK_RETRIEVE_DELAY: Milliseconds = MS_IN_MINUTE;

/**
 * How many runs a single file is allowed before it is marked FAILED.
 *
 * A FAILED run has already spent the run-task service's own per-request retry budget, so this is the
 * outer loop: it covers a whole run going wrong (a rate limit, a model outage), not one flaky request.
 */
export const DEMO_RESUME_CHECK_MAX_ATTEMPTS = 3;

/**
 * The run task key for one attempt at one StorageFile.
 *
 * Derived from the StorageFile id rather than generated, so re-entering `send` — which happens whenever
 * the owning notification task is retried — reuses the run already in flight instead of queueing a
 * second one against the same file.
 *
 * @param storageFileId - The StorageFile document id.
 * @param attempt - Which outer attempt this is.
 * @returns The run task key.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function demoResumeCheckRunTaskKey(storageFileId: string, attempt = 0): OpenRouterRunTaskKey {
  return attempt === 0 ? `resume_${storageFileId}` : `resume_${storageFileId}_${attempt}`;
}

/**
 * Configuration for {@link demoUserResumeFileProcessingSubtaskProcessor}.
 */
export interface DemoUserResumeFileProcessingSubtaskProcessorConfig {
  /**
   * The queue this processor enqueues into and polls.
   */
  readonly openRouterRunTaskService: OpenRouterRunTaskService;
  /**
   * The collection the run's outcome is mirrored onto, so the profile view can render it.
   */
  readonly profileCollection: ProfileFirestoreCollection;
}

/**
 * Builds the `resume` purpose's subtask processor.
 *
 * The pair is QUEUED rather than inline on purpose: `send` writes one run-task document and returns, so
 * no checkpoint holds a function open across an inference, and `retrieve` reads the outcome on a later
 * tick. That is also what exercises the queue, the sweep, and per-attempt file attachment — the parts
 * `@dereekb/openrouter` exists for.
 *
 * @param config - The run-task queue and the profile collection to mirror the outcome onto.
 * @returns The processor config, for the `processors` array of the storage-file processing handler.
 */
export function demoUserResumeFileProcessingSubtaskProcessor(config: DemoUserResumeFileProcessingSubtaskProcessorConfig): StorageFileProcessingPurposeSubtaskProcessorConfig<UserResumeFileProcessingSubtaskMetadata, UserResumeFileProcessingSubtask> {
  const { openRouterRunTaskService, profileCollection } = config;

  /**
   * Mirrors the run's outcome onto the owning user's Profile.
   *
   * The profile view renders from `Profile.resume` rather than from the StorageFile — a StorageFile is
   * not client-readable here — so a verdict that never reaches this is a verdict the user never sees.
   *
   * @param input - The subtask input, which names the StorageFile and so its owning user.
   * @param changes - The fields to merge onto the profile's existing resume.
   */
  async function updateProfileResume(input: StorageFileProcessingPurposeSubtaskInput<UserResumeFileProcessingSubtaskMetadata, UserResumeFileProcessingSubtask>, changes: Partial<ProfileResume>): Promise<void> {
    const storageFile = await input.loadStorageFile();
    const userId = storageFile.u;

    if (userId != null) {
      const profileDocument = profileCollection.documentAccessor().loadDocumentForId(userId);
      const profile = await profileDocument.snapshotData();

      // A newer upload has already replaced the profile's resume, so this run's outcome is stale and
      // writing it would resurrect the superseded file's verdict.
      if (profile?.resume?.storageFile === storageFile.key) {
        await profileDocument.update({ resume: { ...profile.resume, ...changes } });
      }
    }
  }

  /**
   * Enqueues the run that asks the model about one file.
   */
  async function enqueueResumeCheck(storageFileId: string, storagePath: { bucketId: string; pathString: string }, attempt: number): Promise<OpenRouterRunTaskKey> {
    const key = demoResumeCheckRunTaskKey(storageFileId, attempt);

    const file: OpenRouterFileReference = {
      bucket: storagePath.bucketId,
      storagePath: storagePath.pathString,
      // The extension is what tells OpenRouter how to treat the attachment, so the real filename is
      // carried through rather than a synthesized one.
      filename: slashPathName(storagePath.pathString)
    };

    await openRouterRunTaskService.enqueueRunTask({ key, promptKey: DEMO_RESUME_CHECK_PROMPT_KEY, files: [file] });
    return key;
  }

  const processorConfig: StorageFileProcessingPurposeSubtaskProcessorConfig<UserResumeFileProcessingSubtaskMetadata, UserResumeFileProcessingSubtask> = {
    target: USER_RESUME_FILE_PURPOSE,
    cleanup: (input): StorageFileProcessingPurposeSubtaskCleanupOutput => {
      // A file whose runs all ended badly is FAILED rather than SUCCESS: `d` was never written, so
      // "the model said it is not a resume" and "we never got an answer" would otherwise look alike.
      const gaveUp = (input.subtaskData?.attempts ?? 0) >= DEMO_RESUME_CHECK_MAX_ATTEMPTS;

      return {
        cleanupSuccess: true,
        nextProcessingState: gaveUp ? StorageFileProcessingState.FAILED : StorageFileProcessingState.SUCCESS,
        queueForDelete: false
      };
    },
    flow: [
      {
        subtask: USER_RESUME_FILE_PURPOSE_SEND_SUBTASK,
        fn: async (input) => {
          const storagePath = copyStoragePath(input.fileDetailsAccessor.input);
          const runTaskKey = await enqueueResumeCheck(input.storageFileDocument.id, storagePath, 0);

          const result: StorageFileProcessingPurposeSubtaskResult<UserResumeFileProcessingSubtaskMetadata, UserResumeFileProcessingSubtask> = {
            completion: USER_RESUME_FILE_PURPOSE_SEND_SUBTASK,
            updateMetadata: { runTaskKey, attempts: 1 }
          };

          return result;
        }
      },
      {
        subtask: USER_RESUME_FILE_PURPOSE_RETRIEVE_SUBTASK,
        fn: async (input) => {
          const { storageFileDocument } = input;
          const runTaskKey = input.subtaskData?.runTaskKey;
          const attempts = input.subtaskData?.attempts ?? 1;

          const task = runTaskKey == null ? undefined : await openRouterRunTaskService.readRunTask(runTaskKey);
          const outcome = openRouterRunTaskOutcome(task);

          let result: StorageFileProcessingPurposeSubtaskResult<UserResumeFileProcessingSubtaskMetadata, UserResumeFileProcessingSubtask>;

          if (outcome === 'complete') {
            const verdict = demoResumeCheckVerdictFromOutput(task?.j, task?.o);
            const metadata: UserResumeFileMetadata = { isResume: verdict?.isResume ?? false, reason: verdict?.reason ?? '', checkedAt: new Date() };

            await storageFileDocument.update({ d: metadata });
            await updateProfileResume(input, { state: ProfileResumeState.CHECKED, isResume: metadata.isResume, reason: metadata.reason, checkedAt: metadata.checkedAt });

            result = { completion: USER_RESUME_FILE_PURPOSE_RETRIEVE_SUBTASK };
          } else if (outcome === 'queued') {
            // Still in flight. Neither an error nor progress — come back after a sweep tick.
            result = { completion: delayCompletion(), delayUntil: DEMO_RESUME_CHECK_RETRIEVE_DELAY };
          } else if (attempts >= DEMO_RESUME_CHECK_MAX_ATTEMPTS) {
            // 'failure' or 'missing' with the budget spent. Completing the subtask hands control to
            // cleanup, which reads the same counter and marks the file FAILED. The profile is written
            // here rather than in cleanup because cleanup is the sole synchronous step in the flow.
            await updateProfileResume(input, { state: ProfileResumeState.FAILED });

            result = { completion: USER_RESUME_FILE_PURPOSE_RETRIEVE_SUBTASK, updateMetadata: { attempts } };
          } else {
            // The run is over and produced nothing. Re-enqueue under a fresh key rather than waiting for
            // `send` to run again — that subtask is already marked complete and will not re-enter.
            const storagePath = copyStoragePath(input.fileDetailsAccessor.input);
            const nextRunTaskKey = await enqueueResumeCheck(storageFileDocument.id, storagePath, attempts);

            result = { completion: delayCompletion(), delayUntil: DEMO_RESUME_CHECK_RETRIEVE_DELAY, updateMetadata: { runTaskKey: nextRunTaskKey, attempts: attempts + 1 } };
          }

          return result;
        }
      }
    ]
  };

  return processorConfig;
}
