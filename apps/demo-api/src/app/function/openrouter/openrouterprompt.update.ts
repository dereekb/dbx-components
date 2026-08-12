import { badRequestError, assertIsAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
import { type FirestoreModelKey } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type PublishOpenRouterPromptVersionParams, type PublishOpenRouterPromptVersionResult, type UpdateOpenRouterPromptParams, publishOpenRouterPromptVersionParamsType, updateOpenRouterPromptParamsType } from '@dereekb/openrouter/firebase';
import { type DemoUpdateModelFunction } from '../function.context';

/**
 * Asserts a target prompt key was supplied.
 *
 * `key` is optional on the params type — the framework infers it for a call that came in through a
 * model-targeted route — so a direct call with neither has to fail as a bad request rather than by
 * loading a document with an undefined id.
 *
 * @param key - The key from the request params.
 * @returns The key.
 */
function assertOpenRouterPromptKey(key: Maybe<FirestoreModelKey>): FirestoreModelKey {
  if (key == null) {
    throw badRequestError({ message: 'An OpenRouterPrompt key is required.' });
  }

  return key;
}

/**
 * Updates an {@link OpenRouterPrompt}'s metadata, lifecycle state, or active version.
 *
 * Notably absent: anything that changes what a version SAYS. Versions are immutable, so a correction
 * means publishing a new one.
 */
export const openRouterPromptUpdate: DemoUpdateModelFunction<UpdateOpenRouterPromptParams> = withApiDetails({
  inputType: updateOpenRouterPromptParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    const updateOpenRouterPrompt = await nest.openRouterPromptActions.updateOpenRouterPrompt(data);
    const document = nest.demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocumentForKey(assertOpenRouterPromptKey(data.key));

    await updateOpenRouterPrompt(document);
  }
});

/**
 * Publishes a new immutable version of an {@link OpenRouterPrompt}.
 *
 * The version number is allocated server-side inside a transaction, so two concurrent publishes cannot
 * pick the same one and silently overwrite each other.
 */
export const openRouterPromptPublishVersion: DemoUpdateModelFunction<PublishOpenRouterPromptVersionParams, PublishOpenRouterPromptVersionResult> = withApiDetails({
  inputType: publishOpenRouterPromptVersionParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    const publishOpenRouterPromptVersion = await nest.openRouterPromptActions.publishOpenRouterPromptVersion(data);
    const document = nest.demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocumentForKey(assertOpenRouterPromptKey(data.key));

    return publishOpenRouterPromptVersion(document);
  }
});
