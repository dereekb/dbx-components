import { withApiDetails } from '@dereekb/firebase-server';
import { type CreateOpenRouterPromptVersionParams, type CreateOpenRouterPromptVersionResult, createOpenRouterPromptVersionParamsType } from '@dereekb/openrouter/firebase';
import { type DemoCreateModelFunction } from '../function.context';

/**
 * Creates a new {@link OpenRouterPromptVersion} for a prompt, locking the one it succeeds.
 *
 * The version number is allocated server-side inside a transaction, so two concurrent creates cannot
 * pick the same one and silently overwrite each other.
 *
 * The parent prompt is named in the params rather than inferred from the call's target, because the
 * target of a create is a document that does not exist yet. Loading it through `useModel` with the
 * `publish` role is what gates the call — the prompt's role map grants nothing to a non-admin, since a
 * prompt has no owner to relate a role to.
 */
export const openRouterPromptVersionCreate: DemoCreateModelFunction<CreateOpenRouterPromptVersionParams, CreateOpenRouterPromptVersionResult> = withApiDetails({
  inputType: createOpenRouterPromptVersionParamsType,
  fn: async (request) => {
    const { nest, data } = request;

    const createOpenRouterPromptVersion = await nest.openRouterPromptActions.createOpenRouterPromptVersion(data);
    const document = await nest.useModel('openRouterPrompt', {
      request,
      key: data.prompt,
      roles: 'publish',
      use: (x) => x.document
    });

    return createOpenRouterPromptVersion(document);
  }
});
