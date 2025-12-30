import {
  type NotificationTaskSubtaskTarget,
  type NotificationTask,
  notificationTaskDelayRetry,
  type NotificationTaskServiceHandleNotificationTaskResult,
  notificationTaskComplete,
  delayCompletion,
  type NotificationTaskSubtaskMetadata,
  type NotificationTaskSubtaskCheckpointString,
  type NotificationTaskSubtaskData,
  completeSubtaskProcessingAndScheduleCleanupTaskResult,
  type NotificationTaskSubtaskCheckpoint,
  NOTIFICATION_TASK_SUBTASK_CHECKPOINT_CLEANUP,
  NOTIFICATION_TASK_SUBTASK_CHECKPOINT_PROCESSING,
  DEFAULT_NOTIFICATION_TASK_SUBTASK_CLEANUP_RETRY_ATTEMPTS,
  DEFAULT_NOTIFICATION_TASK_SUBTASK_CLEANUP_RETRY_DELAY,
  type NotificationTaskType
} from '@dereekb/firebase';
import { type NotificationTaskServiceTaskHandlerConfig } from '../notification/notification.task.service.handler';
import { asArray, type Maybe, type MaybeSo, type Milliseconds, type PromiseOrValue, separateValues, unique } from '@dereekb/util';
import { BaseError } from 'make-error';
import { removeFromCompletionsArrayWithTaskResult } from './notification.task.service.util';

/**
 * A NotificationTask with a set data value.
 */
export type NotificationTaskSubtaskInputTask<D extends NotificationTaskSubtaskData> = Omit<NotificationTask<D>, 'data'> & {
  readonly data: MaybeSo<NotificationTask<D>['data']>;
};

/**
 * Input for a generic NotificationTaskSubtask
 */
export interface NotificationTaskSubtaskInput<D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> {
  /**
   * The retrieved target.
   */
  readonly target: NotificationTaskSubtaskTarget;
  /**
   * The root NotificationTask.
   *
   * The data is always guranteed.
   */
  readonly notificationTask: NotificationTaskSubtaskInputTask<D>;
  /**
   * List of completed subtasks.
   */
  readonly completedSubtasks: S[];
  /**
   * The current metadata for the subtask.
   */
  readonly subtaskData?: Maybe<M>;
}

/**
 * Result of a NotificationTaskSubtask.
 */
export type NotificationTaskSubtaskResult<M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> = NotificationTaskServiceHandleNotificationTaskResult<M, S>;

/**
 * A NotificationTaskSubtask is a function that handles a specific NotificationTaskSubtaskTarget subtask.
 */
export type NotificationTaskSubtask<I extends NotificationTaskSubtaskInput<D, M, S>, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> = (input: I) => Promise<NotificationTaskSubtaskResult<M, S>>;

/**
 * Similar to NotificationTaskServiceTaskHandlerFlowEntry, but used in NotificationTaskSubtaskProcessorConfig as part of the flow.
 */
export interface NotificationTaskSubtaskFlowEntry<I extends NotificationTaskSubtaskInput<D, M, S>, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> {
  /**
   * The subtask this flow entry represents.
   */
  readonly subtask: S;
  /**
   * The subtask function
   */
  readonly fn: NotificationTaskSubtask<I, D, M, S>;
}

/**
 * The base output cleanup configuration.
 */
export interface NotificationTaskSubtaskCleanupInstructions {
  /**
   * Whether or not the cleanup was successful. If false, the task will be delayed until the cleanup can be retried.
   *
   * Defaults to true.
   */
  readonly cleanupSuccess?: boolean;
  /**
   * How long to delay the retry of the cleanup after cleanup fails.
   *
   * Ignored if cleanupSuccess is not false.
   */
  readonly delayRetryUntil?: NotificationTaskServiceHandleNotificationTaskResult['delayUntil'];
}

/**
 * Cleanup function for a NotificationTaskSubtask.
 *
 * This is called during the cleanup step. It is called even when the processor or target is unknown.
 */
export type NotificationTaskSubtaskCleanupInstructionsFunction<I extends NotificationTaskSubtaskInput<D, M, S>, CUI extends NotificationTaskSubtaskCleanupInstructions, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> = (input: NotificationTaskSubtaskCleanupFunctionInput<I, D, M, S>) => PromiseOrValue<CUI>;

