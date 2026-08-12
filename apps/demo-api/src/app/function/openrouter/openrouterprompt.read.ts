import { assertIsAdminInRequest, badRequestError, withApiDetails } from '@dereekb/firebase-server';
import { type ListOpenRouterPromptsParams, type ListOpenRouterPromptsResult, type ReadOpenRouterPromptParams, type ReadOpenRouterPromptResult, listOpenRouterPromptsParamsType, readOpenRouterPromptParamsType } from '@dereekb/openrouter/firebase';
import { type DemoReadModelFunction } from '../function.context';

/**
 * Reads an {@link OpenRouterPrompt}, optionally pinned to one version.
 */
export const openRouterPromptRead: DemoReadModelFunction<ReadOpenRouterPromptParams, ReadOpenRouterPromptResult> = withApiDetails({
  inputType: readOpenRouterPromptParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    if (data.key == null) {
      throw badRequestError({ message: 'An OpenRouterPrompt key is required.' });
    }

    const readOpenRouterPrompt = await nest.openRouterPromptActions.readOpenRouterPrompt(data);
    const document = nest.demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocumentForKey(data.key);

    return readOpenRouterPrompt(document);
  }
});

/**
 * Lists the app's {@link OpenRouterPrompt}s.
 */
export const openRouterPromptList: DemoReadModelFunction<ListOpenRouterPromptsParams, ListOpenRouterPromptsResult> = withApiDetails({
  inputType: listOpenRouterPromptsParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);
    return nest.openRouterPromptActions.listOpenRouterPrompts(data);
  }
});
