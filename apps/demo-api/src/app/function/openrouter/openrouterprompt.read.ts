import { badRequestError, assertIsAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
import { type ReadOpenRouterPromptParams, type ReadOpenRouterPromptResult, readOpenRouterPromptParamsType } from '@dereekb/openrouter/firebase';
import { type DemoReadModelFunction } from '../function.context';

/**
 * Reads an {@link OpenRouterPrompt} together with the version it actually serves.
 *
 * This is the read model-get cannot do. The stored prompt document holds only pointers — `av` and `lv` —
 * so fetching it by key answers which version is active without saying what that version contains, and
 * following the pointer by hand means addressing the version subcollection at a zero-padded id. It also
 * would not see the code definition that stands in when the store cannot serve or is behind it, which is
 * the state every unseeded environment is in.
 *
 * Admin-gated in the request rather than through a role, matching the query: a prompt is operational
 * configuration for the whole app and has no owner to relate a role to.
 */
export const openRouterPromptRead: DemoReadModelFunction<ReadOpenRouterPromptParams, ReadOpenRouterPromptResult> = withApiDetails({
  inputType: readOpenRouterPromptParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    // `key` is optional on the params type — the framework infers it for a call that came in through a
    // model-targeted route — so a direct call with neither has to fail as a bad request rather than by
    // loading a document with an undefined id.
    if (data.key == null) {
      throw badRequestError({ message: 'An OpenRouterPrompt key is required.' });
    }

    const readOpenRouterPrompt = await nest.openRouterPromptActions.readOpenRouterPrompt(data);
    const document = nest.demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocumentForKey(data.key);

    return readOpenRouterPrompt(document);
  }
});
