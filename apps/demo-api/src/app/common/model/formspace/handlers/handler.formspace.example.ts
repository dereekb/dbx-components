import { type FormSpaceSubmissionProcessorConfig } from '@dereekb/firebase-server/model';
import { DEMO_EXAMPLE_FORM_SPACE_TYPE, type DemoExampleFormSpaceData } from 'demo-firebase';

/**
 * Checkpoint that reads the submitted form's own JSON.
 */
export const DEMO_EXAMPLE_FORM_SPACE_REVIEW_SUBTASK = 'review';

/**
 * Checkpoint that records the outcome.
 */
export const DEMO_EXAMPLE_FORM_SPACE_RECORD_SUBTASK = 'record';

/**
 * The demo app's submission processor for {@link DEMO_EXAMPLE_FORM_SPACE_TYPE}.
 *
 * Two checkpoints rather than one, so the emulator scenario actually exercises the subtask framework's
 * resume behaviour rather than a single-shot function that would pass either way.
 */
export const DEMO_EXAMPLE_FORM_SPACE_PROCESSOR: FormSpaceSubmissionProcessorConfig = {
  target: DEMO_EXAMPLE_FORM_SPACE_TYPE,
  flow: [
    {
      subtask: DEMO_EXAMPLE_FORM_SPACE_REVIEW_SUBTASK,
      fn: async (input) => {
        const formSpace = await input.loadFormSpace();
        const data = formSpace.d as DemoExampleFormSpaceData | undefined;

        return {
          completion: DEMO_EXAMPLE_FORM_SPACE_REVIEW_SUBTASK,
          canRunNextCheckpoint: true,
          updateMetadata: {
            reviewedFullName: data?.fullName ?? null
          }
        };
      }
    },
    {
      subtask: DEMO_EXAMPLE_FORM_SPACE_RECORD_SUBTASK,
      fn: async (input) => {
        return {
          completion: DEMO_EXAMPLE_FORM_SPACE_RECORD_SUBTASK,
          updateMetadata: {
            ...input.subtaskData,
            recorded: true
          }
        };
      }
    }
  ]
};
