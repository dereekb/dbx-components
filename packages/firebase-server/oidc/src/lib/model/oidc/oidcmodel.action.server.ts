import { type AsyncFirebaseFunctionCreateAction, type AsyncOidcEntryUpdateAction, type AsyncOidcEntryDeleteAction, type CreateOidcClientParams, createOidcClientParamsType, type CreateOidcClientResult, type UpdateOidcClientParams, updateOidcClientParamsType, type DeleteOidcClientParams, deleteOidcClientParamsType, type RotateOidcClientSecretParams, rotateOidcClientSecretParamsType, type RotateOidcClientSecretResult, type OidcEntryDocument } from '@dereekb/firebase';
import { type FirebaseServerActionsContext } from '@dereekb/firebase-server';
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
  abstract createOidcClient(params: CreateOidcClientParams): AsyncFirebaseFunctionCreateAction<CreateOidcClientParams, CreateOidcClientResult>;
  abstract updateOidcClient(params: UpdateOidcClientParams): AsyncOidcEntryUpdateAction<UpdateOidcClientParams>;
  abstract rotateOidcClientSecret(params: RotateOidcClientSecretParams): AsyncFirebaseFunctionCreateAction<RotateOidcClientSecretParams, RotateOidcClientSecretResult, OidcEntryDocument>;
  abstract deleteOidcClient(params: DeleteOidcClientParams): AsyncOidcEntryDeleteAction<DeleteOidcClientParams>;
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
    rotateOidcClientSecret: rotateOidcClientSecretFactory(context),
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
    return async (document: OidcEntryDocument): Promise<OidcEntryDocument> => {
      await oidcClientService.updateClient(document.id, params);
      return document;
    };
  });
}

/**
 * Factory for the `rotateOidcClientSecret` action.
 *
 * Delegates to {@link OidcClientService.rotateClientSecret} to generate a new secret
 * and return it in plaintext (only returned once).
 */
export function rotateOidcClientSecretFactory(context: OidcModelServerActionsContext) {
  const { oidcClientService, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(rotateOidcClientSecretParamsType, async (_params) => {
    return async (document: OidcEntryDocument): Promise<RotateOidcClientSecretResult> => {
      return oidcClientService.rotateClientSecret(document.id);
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
    return async (document: OidcEntryDocument): Promise<void> => {
      await oidcClientService.deleteClient(document.id);
    };
  });
}
