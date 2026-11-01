import { assertIsAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
import { type OnCallCreateModelResult } from '@dereekb/firebase';
import { type CreateOpenRouterTemplateParams, createOpenRouterTemplateParamsType } from '@dereekb/openrouter/firebase';
import { type DemoCreateModelFunction } from '../function.context';

export const openRouterPromptCreateTemplate: DemoCreateModelFunction<CreateOpenRouterTemplateParams, OnCallCreateModelResult> = withApiDetails({
  inputType: createOpenRouterTemplateParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    const createOpenRouterTemplate = await nest.openRouterPromptActions.createOpenRouterTemplate(data);
    return createOpenRouterTemplate();
  }
});
