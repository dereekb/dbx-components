import { type CreateUserExternalConnectionParams, createUserExternalConnectionParamsType, onCallCreateModelResultWithDocs } from '@dereekb/firebase';
import { withApiDetails } from '@dereekb/firebase-server';
import { type DemoCreateModelFunction } from '../function.context';

/**
 * Creates the calling user's connection document.
 *
 * This is where "may this user have external connections at all?" belongs. Every other
 * client-reachable operation asserts a role against the document, and a role map is only consulted
 * for a document that exists — so gating creation gates the whole feature for a user, and neither
 * the connect handoff nor the disconnect write has to carry an entry policy of its own.
 *
 * The demo allows any authenticated user; an app with its own rule (a plan tier, an admin-granted
 * flag) asserts it here.
 */
export const userExternalConnectionCreate: DemoCreateModelFunction<CreateUserExternalConnectionParams> = withApiDetails({
  inputType: createUserExternalConnectionParamsType,
  fn: async (request) => {
    const { nest, auth } = request;
    const uid = auth.uid;

    const document = await nest.userExternalConnectionActions.createUserExternalConnection({ uid });
    return onCallCreateModelResultWithDocs(document);
  }
});