/**
 * Optional cleanup override function for a NotificationTaskSubtask processor.
 *
 * The input has more parameters available to the input compared to NotificationTaskSubtaskCleanupInstructionsFunction. Can also call the configured default cleanup instructions function.
 *
 * If this function returns null/undefined, then the default cleanup instructions will be used.
 */
export type NotificationTaskSubtaskProcessorCleanupInstructionsFunction<I extends NotificationTaskSubtaskInput<D, M, S>, CUI extends NotificationTaskSubtaskCleanupInstructions, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> = (
  input: I,
  defaultCleanupInstructions: NotificationTaskSubtaskCleanupInstructionsFunction<I, CUI, D, M, S>
) => Maybe<PromiseOrValue<Maybe<CUI>>>;

/**
 * The actual cleanup function to execute using the input and instructions.
 */
export type NotificationTaskSubtaskCleanupFunction<I extends NotificationTaskSubtaskInput<D, M, S>, CUI extends NotificationTaskSubtaskCleanupInstructions, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> = (
  input: NotificationTaskSubtaskCleanupFunctionInput<I, D, M, S>,
  cleanupInstructions: CUI
) => Promise<NotificationTaskServiceHandleNotificationTaskResult<D, NotificationTaskSubtaskCheckpoint>>;

/**
 * The input function result may not include a target, and the notificationTask, completedSubtasks, and subtaskData properties are ignored.
 */
export type NotificationTaskSubtaskCleanupFunctionInput<I extends NotificationTaskSubtaskInput<D, M, S>, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> = Omit<I, 'target' | 'completedSubtasks' | 'subtaskData'> & Partial<Pick<I, 'target'>>;

/**
 * Similar to NotificationTaskServiceTaskHandlerConfig, but instead targets a specific NotificationTaskSubtaskTarget.
 *
 * The flows behave the same way.
 */
export interface NotificationTaskSubtaskProcessorConfig<I extends NotificationTaskSubtaskInput<D, M, S>, CUI extends NotificationTaskSubtaskCleanupInstructions, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> {
  /**
   * The target this configuration is for.
   */
  readonly target: NotificationTaskSubtaskTarget;
  /**
   * The order/flow of checkpoints and handler functions.
   *
   * When handling a notification task, if the checkpoint has already been completed then the entry will be skipped.
   */
  readonly flow: NotificationTaskSubtaskFlowEntry<I, D, M, S>[];
  /**
   * Optional cleanup function for the subtask.
   *
   * If not provided, the default cleanup actions will take place.
   */
  readonly cleanup?: NotificationTaskSubtaskProcessorCleanupInstructionsFunction<I, CUI, D, M, S>;
  /**
   * If true, then results returned by this processor will set "canRunNextCheckpoint" to true if it is undefined.
   */
  readonly allowRunMultipleParts?: Maybe<boolean>;
}

/**
 * Generates input for a NotificationTaskSubtaskNotificationTaskHandler from the provided NotificationTask.
 *
 * Should throw an NotificationTaskSubTaskMissingRequiredDataTermination error if the NotificationTask is missing required data.
 */
export type NotificationTaskSubtaskNotificationTaskHandlerInputFunction<I extends NotificationTaskSubtaskInput<D, M, S>, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> = (data: D, notificationTask: NotificationTask<D>) => PromiseOrValue<NotificationTaskSubtaskNotificationTaskHandlerInputFunctionResult<I, D, M, S>>;

/**
 * The input function result may not include a target, and the notificationTask, completedSubtasks, and subtaskData properties are ignored.
 */
export type NotificationTaskSubtaskNotificationTaskHandlerInputFunctionResult<I extends NotificationTaskSubtaskInput<D, M, S>, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> = Omit<I, 'target' | 'notificationTask' | 'completedSubtasks' | 'subtaskData'> & Partial<Pick<I, 'target'>>;

/**
 * Function that builds the update metadata for a NotificationTaskSubtask.
 *
 * Updates to sfps and sd are ignored, as those should be managed by the processors/flow entries.
 */
