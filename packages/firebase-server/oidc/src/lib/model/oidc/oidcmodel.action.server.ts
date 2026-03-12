import { type CreateOidcClientParams, createOidcClientParamsType, type CreateOidcClientResult, type UpdateOidcClientParams, updateOidcClientParamsType, type DeleteOidcClientParams, deleteOidcClientParamsType, readFirestoreModelKey } from '@dereekb/firebase';
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
  abstract createOidcClient(params: CreateOidcClientParams): Promise<TransformAndValidateFunctionResult<CreateOidcClientParams, () => Promise<CreateOidcClientResult>>>;
  abstract updateOidcClient(params: UpdateOidcClientParams): Promise<TransformAndValidateFunctionResult<UpdateOidcClientParams, () => Promise<void>>>;
  abstract deleteOidcClient(params: DeleteOidcClientParams): Promise<TransformAndValidateFunctionResult<DeleteOidcClientParams, () => Promise<void>>>;
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
 * const result = await createFn();
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
    return async (): Promise<CreateOidcClientResult> => {
      return oidcClientService.createClient(params);
    };
  });
}

/**
 * Factory for the `updateOidcClient` action.
 *
 * Delegates to {@link OidcClientService.updateClient} to apply plaintext field updates.
 */
export function updateOidcClientFactory(context: OidcModelServerActionsContext) {
  const { oidcClientService, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(updateOidcClientParamsType, async (params) => {
    const key = readFirestoreModelKey(params, true);

    return async (): Promise<void> => {
      await oidcClientService.updateClient(key, params);
    };
  });
}

/**
 * Factory for the `deleteOidcClient` action.
 *
 * Delegates to {@link OidcClientService.deleteClient}.
 */
export function deleteOidcClientFactory(context: OidcModelServerActionsContext) {
  const { oidcClientService, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(deleteOidcClientParamsType, async (params) => {
    const key = readFirestoreModelKey(params, true);

    return async (): Promise<void> => {
      await oidcClientService.deleteClient(key);
    };
  });
}
