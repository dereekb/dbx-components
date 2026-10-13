import { assertIsAdminInRequest, assertValidParams, executeOnCallQuery, withApiDetails, type OnCallQueryModelRequest } from '@dereekb/firebase-server';
import { type OnCallQueryModelResult } from '@dereekb/firebase';
import { type OpenRouterPrompt, type QueryOpenRouterPromptsParams, openRouterPromptsWithStateQuery, queryOpenRouterPromptsParamsType } from '@dereekb/openrouter/firebase';
import { type DemoApiNestContext, type DemoQueryModelFunction } from '../function.context';

/**
 * Queries the app's {@link OpenRouterPrompt}s.
 *
 * The standard query operation rather than a bespoke list: pagination, the cursor and its permission
 * check all come from {@link executeOnCallQuery}, and the result carries the stored documents instead of
 * a projection that has to be kept in step with the model.
 *
 * Admin-gated in the request rather than through a role, because a prompt has no owner to relate a role
 * to — it is operational configuration for the whole app.
 */
export const openRouterPromptQuery: DemoQueryModelFunction<QueryOpenRouterPromptsParams, OnCallQueryModelResult<OpenRouterPrompt>> = withApiDetails({
  inputType: queryOpenRouterPromptsParamsType,
  fn: async (request: OnCallQueryModelRequest<DemoApiNestContext, QueryOpenRouterPromptsParams>) => {
    const { nest } = request;

    assertIsAdminInRequest(request);

    // nothing else validates a query's params, so an unknown state would otherwise quietly match no prompt
    const params = assertValidParams(queryOpenRouterPromptsParamsType, request.data);

    return executeOnCallQuery<OpenRouterPrompt>({
      params,
      collection: nest.demoFirestoreCollections.openRouterPromptCollection,
      loadCursorDocument: async (key) => {
        const document = await nest.useModel('openRouterPrompt', {
          request,
          key,
          roles: 'read',
          use: (x) => x.document
        });

        return document.accessor.get();
      },
      buildConstraints: () => (params.state == null ? [] : openRouterPromptsWithStateQuery({ state: params.state }))
    });
  }
});