export type NotificationTaskSubtaskNotificationTaskHandlerBuildUpdateMetadataFunction<I extends NotificationTaskSubtaskInput<D, M, S>, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> = (baseUpdateMetadata: D, input: I) => PromiseOrValue<Omit<D, 'sfps' | 'sd'>>;

/**
 * Configuration for notificationTaskSubtaskNotificationTaskHandler().
 */
export interface NotificationTaskSubtaskNotificationTaskHandlerFactoryConfig<I extends NotificationTaskSubtaskInput<D, M, S>, CUI extends NotificationTaskSubtaskCleanupInstructions, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> {
  // MARK: Task Handler Config
  /**
   * A name for the subtask handler. Used for logging errors.
   */
  readonly subtaskHandlerFunctionName: string;
  /**
   * The task type
   */
  readonly taskType: NotificationTaskType;
  /**
   * Creates input for the NotificationTaskSubtaskNotificationTaskHandler from the provided NotificationTask.
   */
  readonly inputFunction: NotificationTaskSubtaskNotificationTaskHandlerInputFunction<I, D, M, S>;
  /**
   * Configuration function for building/extending the update metadata for the NotificationTaskSubtaskNotificationTask.
   */
  readonly buildUpdateMetadata?: NotificationTaskSubtaskNotificationTaskHandlerBuildUpdateMetadataFunction<I, D, M, S>;
  /**
   * The default cleanup instructions function.
   */
  readonly defaultCleanup: NotificationTaskSubtaskCleanupInstructionsFunction<I, CUI, D, M, S>;
  /**
   * The cleanup function to execute using the input and instructions.
   */
  readonly cleanupFunction: NotificationTaskSubtaskCleanupFunction<I, CUI, D, M, S>;
  /**
   * Sets the default max cleanup retry attempts for each processor.
   */
  readonly defaultMaxCleanupRetryAttempts?: Maybe<number>;
  /**
   * Sets the default cleanup retry delay for each processor.
   */
  readonly defaultCleanupRetryDelay?: Maybe<Milliseconds>;
}

/**
 * Creates a NotificationTaskServiceTaskHandlerConfig using the input config.
 */
export type NotificationTaskSubtaskNotificationTaskHandlerFactory<I extends NotificationTaskSubtaskInput<D, M, S>, CUI extends NotificationTaskSubtaskCleanupInstructions, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> = (
  config: NotificationTaskSubtaskNotificationTaskHandlerConfig<I, CUI, D, M, S>
) => NotificationTaskServiceTaskHandlerConfig<D, NotificationTaskSubtaskCheckpoint>;

/**
 * Configuration for notificationTaskSubtaskNotificationTaskHandler().
 */
export interface NotificationTaskSubtaskNotificationTaskHandlerConfig<I extends NotificationTaskSubtaskInput<D, M, S>, CUI extends NotificationTaskSubtaskCleanupInstructions, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> {
  /**
   * List of all target values for the app. Used for verifying that all target values are handled.
   */
  readonly validate?: NotificationTaskSubtaskTarget[];
  /**
   * List of handlers for NotificationTaskSubtaskTarget values.
   */
  readonly processors: NotificationTaskSubtaskProcessorConfig<I, CUI, D, M, S>[];
  /**
   * The maximum number of times to delay the cleanup step of a NotificationTaskSubtaskNotificationTask.
   *
   * Defaults to DEFAULT_MAX_STORAGE_FILE_PROCESSING_CLEANUP_RETRY_ATTEMPTS.
   */
  readonly maxCleanupRetryAttempts?: Maybe<number>;
  /**
   * The amount of time to delay the cleanup step of a NotificationTaskSubtaskNotificationTask.
   *
   * Defaults to DEFAULT_STORAGE_FILE_PROCESSING_CLEANUP_RETRY_DELAY.
   */
  readonly cleanupRetryDelay?: Maybe<Milliseconds>;
  /**
   * The default value to use for allowRunMultipleParts if it is not specified, for each processor.
   */
  readonly defaultAllowRunMultipleParts?: Maybe<boolean>;
}

/**
 * Creates a NotificationTaskSubtaskNotificationTaskHandlerFactory.
 */
