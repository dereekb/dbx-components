import { type FormSpaceSubmissionProcessorConfig } from '@dereekb/firebase-server/model';
import { DEMO_TEST_FORM_SPACE_TYPE, type DemoTestFormSpaceData } from 'demo-firebase';

/**
 * The only checkpoint {@link demoTestFormSpaceSubmissionProcessor} runs.
 */
export const DEMO_TEST_FORM_SPACE_RECORD_SUBTASK = 'record';

/**
 * Builds the demo app's submission processor for {@link DEMO_TEST_FORM_SPACE_TYPE}.
 *
 * One checkpoint, unlike {@link demoExampleFormSpaceSubmissionProcessor}'s two: the subtask framework's resume
 * behaviour already has coverage there, and this type exists to exercise the CLIENT, so the shortest
 * handler that still moves the space to SUCCESS is the honest one.
 *
 * @returns The submission processor config targeting the demo test form.
 */
export function demoTestFormSpaceSubmissionProcessor(): FormSpaceSubmissionProcessorConfig {
  const processorConfig: FormSpaceSubmissionProcessorConfig = {
    target: DEMO_TEST_FORM_SPACE_TYPE,
    flow: [
      {
        subtask: DEMO_TEST_FORM_SPACE_RECORD_SUBTASK,
        fn: async (input) => {
          const formSpace = await input.loadFormSpace();
          const data = formSpace.d as DemoTestFormSpaceData | undefined;

          return {
            completion: DEMO_TEST_FORM_SPACE_RECORD_SUBTASK,
            updateMetadata: {
              recordedTitle: data?.title ?? null,
              recordedFileCount: formSpace.f.length
            }
          };
        }
      }
    ]
  };

  return processorConfig;
}
