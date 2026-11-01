import { assertIsAdminInRequest, badRequestError, withApiDetails } from '@dereekb/firebase-server';
import { type PreviewOpenRouterTemplateParams, type PreviewOpenRouterTemplateResult, previewOpenRouterTemplateParamsType } from '@dereekb/openrouter/firebase';
import { type DemoInvokeModelFunction } from '../function.context';

export const openRouterPromptPreviewTemplate: DemoInvokeModelFunction<PreviewOpenRouterTemplateParams, PreviewOpenRouterTemplateResult> = withApiDetails({
  inputType: previewOpenRouterTemplateParamsType,
  mcp: {
    // With `callModel` a preview makes the model call a render would, which costs money.
    escalatingParams: { callModel: { destructive: true } }
  },
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    if (data.key == null) {
      throw badRequestError({ message: 'An OpenRouterPrompt key is required.' });
    }

    const previewOpenRouterTemplate = await nest.openRouterPromptActions.previewOpenRouterTemplate(data);
    const document = nest.demoFirestoreCollections.openRouterPromptCollection.documentAccessor().loadDocumentForKey(data.key);

    return previewOpenRouterTemplate(document);
  }
});
