import { CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE, type OidcModelScopeRequirement, type OidcScopeTerm, type OnCallTypedModelParams } from '@dereekb/firebase';
import { type Request } from 'express';
import { ModelApiCallModelDispatchService, type ModelApiDispatchConfig } from './model.api.dispatch';

// MARK: Helpers
const DISPATCH_SENTINEL = { ok: true } as const;

interface BuildServiceInput {
  readonly requiredScope?: OidcScopeTerm; // per-function scope registered on the fake callModelFn
  readonly defaultRequiredScope?: OidcScopeTerm;
  readonly modelRequiredScopes?: Record<string, OidcModelScopeRequirement>;
}

function buildService(input?: BuildServiceInput): { service: ModelApiCallModelDispatchService; callModelFn: ReturnType<typeof vi.fn> } {
  const callModelFn = vi.fn(async () => DISPATCH_SENTINEL);
  // Attach an _apiDetails tree with a per-function requiredScope on create/guestbook/`_`, mirroring
  // what `onCallModel` produces from `withApiDetails({ requiredScope })`.
  (callModelFn as any)._apiDetails = input?.requiredScope == null ? undefined : { create: { modelTypes: { guestbook: { isSpecifier: false, specifiers: { _: { requiredScope: input.requiredScope } } } } } };

  const config: ModelApiDispatchConfig = {
    callModelFn: callModelFn as any,
    makeNestContext: (() => ({})) as any,
    defaultRequiredScope: input?.defaultRequiredScope,
    modelRequiredScopes: input?.modelRequiredScopes
  };

  const service = new ModelApiCallModelDispatchService(config, {} as any);
  return { service, callModelFn };
}

function oidcAuth(scope: string | undefined): any {
  return scope === undefined ? undefined : { uid: 'user-1', oidcValidatedToken: { sub: 'user-1', scope } };
}

function createParams(modelType = 'guestbook'): OnCallTypedModelParams {
  return { call: 'create', modelType, specifier: undefined, data: {} } as OnCallTypedModelParams;
}

async function codeOfRejected(fn: () => Promise<unknown>): Promise<string | undefined> {
  let caught: any;

  try {
    await fn();
  } catch (e) {
    caught = e;
  }

  const details = caught?.details ?? caught?.errorInfo?.details ?? caught;
  return details?.code ?? caught?.code;
}

// MARK: Tests
describe('ModelApiCallModelDispatchService.dispatch() — OIDC scope enforcement', () => {
  const rawRequest = {} as Request;

  it('bypasses a non-OIDC caller and dispatches to callModelFn', async () => {
    const { service, callModelFn } = buildService();
    const result = await service.dispatch(createParams(), oidcAuth(undefined), rawRequest);

    expect(result).toBe(DISPATCH_SENTINEL);
    expect(callModelFn).toHaveBeenCalledTimes(1);
  });

  it('dispatches when the OIDC caller holds the matching per-verb scope', async () => {
    const { service, callModelFn } = buildService();
    const result = await service.dispatch(createParams(), oidcAuth('openid model.create'), rawRequest);

    expect(result).toBe(DISPATCH_SENTINEL);
    expect(callModelFn).toHaveBeenCalledTimes(1);
  });

  it('rejects (before dispatch) when the per-verb scope is missing', async () => {
    const { service, callModelFn } = buildService();
    const code = await codeOfRejected(() => service.dispatch(createParams(), oidcAuth('openid model.read'), rawRequest));

    expect(code).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
    expect(callModelFn).not.toHaveBeenCalled();
  });

  it('enforces the per-function requiredScope resolved from _apiDetails (AND, finest wins)', async () => {
    const { service, callModelFn } = buildService({ requiredScope: 'lms' });

    // holds per-verb but not the per-function lms → rejected, no dispatch
    expect(await codeOfRejected(() => service.dispatch(createParams(), oidcAuth('openid model.create'), rawRequest))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
    expect(callModelFn).not.toHaveBeenCalled();

    // holds both → dispatches
    const result = await service.dispatch(createParams(), oidcAuth('openid model.create lms'), rawRequest);
    expect(result).toBe(DISPATCH_SENTINEL);
    expect(callModelFn).toHaveBeenCalledTimes(1);
  });

  it('enforces the module default group scope', async () => {
    const { service, callModelFn } = buildService({ defaultRequiredScope: 'hellosubs' });

    expect(await codeOfRejected(() => service.dispatch(createParams(), oidcAuth('openid model.create'), rawRequest))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
    expect(callModelFn).not.toHaveBeenCalled();

    const result = await service.dispatch(createParams(), oidcAuth('openid model.create hellosubs'), rawRequest);
    expect(result).toBe(DISPATCH_SENTINEL);
  });

  it('enforces a per-model OR-group and confines a subset-scoped client', async () => {
    const { service } = buildService({ defaultRequiredScope: 'hellosubs', modelRequiredScopes: { workerAcademyProgress: ['hellosubs', 'lms'] } });

    // lms client reaches the lms-tagged model...
    await expect(service.dispatch(createParams('workerAcademyProgress'), oidcAuth('openid model.create lms'), rawRequest)).resolves.toBe(DISPATCH_SENTINEL);
    // ...but is blocked from an untagged model (hellosubs default applies, lms client lacks it).
    expect(await codeOfRejected(() => service.dispatch(createParams('guestbook'), oidcAuth('openid model.create lms'), rawRequest))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
  });
});
