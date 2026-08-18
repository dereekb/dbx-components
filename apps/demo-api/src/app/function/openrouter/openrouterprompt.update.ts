import { badRequestError, assertIsAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
import { type UpdateOpenRouterPromptParams, updateOpenRouterPromptParamsType } from '@dereekb/openrouter/firebase';
import { type DemoUpdateModelFunction } from '../function.context';

/**
 * Updates an {@link OpenRouterPrompt}'s metadata, lifecycle state, or active version.
 *
 * Notably absent: anything that changes what a version SAYS. That is the version model's own update,
 * which edits the latest version in place and refuses one a newer version has locked.
 */
export const openRouterPromptUpdate: DemoUpdateModelFunction<UpdateOpenRouterPromptParams> = withApiDetails({
  inputType: updateOpenRouterPromptParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    // `key` is optional on the params type — the framework infers it for a call that came in through a
    // model-targeted route — so a direct call with neither has to fail as a bad request rather than by
    // loading a document with an undefined id.
    if (data.key == null) {
      throw badRequestError({ message: 'An OpenRouterPrompt key is required.' });
    }

    const updateOpenRouterPrompt = await nest.openRouterPromptActions.updateOpenRouterPrompt(data);
    const document = nest.demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocumentForKey(data.key);

    await updateOpenRouterPrompt(document);
  }
});
