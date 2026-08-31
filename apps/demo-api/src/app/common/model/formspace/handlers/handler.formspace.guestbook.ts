import { type FormSpaceSubmissionProcessorConfig } from '@dereekb/firebase-server/model';
import { DEMO_GUESTBOOK_FORM_SPACE_TYPE, type DemoGuestbookFormSpaceData } from 'demo-firebase';

/**
 * The only checkpoint {@link DEMO_GUESTBOOK_FORM_SPACE_PROCESSOR} runs.
 */
export const DEMO_GUESTBOOK_FORM_SPACE_CLOSE_SUBTASK = 'close';

/**
 * The demo app's submission processor for {@link DEMO_GUESTBOOK_FORM_SPACE_TYPE}.
 *
 * Archives the space on completion. Submitting a SHARED album is the guestbook owner closing it to further
 * uploads — there is nothing downstream to hand it to — so ARCHIVED, rather than a submitted space sitting
 * in a queue nobody drains, is what "done" means here.
 */
export const DEMO_GUESTBOOK_FORM_SPACE_PROCESSOR: FormSpaceSubmissionProcessorConfig = {
  target: DEMO_GUESTBOOK_FORM_SPACE_TYPE,
  flow: [
    {
      subtask: DEMO_GUESTBOOK_FORM_SPACE_CLOSE_SUBTASK,
      fn: async (input) => {
        const formSpace = await input.loadFormSpace();
        const data = formSpace.d as DemoGuestbookFormSpaceData | undefined;

        return {
          completion: DEMO_GUESTBOOK_FORM_SPACE_CLOSE_SUBTASK,
          updateMetadata: {
            caption: data?.caption ?? null,
            closedWithFileCount: formSpace.f.length
          }
        };
      }
    }
  ]
};
