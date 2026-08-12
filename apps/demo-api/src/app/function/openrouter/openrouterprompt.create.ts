import { assertIsAdminInRequest, withApiDetails } from '@dereekb/firebase-server';
import { onCallCreateModelResultWithDocs } from '@dereekb/firebase';
import { type CreateOpenRouterPromptParams, createOpenRouterPromptParamsType } from '@dereekb/openrouter/firebase';
import { type DemoCreateModelFunction } from '../function.context';

/**
 * Creates an {@link OpenRouterPrompt}.
 *
 * There is no Angular screen for prompt authoring, and deliberately so: prompt CRUD reaching the model
 * API is what makes every one of these callable over the existing callModel surface.
 *
 * Admin-gated in the request rather than through a role, because a prompt has no owner to relate a role
 * to — it is operational configuration for the whole app.
 */
export const openRouterPromptCreate: DemoCreateModelFunction<CreateOpenRouterPromptParams> = withApiDetails({
  inputType: createOpenRouterPromptParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    assertIsAdminInRequest(request);

    const document = await nest.openRouterPromptActions.createOpenRouterPrompt(data);
    return onCallCreateModelResultWithDocs(document);
  }
});