export function notificationTaskSubtaskNotificationTaskHandlerFactory<I extends NotificationTaskSubtaskInput<D, M, S>, CUI extends NotificationTaskSubtaskCleanupInstructions, D extends NotificationTaskSubtaskData<M, S>, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString>(
  factoryConfig: NotificationTaskSubtaskNotificationTaskHandlerFactoryConfig<I, CUI, D, M, S>
): NotificationTaskSubtaskNotificationTaskHandlerFactory<I, CUI, D, M, S> {
  const { taskType, subtaskHandlerFunctionName: subtaskHandlerName, inputFunction, defaultCleanup, cleanupFunction, buildUpdateMetadata: inputBuildUpdateMetadata } = factoryConfig;

  return (subtaskHandlerConfig: NotificationTaskSubtaskNotificationTaskHandlerConfig<I, CUI, D, M, S>) => {
    const { processors: inputProcessors, maxCleanupRetryAttempts: inputMaxCleanupRetryAttempts, cleanupRetryDelay: inputCleanupRetryDelay, defaultAllowRunMultipleParts } = subtaskHandlerConfig;
    const maxCleanupRetryAttempts = inputMaxCleanupRetryAttempts ?? DEFAULT_NOTIFICATION_TASK_SUBTASK_CLEANUP_RETRY_ATTEMPTS;
    const cleanupRetryDelay = inputCleanupRetryDelay ?? DEFAULT_NOTIFICATION_TASK_SUBTASK_CLEANUP_RETRY_DELAY;

    const buildUpdateMetadata = inputBuildUpdateMetadata ?? (() => undefined);

    type NotificationTaskSubtaskProcessorProcessFunction<I extends NotificationTaskSubtaskInput<D, M, S>, D extends NotificationTaskSubtaskData<M, S> = any, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> = (input: I) => Promise<NotificationTaskServiceHandleNotificationTaskResult<D, NotificationTaskSubtaskCheckpoint>>;

    interface NotificationTaskSubtaskProcessor<I extends NotificationTaskSubtaskInput<D, M, S>, CUI extends NotificationTaskSubtaskCleanupInstructions, D extends NotificationTaskSubtaskData<M, S> = any, M extends NotificationTaskSubtaskMetadata = any, S extends NotificationTaskSubtaskCheckpointString = NotificationTaskSubtaskCheckpointString> {
      readonly process: NotificationTaskSubtaskProcessorProcessFunction<I, D, M, S>;
      readonly cleanup?: NotificationTaskSubtaskProcessorCleanupInstructionsFunction<I, CUI, D, M, S>;
    }

    const processors: Record<NotificationTaskSubtaskTarget, NotificationTaskSubtaskProcessor<I, CUI, D, M, S>> = {};

    inputProcessors.forEach((processorConfig) => {
      const { target } = processorConfig;
      processors[target] = processorFunctionForConfig(processorConfig);
    });

    /**
     * Structure is similar to notificationTaskService(), but contained to handle the subtasks.
     */
    function processorFunctionForConfig(processorConfig: NotificationTaskSubtaskProcessorConfig<I, CUI, D, M, S>): NotificationTaskSubtaskProcessor<I, CUI, D, M, S> {
      const { flow: inputFlows, cleanup, allowRunMultipleParts: processorAllowRunMultipleParts } = processorConfig;
      const { included: subtaskFlows, excluded: nonSubtaskFlows } = separateValues(inputFlows, (x) => x.subtask != null);
      const allowRunMultipleParts = processorAllowRunMultipleParts ?? defaultAllowRunMultipleParts;

      if (inputFlows.length === 0) {
        throw new Error(`${subtaskHandlerName}(): NotificationTaskSubtaskProcessorConfig must have at least one flow entry.`);
      } else if (nonSubtaskFlows.length > 1) {
        throw new Error(`${subtaskHandlerName}(): NotificationTaskSubtaskProcessorConfig must not have more than one non-subtask flow.`);
      }

      const allKnownSubtasks = unique(inputFlows.map((x) => x.subtask));

      return {
        process: async (input: I) => {
          const { notificationTask, completedSubtasks, subtaskData } = input;

          let fn: Maybe<NotificationTaskSubtask<I, D, M, S>>;

          switch (completedSubtasks.length) {
            case 0:
              fn = (nonSubtaskFlows[0] ?? subtaskFlows[0])?.fn as Maybe<NotificationTaskSubtask<I, D, M, S>>;
              break;
            default:
              const completedSubtasksSet = new Set(completedSubtasks);
              /**
               * Find the next flow function that hasn't had its checkpoint completed yet.
               */
              const nextSubtask = subtaskFlows.find((x) => !completedSubtasksSet.has(x.subtask));
              fn = nextSubtask?.fn as Maybe<NotificationTaskSubtask<I, D, M, S>>;
              break;
          }

          let result: NotificationTaskServiceHandleNotificationTaskResult<D, NotificationTaskSubtaskCheckpoint>;

          if (fn) {
            /*
             * This section is similar to handleNotificationTask() in notification.action.server.ts,
             * but is modified to handle the subtasks. The main difference is the attempt count is maintained,
             * and instead is available via the normal NotificationTask attempts details.
             */

            const subtaskResult: NotificationTaskServiceHandleNotificationTaskResult<M, S> = await fn(input);
            const { completion: subtaskCompletion, updateMetadata: subtaskUpdateMetadata, delayUntil, canRunNextCheckpoint } = subtaskResult;

            let allSubtasksDone = false;
            let sfps: S[] = completedSubtasks;

            // update the task metadata to reflect the changes
            switch (subtaskCompletion) {
              case true:
                allSubtasksDone = true;
                break;
              case false:
                // remove any completions, if applicable
                sfps = removeFromCompletionsArrayWithTaskResult(sfps, subtaskResult);
                break;
              default:
                sfps = unique([
                  ...removeFromCompletionsArrayWithTaskResult(sfps, subtaskResult), // remove any completions, if applicable
                  ...asArray(subtaskCompletion)
                ]);

                const completedSubtasksSet = new Set(sfps);
                const incompleteSubtasks = allKnownSubtasks.filter((x) => !completedSubtasksSet.has(x));

                allSubtasksDone = incompleteSubtasks.length === 0;
                break;
            }

            // configure the update metadata result
            const sd = {
              ...subtaskData,
              ...subtaskUpdateMetadata
            } as M;

            /**
             * This is updating the metadata for the NotificationTask, which has a nested data
             */
            const baseUpdateMetadata: D = {
              ...notificationTask.data,
              sfps,
              sd
            };

            let updateMetadata = (await buildUpdateMetadata(baseUpdateMetadata, input)) as D;

            if (updateMetadata) {
              // inject sfps and sd back in
              updateMetadata = {
                ...updateMetadata,
                sfps,
                sd
              };
            } else {
              updateMetadata = baseUpdateMetadata;
            }

            const nextCanRunNextCheckpoint = canRunNextCheckpoint ?? allowRunMultipleParts;

            result = {
              completion: allSubtasksDone ? ['processing'] : delayCompletion(), // return processing until all subtasks are complete.
              updateMetadata,
              canRunNextCheckpoint: nextCanRunNextCheckpoint,
              allCompletedSubTasks: sfps,
              delayUntil // delay is passed through
            };
          } else {
            // no more subtasks to process, and no metadata changes. Mark as processing complete and continue.
            result = completeSubtaskProcessingAndScheduleCleanupTaskResult() as typeof result;
          }

          return result;
        },
        cleanup
      };
    }

    function useInputDataFactory(fn: (notificationTask: NotificationTask<D>, inputFunctionResult: NotificationTaskSubtaskNotificationTaskHandlerInputFunctionResult<I, D, M, S>, data: D) => Promise<NotificationTaskServiceHandleNotificationTaskResult<D, NotificationTaskSubtaskCheckpoint>>) {
      return async (notificationTask: NotificationTask<D>) => {
        const { data } = notificationTask;

        let result: NotificationTaskServiceHandleNotificationTaskResult<D, NotificationTaskSubtaskCheckpoint>;

        if (data) {
          try {
            const inputFunctionResult = await inputFunction(data, notificationTask);

            result = await fn(notificationTask, inputFunctionResult, data);
          } catch (e) {
            if (e instanceof NotificationTaskSubTaskMissingRequiredDataTermination) {
              // Task is complete if the required data no longer exists. Nothing to cleanup.
              result = notificationTaskComplete();
            } else {
              // rethrow the error
              throw e;
            }
          }
        } else {
          // Improperly configured task. Complete immediately.
          result = notificationTaskComplete();
        }

        return result;
      };
    }

    const result: NotificationTaskServiceTaskHandlerConfig<D, NotificationTaskSubtaskCheckpoint> = {
      type: taskType,
      flow: [
        {
          checkpoint: NOTIFICATION_TASK_SUBTASK_CHECKPOINT_PROCESSING,
          fn: useInputDataFactory(async (notificationTask, inputFunctionResult, data) => {
            let result: NotificationTaskServiceHandleNotificationTaskResult<D, NotificationTaskSubtaskCheckpoint>;

            const baseInput = {
              ...inputFunctionResult,
              notificationTask
            };

            const { target } = baseInput;

            if (target) {
              const processor = processors[target];

              if (processor) {
                const { sd: subtaskData, sfps: completedSubtasks } = data;

                const input: I = {
                  ...baseInput,
                  target,
                  completedSubtasks: completedSubtasks ?? [],
                  subtaskData
                } as I;

                result = await processor.process(input);
              } else {
                // processor is unknown. Complete the task.
                result = completeSubtaskProcessingAndScheduleCleanupTaskResult();
              }
            } else {
              // target is unknown. Complete the task.
              result = completeSubtaskProcessingAndScheduleCleanupTaskResult();
            }

            return result;
          })
        },
        {
          checkpoint: NOTIFICATION_TASK_SUBTASK_CHECKPOINT_CLEANUP,
          fn: useInputDataFactory(async (notificationTask, inputFunctionResult, data) => {
            let result: NotificationTaskServiceHandleNotificationTaskResult<D, NotificationTaskSubtaskCheckpoint>;

            let cleanupFunctionInput = {
              ...inputFunctionResult,
              notificationTask
            } as NotificationTaskSubtaskCleanupFunctionInput<I, D, M, S>;

            const { target } = cleanupFunctionInput;

            let cleanupInstructions: CUI;

            if (target) {
              const processor = processors[target];

              if (processor && processor.cleanup) {
                const { sd: subtaskData, sfps: completedSubtasks } = data;

                const input: I = {
                  ...cleanupFunctionInput,
                  notificationTask,
                  completedSubtasks: completedSubtasks ?? [],
                  target,
                  subtaskData
                } as I;

                cleanupInstructions = (await processor.cleanup(input, defaultCleanup)) ?? (await defaultCleanup(cleanupFunctionInput));
                cleanupFunctionInput = input;
              } else {
                // processor is unknown. Complete the task.
                cleanupInstructions = await defaultCleanup(cleanupFunctionInput);
              }
            } else {
              // target is unknown. Complete the task.
              cleanupInstructions = await defaultCleanup(cleanupFunctionInput);
            }

            if (cleanupInstructions.cleanupSuccess === false && notificationTask.currentCheckpointSendAttempts <= maxCleanupRetryAttempts) {
              result = notificationTaskDelayRetry(cleanupInstructions.delayRetryUntil ?? cleanupRetryDelay);
            } else {
              result = await cleanupFunction(cleanupFunctionInput, cleanupInstructions);
            }

            return result;
          })
        }
      ]
    };

    return result;
  };
}

// MARK: Internally Handled Errors
/**
 * Thrown when a subtask no longer has data available to continue processing.
 *
 * The subtask will be marked as immediately complete, and no cleanup will occur.
 *
 * This is useful in cases where the underlying models or data that the subtask rely on are deleted (and those models were also required for cleanup) so the task can be marked as complete without attempting cleanup.
 */
export class NotificationTaskSubTaskMissingRequiredDataTermination extends BaseError {}

/**
 * Creates a NotificationTaskSubTaskMissingRequiredDataTermination.
 */
export function notificationTaskSubTaskMissingRequiredDataTermination() {
  return new NotificationTaskSubTaskMissingRequiredDataTermination();
}
