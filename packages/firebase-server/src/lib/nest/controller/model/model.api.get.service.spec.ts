import { HttpsError } from 'firebase-functions/https';
import { CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE, type OidcModelScopeRequirement, type OidcScopeTerm } from '@dereekb/firebase';
import { forbiddenError, notFoundError } from '../../../function/error';
import { nestFirebaseDoesNotExistError } from '../../model/permission.error';
import { ModelApiGetService, modelAccessReadErrorFromUseMultipleModelsFailure } from './model.api.get.service';
import { type ModelApiDispatchConfig } from './model.api.dispatch';

describe('modelAccessReadErrorFromUseMultipleModelsFailure()', () => {
  it('unwraps HttpsError messages and codes from permission-denied failures', () => {
    const err = forbiddenError('forbidden');
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: err });

    expect(mapped.key).toBe('gb/abc');
    expect(mapped.message).toBe('forbidden');
    expect(mapped.code).toBe('FORBIDDEN');
  });

  it('uses the HttpsError.message when no details.message is present', () => {
    const err = new HttpsError('permission-denied', 'plain https message');
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: err });

    expect(mapped.message).toBe('plain https message');
    expect(mapped.code).toBe('permission-denied');
  });

  it('falls through to plain Error.message when not an HttpsError', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: new Error('boom') });

    expect(mapped.message).toBe('boom');
    expect(mapped.code).toBeUndefined();
  });

  it('returns a generic fallback when the error has neither a message nor a recognizable code', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: undefined });

    expect(mapped.message).toBe('unknown error');
    expect(mapped.code).toBeUndefined();
  });

  // A messageless HttpsError-shaped failure: `firebaseServerErrorInfo` classifies it (code + httpErrorCode
  // + toJSON) but no message survives, so the mapper must derive the message from the code — keeping
  // not-found distinct from permission-denied instead of conflating them.
  function messagelessHttpsError(input: { code: string; details?: { status: number; code: string } }): unknown {
    return { code: input.code, httpErrorCode: { status: input.code }, toJSON: () => ({}), ...(input.details ? { details: input.details } : {}) };
  }

  it('derives "not found" from the Firebase not-found code when no message is present', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: messagelessHttpsError({ code: 'not-found' }) });

    expect(mapped.message).toBe('not found');
    expect(mapped.code).toBe('not-found');
  });

  it('derives "permission denied" from the Firebase permission-denied code when no message is present', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: messagelessHttpsError({ code: 'permission-denied' }) });

    expect(mapped.message).toBe('permission denied');
    expect(mapped.code).toBe('permission-denied');
  });

  it('derives "not found" from the NOT_FOUND server error code when no message is present', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: messagelessHttpsError({ code: 'internal', details: { status: 404, code: 'NOT_FOUND' } }) });

    expect(mapped.message).toBe('not found');
    expect(mapped.code).toBe('NOT_FOUND');
  });

  it('derives "permission denied" from the FORBIDDEN server error code when no message is present', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: messagelessHttpsError({ code: 'internal', details: { status: 403, code: 'FORBIDDEN' } }) });

    expect(mapped.message).toBe('permission denied');
    expect(mapped.code).toBe('FORBIDDEN');
  });

  it('still prefers the real HttpsError message over the code-derived fallback', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: notFoundError('the document is gone') });

    expect(mapped.message).toBe('the document is gone');
    expect(mapped.code).toBe('NOT_FOUND');
  });

  // MODEL_NOT_AVAILABLE is the code a genuinely missing document produces here — the per-key
  // existence check throws nestFirebaseDoesNotExistError() === modelNotAvailableError(). It was
  // absent from the code-derived fallback, so a messageless miss read as "unknown error".
  it('derives "not found" from the MODEL_NOT_AVAILABLE server error code when no message is present', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'gb/abc', error: messagelessHttpsError({ code: 'internal', details: { status: 404, code: 'MODEL_NOT_AVAILABLE' } }) });

    expect(mapped.message).toBe('not found');
    expect(mapped.code).toBe('MODEL_NOT_AVAILABLE');
  });

  it('maps the real missing-document error a failed read produces to a not-found message', () => {
    const mapped = modelAccessReadErrorFromUseMultipleModelsFailure({ key: 'jd/abc', error: nestFirebaseDoesNotExistError({ data: { document: { key: 'jd/abc', modelType: 'jobDistrict' } } } as any) });

    expect(mapped.key).toBe('jd/abc');
    expect(mapped.message).toBe('model was not available');
    expect(mapped.code).toBe('MODEL_NOT_AVAILABLE');
  });
});

