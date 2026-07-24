import { type Maybe } from '@dereekb/util';
import { type FirestoreModelType, type OidcModelScopeRequirement, type OidcScopeTerm, type OnCallTypedModelParams } from '@dereekb/firebase';
import { type CallableRequest } from 'firebase-functions/v2/https';
import { Injectable, Inject, type INestApplicationContext } from '@nestjs/common';
import { type Request } from 'express';
import { type OnCallWithNestContext, type OnCallWithNestContextRequest, setNestContextOnRequest } from '../../function/call';
import { injectNestApplicationContextIntoRequest } from '../../function/nest';
import { type OnCallApiDetailsRef, type OnCallModelApiDetails, type ModelApiDetailsResult, getModelApiDetails, resolveRequiredScopeFromApiDetails } from '../../model/api.details';
import { type MakeNestContext } from '../../nest.provider';
import { type FirebaseServerAuthData } from '../auth.context.server';
import { type ModelApiOidcScopeConfig, assertModelApiOidcScope, oidcScopesFromModelApiAuth } from './model.api.scope';

// MARK: Types
/**
 * The combined type of the function returned by onCallModel() with _apiDetails attached.
 */
export type OnCallModelFnWithApiDetails = OnCallWithNestContext<unknown, OnCallTypedModelParams> & OnCallApiDetailsRef;

// MARK: Config
/**
 * Abstract injectable config token for the Model API dispatch layer.
 *
 * Downstream apps provide this by creating a concrete provider that references
 * their onCallModel() return value and MakeNestContext factory.
 *
 * @example
 * ```typescript
 * {
 *   provide: ModelApiDispatchConfig,
 *   useValue: {
 *     callModelFn: demoCallModelFn,
 *     makeNestContext: mapDemoApiNestContext
 *   }
 * }
 * ```
 */
export abstract class ModelApiDispatchConfig implements ModelApiOidcScopeConfig {
  /**
   * The onCallModel() return value with _apiDetails attached.
   */
  readonly callModelFn!: OnCallModelFnWithApiDetails;
  /**
   * Factory to create typed nest context from INestApplicationContext.
   */
  readonly makeNestContext!: MakeNestContext<unknown>;
  /**
   * Optional model-api-layer OIDC group-scope default. See {@link ModelApiOidcScopeConfig.defaultRequiredScope}.
   * This is the home for the callModel group-scope default; providing it here enforces it across
   * dispatch AND the `/get` reads.
   */
  readonly defaultRequiredScope?: OidcScopeTerm;
  /**
   * Optional per-model OIDC group-scope overrides. See {@link ModelApiOidcScopeConfig.modelRequiredScopes}.
   * The only place a plain `/get` read (no per-function handler) can be scope-gated beyond `model.read`.
   */
  readonly modelRequiredScopes?: Record<FirestoreModelType, OidcModelScopeRequirement>;
}

/**
 * Injection token for providing the NestJS application context to the dispatch service.
 *
 * The app module metadata factory creates a provider for this token
 * using the module's own INestApplicationContext.
 */
export const MODEL_API_NEST_APPLICATION_CONTEXT = 'MODEL_API_NEST_APPLICATION_CONTEXT';

// MARK: Service
/**
 * Service that bridges HTTP/MCP requests to the callModel dispatch chain.
 *
 * Builds a synthetic {@link CallableRequest} from the HTTP request auth and body,
 * injects the NestJS application context and typed nest context, then invokes
 * the callModel function.
 */
@Injectable()
export class ModelApiCallModelDispatchService {
  constructor(
    @Inject(ModelApiDispatchConfig) private readonly config: ModelApiDispatchConfig,
    @Inject(MODEL_API_NEST_APPLICATION_CONTEXT) private readonly nestApplication: INestApplicationContext
  ) {}

  /**
   * Dispatch to the callModel chain.
   *
   * @param params - The typed model params (call, modelType, specifier, data).
   * @param auth - The authenticated user's auth data from the OIDC middleware.
   * @param rawRequest - The raw Express request.
   * @returns The handler's return value.
   */
  async dispatch(params: OnCallTypedModelParams, auth: Maybe<FirebaseServerAuthData>, rawRequest: Request): Promise<unknown> {
    // Enforce OIDC scope BEFORE dispatching — the relocated home of the callModel scope check.
    // AND-of-ORs across the per-verb `model.<call>` scope and the effective group term (per-function
    // `requiredScope` > per-model requirement > module default), bypassing non-OIDC callers. A nullish
    // `call` is a malformed request the callModel chain rejects downstream (no model op to authorize).
    const { call, modelType, specifier } = params;

    if (call != null) {
      const apiDetails = this.config.callModelFn._apiDetails as Maybe<OnCallModelApiDetails>;
      const requiredScope = apiDetails == null ? undefined : resolveRequiredScopeFromApiDetails(apiDetails, call, modelType, specifier);

      assertModelApiOidcScope({
        call,
        modelType,
        requiredScope,
        defaultRequiredScope: this.config.defaultRequiredScope,
        modelRequiredScopes: this.config.modelRequiredScopes,
        grantedScopes: oidcScopesFromModelApiAuth(auth)
      });
    }

    // Build a synthetic CallableRequest that the dispatch chain expects. Layer the
    // OIDC-validated claim subset over the base token so standard JWT claims
    // (`iat`, `auth_time`, `email`, …) survive — the callModel chain and any
    // `authContextInfo` consumer downstream rely on them being present.
    const callableRequest = {
      data: params,
      auth: auth
        ? {
            uid: auth.uid,
            token: { ...(auth as any).token, ...(auth as any).oidcValidatedToken }
          }
        : undefined,
      rawRequest: rawRequest as any,
      acceptsStreaming: false
    } as CallableRequest<OnCallTypedModelParams>;

    // Inject NestJS application context
    const appRequest = injectNestApplicationContextIntoRequest(this.nestApplication, callableRequest);

    // Inject typed nest context
    const contextRequest: OnCallWithNestContextRequest<unknown, OnCallTypedModelParams> = setNestContextOnRequest(this.config.makeNestContext, appRequest);

    return this.config.callModelFn(contextRequest);
  }

  /**
   * Returns the model-first API details view, or undefined if no handlers have _apiDetails.
   *
   * @returns The aggregated API details describing all registered model call handlers, or undefined if unavailable.
   */
  getApiDetails(): Maybe<ModelApiDetailsResult> {
    return getModelApiDetails(this.config.callModelFn);
  }
}
