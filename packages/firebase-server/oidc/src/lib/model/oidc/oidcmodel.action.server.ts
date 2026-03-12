import { type CreateOidcClientParams, createOidcClientParamsType, type CreateOidcClientResult, type UpdateOidcClientParams, updateOidcClientParamsType, type DeleteOidcClientParams, deleteOidcClientParamsType, readFirestoreModelKey, oidcEntryIdentity, firestoreModelKey } from '@dereekb/firebase';
import { type FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { type OidcClientService } from '../../service/client.service';

// MARK: Context
/**
 * Context providing the OIDC client service and server action utilities needed by OIDC model server actions.
 */
export interface OidcModelServerActionsContext extends FirebaseServerActionsContext {
  /**
   * Service for managing OIDC client adapter entries.
   */
  readonly oidcClientService: OidcClientService;
}

// MARK: Server Actions
/**
 * Abstract service class defining all server-side OIDC client CRUD actions.
 *
 * @see {@link oidcModelServerActions} for the concrete implementation factory.
 */
export abstract class OidcModelServerActions {
  abstract createOidcClient(params: CreateOidcClientParams): Promise<TransformAndValidateFunctionResult<CreateOidcClientParams, (uid: string) => Promise<CreateOidcClientResult>>>;
  abstract updateOidcClient(params: UpdateOidcClientParams): Promise<TransformAndValidateFunctionResult<UpdateOidcClientParams, (uid: string) => Promise<void>>>;
  abstract deleteOidcClient(params: DeleteOidcClientParams): Promise<TransformAndValidateFunctionResult<DeleteOidcClientParams, (uid: string) => Promise<void>>>;
}

/**
 * Creates a concrete {@link OidcModelServerActions} implementation wired to the provided context.
 *
 * @param context - the fully assembled OIDC model server actions context
 *
 * @example
 * ```ts
 * const actions = oidcModelServerActions(context);
 * const createFn = await actions.createOidcClient({ client_name: 'My App', redirect_uris: ['...'] });
 * const result = await createFn(auth.uid);
 * ```
 */
export function oidcModelServerActions(context: OidcModelServerActionsContext): OidcModelServerActions {
  return {
    createOidcClient: createOidcClientFactory(context),
    updateOidcClient: updateOidcClientFactory(context),
    deleteOidcClient: deleteOidcClientFactory(context)
  };
}

// MARK: Actions
/**
 * Factory for the `createOidcClient` action.
 *
 * Delegates to {@link OidcClientService.createClient} to generate a `client_id` and `client_secret`,
 * create the adapter entry, and return the secret in plaintext (only returned once).
 */
export function createOidcClientFactory(context: OidcModelServerActionsContext) {
  const { oidcClientService, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(createOidcClientParamsType, async (params) => {
    return async (uid: string): Promise<CreateOidcClientResult> => {
      const result = await oidcClientService.createClient(uid, params);
      const modelKey = firestoreModelKey(oidcEntryIdentity, result.clientId);

      return {
        modelKeys: [modelKey],
        client_id: result.clientId,
        client_secret: result.clientSecret
      };
    };
  });
}

/**
 * Factory for the `updateOidcClient` action.
 *
 * Delegates to {@link OidcClientService.updateClient} to apply plaintext field updates.
 * Only the owning user may update their client.
 */
export function updateOidcClientFactory(context: OidcModelServerActionsContext) {
  const { oidcClientService, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(updateOidcClientParamsType, async (params) => {
    const key = readFirestoreModelKey(params, true);

    return async (uid: string): Promise<void> => {
      await oidcClientService.updateClient(uid, key, params);
    };
  });
}

/**
 * Factory for the `deleteOidcClient` action.
 *
 * Delegates to {@link OidcClientService.deleteClient}.
 * Only the owning user may delete their client.
 */
export function deleteOidcClientFactory(context: OidcModelServerActionsContext) {
  const { oidcClientService, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(deleteOidcClientParamsType, async (params) => {
    const key = readFirestoreModelKey(params, true);

    return async (uid: string): Promise<void> => {
      await oidcClientService.deleteClient(uid, key);
    };
  });
}