// MARK: Per-key error reporting on the multi-read (/get) path
// REGRESSION: a missing document reported a bare "unknown error" for every model. The root cause was
// upstream — performAsyncTasks discarded the caught error, so useMultipleModels handed this path a
// failure entry whose `error` was undefined and no message or code could survive. These assert the
// readDocuments wiring turns a real failure entry into an actionable { message, code }.
describe('ModelApiGetService — readDocuments per-key errors', () => {
  function buildServiceWithFailures(errors: { key: string; error: unknown }[]) {
    const useMultipleModels = vi.fn(async (_modelType: any, opts: any) => opts.use([], { errors, abortedEarly: false }));
    const config: ModelApiDispatchConfig = {
      callModelFn: (() => undefined) as any,
      makeNestContext: (() => ({ useMultipleModels })) as any
    };

    return new ModelApiGetService(config, {} as any);
  }

  it('reports a missing document as not-found rather than a generic "unknown error"', async () => {
    const service = buildServiceWithFailures([{ key: 'jd/missing', error: nestFirebaseDoesNotExistError({ data: { document: { key: 'jd/missing', modelType: 'jobDistrict' } } } as any) }]);
    const result = await service.readDocuments('jobDistrict', ['jd/missing'], undefined);

    expect(result.results).toEqual([]);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].key).toBe('jd/missing');
    expect(result.errors[0].code).toBe('MODEL_NOT_AVAILABLE');
    expect(result.errors[0].message).not.toBe('unknown error');
  });

  it('keeps a permission failure distinct from a missing document', async () => {
    const service = buildServiceWithFailures([
      { key: 'jd/missing', error: nestFirebaseDoesNotExistError({ data: { document: { key: 'jd/missing', modelType: 'jobDistrict' } } } as any) },
      { key: 'jd/forbidden', error: forbiddenError('forbidden') }
    ]);
    const result = await service.readDocuments('jobDistrict', ['jd/missing', 'jd/forbidden'], undefined);

    expect(result.errors.map((x) => x.code)).toEqual(['MODEL_NOT_AVAILABLE', 'FORBIDDEN']);
  });
});

// MARK: OIDC scope enforcement on the direct-read (/get) path
describe('ModelApiGetService — OIDC scope enforcement on direct reads', () => {
  interface BuildServiceInput {
    readonly defaultRequiredScope?: OidcScopeTerm;
    readonly modelRequiredScopes?: Record<string, OidcModelScopeRequirement>;
  }

  // A stub nest context whose read paths resolve a fixed document, so an ALLOWED read returns cleanly
  // and we can assert the scope gate ran BEFORE the read (the spy is untouched on a rejection).
  function buildService(input?: BuildServiceInput) {
    const useModel = vi.fn(async (_modelType: any, opts: any) => opts.use({ document: { accessor: { get: async () => ({ data: () => ({ name: 'Doc' }) }) } } }));
    const useMultipleModels = vi.fn(async (_modelType: any, opts: any) => opts.use([{ document: { accessor: { get: async () => ({ data: () => ({ name: 'Doc' }) }), documentRef: { path: 'gb/1' } } } }], { errors: [] }));
    const nestContext = { useModel, useMultipleModels };

    const config: ModelApiDispatchConfig = {
      callModelFn: (() => undefined) as any,
      makeNestContext: (() => nestContext) as any,
      defaultRequiredScope: input?.defaultRequiredScope,
      modelRequiredScopes: input?.modelRequiredScopes
    };

    const service = new ModelApiGetService(config, {} as any);
    return { service, useModel, useMultipleModels };
  }

  function oidcAuth(scope: string | undefined): any {
    return scope === undefined ? undefined : { uid: 'user-1', oidcValidatedToken: { sub: 'user-1', scope } };
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

  it('REGRESSION: gates a plain /get read on model.read (previously ungated)', async () => {
    const { service, useModel } = buildService();

    // An OIDC caller lacking model.read is now blocked before the Firestore read runs.
    expect(await codeOfRejected(() => service.readDocument('guestbook', 'gb/1', oidcAuth('openid demo')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
    expect(useModel).not.toHaveBeenCalled();
  });

  it('allows a plain /get read when the caller holds model.read', async () => {
    const { service, useModel } = buildService();
    const result = await service.readDocument('guestbook', 'gb/1', oidcAuth('openid model.read'));

    expect(result).toEqual({ key: 'gb/1', data: { name: 'Doc' } });
    expect(useModel).toHaveBeenCalledTimes(1);
  });

  it('bypasses a non-OIDC caller (no scope claim) — unchanged behavior', async () => {
    const { service, useModel } = buildService();
    await service.readDocument('guestbook', 'gb/1', { uid: 'user-1', token: {} } as any);

    expect(useModel).toHaveBeenCalledTimes(1);
  });

  it('gates readDocuments (multi) on model.read too', async () => {
    const { service, useMultipleModels } = buildService();

    expect(await codeOfRejected(() => service.readDocuments('guestbook', ['gb/1', 'gb/2'], oidcAuth('openid')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
    expect(useMultipleModels).not.toHaveBeenCalled();
  });

  it('applies a per-model OR-group requirement to /get reads (confines a subset-scoped client)', async () => {
    const { service, useModel } = buildService({ defaultRequiredScope: 'hellosubs', modelRequiredScopes: { workerAcademyProgress: ['hellosubs', 'lms'] } });

    // lms client reads the lms-tagged model...
    await expect(service.readDocument('workerAcademyProgress', 'wap/1', oidcAuth('openid model.read lms'))).resolves.toEqual({ key: 'wap/1', data: { name: 'Doc' } });
    // ...but is blocked from an untagged model (hellosubs default applies), even holding model.read.
    expect(await codeOfRejected(() => service.readDocument('guestbook', 'gb/1', oidcAuth('openid model.read lms')))).toBe(CALL_MODEL_MISSING_OIDC_SCOPE_ERROR_CODE);
    expect(useModel).toHaveBeenCalledTimes(1);
  });
});
