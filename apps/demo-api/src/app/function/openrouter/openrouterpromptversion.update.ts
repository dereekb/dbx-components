import { badRequestError, withApiDetails } from '@dereekb/firebase-server';
import { type UpdateOpenRouterPromptVersionParams, type UpdateOpenRouterPromptVersionResult, updateOpenRouterPromptVersionParamsType } from '@dereekb/openrouter/firebase';
import { type DemoUpdateModelFunction } from '../function.context';

/**
 * Edits an {@link OpenRouterPromptVersion} in place.
 *
 * Only the latest version of a prompt is editable: creating the next version locks the one before it,
 * and the action refuses a locked version. A correction to a locked version means creating a new one.
 */
export const openRouterPromptVersionUpdate: DemoUpdateModelFunction<UpdateOpenRouterPromptVersionParams, UpdateOpenRouterPromptVersionResult> = withApiDetails({
  inputType: updateOpenRouterPromptVersionParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    // `key` is optional on the params type — the framework infers it for a call that came in through a
    // model-targeted route — so a direct call with neither has to fail as a bad request rather than by
    // loading a document with an undefined id.
    if (data.key == null) {
      throw badRequestError({ message: 'An OpenRouterPromptVersion key is required.' });
    }

    const updateOpenRouterPromptVersion = await nest.openRouterPromptActions.updateOpenRouterPromptVersion(data);
    const document = await nest.useModel('openRouterPromptVersion', {
      request,
      key: data.key,
      roles: 'update',
      use: (x) => x.document
    });

    return updateOpenRouterPromptVersion(document);
  }
});
