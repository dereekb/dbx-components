import {
  type AsyncFirebaseFunctionCreateAction,
  type AsyncOidcEntryUpdateAction,
  type AsyncOidcEntryDeleteAction,
  type CreateOidcClientParams,
  createOidcClientParamsType,
  type CreateOidcClientResult,
  type UpdateOidcClientParams,
  updateOidcClientParamsType,
  type DeleteOidcClientParams,
  deleteOidcClientParamsType,
  type DeleteOidcTokenParams,
  deleteOidcTokenParamsType,
  type RotateOidcClientSecretParams,
  rotateOidcClientSecretParamsType,
  type RotateOidcClientSecretResult,
  type OidcEntryDocument
} from '@dereekb/firebase';
import { type FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { type OidcClientService } from '../../service/oidc.client.service';
import { type OidcService } from '../../service/oidc.service';

// MARK: Context
/**
 * Context providing the OIDC client service and server action utilities needed by OIDC model server actions.
 */
export interface OidcModelServerActionsContext extends FirebaseServerActionsContext {
  /**
   * Service for managing OIDC client adapter entries.
   */
  readonly oidcClientService: OidcClientService;
  /**
   * Core OIDC service used for grant revocation.
   */
  readonly oidcService: OidcService;
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
  abstract deleteOidcToken(params: DeleteOidcTokenParams): AsyncOidcEntryDeleteAction<DeleteOidcTokenParams>;
}

/**
 * Creates a concrete {@link OidcModelServerActions} implementation wired to the provided context.
 *
 * @param context - The fully assembled OIDC model server actions context.
 * @returns The concrete OidcModelServerActions instance.
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
    deleteOidcClient: deleteOidcClientFactory(context),
    deleteOidcToken: deleteOidcTokenFactory(context)
  };
}

// MARK: Actions
/**
 * Factory for the `createOidcClient` action.
 *
 * Delegates to {@link OidcClientService.createClient} to generate a `client_id` and `client_secret`,
 * create the adapter entry, and return the secret in plaintext (only returned once).
 *
 * @param context - The OIDC model server actions context.
 * @returns A transform function factory for creating OIDC clients.
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
 *
 * @param context - The OIDC model server actions context.
 * @returns A transform function factory for updating OIDC clients.
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
 *
 * @param context - The OIDC model server actions context.
 * @returns A transform function factory for rotating OIDC client secrets.
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
 *
 * @param context - The OIDC model server actions context.
 * @returns A transform function factory for deleting OIDC clients.
 */
export function deleteOidcClientFactory(context: OidcModelServerActionsContext) {
  const { oidcClientService, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(deleteOidcClientParamsType, async (_params) => {
    return async (document: OidcEntryDocument): Promise<void> => {
      await oidcClientService.deleteClient(document.id);
    };
  });
}

/**
 * Factory for the `deleteOidcToken` action.
 *
 * Asserts the target {@link OidcEntryDocument} is of type `Grant`, then delegates to
 * {@link OidcService.revokeGrant} so all grantable token entries (`AccessToken`,
 * `RefreshToken`, `AuthorizationCode`, `DeviceCode`, `BackchannelAuthenticationRequest`)
 * sharing the grant id are deleted along with the Grant entry itself.
 *
 * Per-user authorization (this user owns this Grant) is enforced upstream via the
 * model permission service before this action runs.
 *
 * @param context - The OIDC model server actions context.
 * @returns A transform function factory for revoking OIDC grants.
 */
export function deleteOidcTokenFactory(context: OidcModelServerActionsContext) {
  const { oidcService, firebaseServerActionTransformFunctionFactory } = context;

  return firebaseServerActionTransformFunctionFactory(deleteOidcTokenParamsType, async (_params) => {
    return async (document: OidcEntryDocument): Promise<void> => {
      const data = await document.snapshotData();

      if (data?.type !== 'Grant') {
        throw new Error('Only Grant entries can be revoked through this endpoint.');
      }

      await oidcService.revokeGrant(document.id);
    };
  });
}
