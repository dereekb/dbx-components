import { Controller, All, Get, Post, Body, Query, Param, Req, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { type Request } from 'express';
import { type OnCallTypedModelParams, type FirestoreModelKey } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type FirebaseServerAuthenticatedRequest } from '../auth.context.server';
import { ModelApiCallModelDispatchService } from './model.api.dispatch';
import { ModelApiGetService, MAX_MODEL_ACCESS_MULTI_READ_KEYS } from './model.api.get.service';

/**
 * HTTP methods allowed for callModel dispatch via the catch-all route.
 *
 * - POST/PUT: any call type
 * - DELETE: only allowed when the path call segment is 'delete'
 */
const ALLOWED_DISPATCH_METHODS = new Set(['POST', 'PUT', 'DELETE']);

/**
 * Body for multi-read POST requests on the `get` route.
 */
interface ModelAccessMultiReadBody {
  readonly keys: string[];
}

/**
 * REST API controller that exposes the callModel dispatch chain and direct document access via HTTP.
 *
 * Mounted at `model` — under the `/api` global prefix, routes become `/api/model/*`.
 *
 * Provides three access patterns:
 * 1. **Direct dispatch**: `POST /api/model/call` with an {@link OnCallTypedModelParams} body.
 * 2. **Document access**: `GET /api/model/:modelType/get?key=...` (single) or
 *    `POST /api/model/:modelType/get` with `{ keys: [...] }` (multi) via `useModel()`.
 * 3. **Path-based dispatch**: `POST|PUT /api/model/:modelType/:call/:specifier?` dispatches
 *    to the callModel chain. `DELETE` is only allowed when the call segment is `'delete'`.
 *    The call type comes from the path, not the HTTP method.
 *
 * Auth is provided by the OIDC bearer token middleware on the `req.auth` field.
 */
@Controller('model')
export class ModelApiController {
  constructor(
    @Inject(ModelApiCallModelDispatchService) private readonly dispatchService: ModelApiCallModelDispatchService,
    @Inject(ModelApiGetService) private readonly accessService: ModelApiGetService
  ) {}

  // MARK: Direct Dispatch
  /**
   * Direct dispatch with full OnCallTypedModelParams body.
   *
   * This route MUST be declared before the catch-all to prevent NestJS
   * from matching "call" as a modelType.
   *
   * @param body - The full {@link OnCallTypedModelParams} describing the model call to dispatch.
   * @param req - The Express request containing auth credentials on `req.auth`.
   * @returns The result of the dispatched model call.
   */
  @Post('call')
  async directDispatch(@Body() body: OnCallTypedModelParams, @Req() req: Request) {
    return this._dispatch(body, req);
  }

  // MARK: Document Access (Get)
  /**
   * Reads a single document by model type and key via `useModel()` with `'read'` roles.
   *
   * The key is a full Firestore model key (e.g., `pr/abc123`), not just an ID.
   *
   * Declared before the catch-all `{*path}` route so NestJS matches this first.
   *
   * @param modelType - The model type identifier (e.g., 'pr', 'user').
   * @param key - The full Firestore model key to read (e.g., `pr/abc123`).
   * @param req - The Express request containing auth credentials on `req.auth`.
   * @returns The document data for the requested model key.
   */
  @Get(':modelType/get')
  async getOne(@Param('modelType') modelType: string, @Query('key') key: Maybe<FirestoreModelKey>, @Req() req: Request) {
    if (!key) {
      throw new HttpException({ statusCode: 400, message: 'Missing required query parameter: key', code: 'MISSING_KEY' }, HttpStatus.BAD_REQUEST);
    }

    const auth = (req as FirebaseServerAuthenticatedRequest).auth;

    try {
      return await this.accessService.readDocument(modelType, key, auth);
    } catch (error: any) {
      throw this._toHttpException(error);
    }
  }

  /**
   * Reads multiple documents of the same model type via `useMultipleModels()` with `'read'` roles.
   *
   * Keys are full Firestore model keys. Maximum {@link MAX_MODEL_ACCESS_MULTI_READ_KEYS} keys per request.
   *
   * Declared before the catch-all `{*path}` route so NestJS matches this first.
   *
   * @param modelType - The model type identifier (e.g., 'pr', 'user').
   * @param body - Request body containing the array of Firestore model keys to read.
   * @param req - The Express request containing auth credentials on `req.auth`.
   * @returns An object with `results` (document data array) and `errors` (per-key failures).
   */
  @Post(':modelType/get')
  async getMany(@Param('modelType') modelType: string, @Body() body: ModelAccessMultiReadBody, @Req() req: Request) {
    const { keys } = body;

    if (!Array.isArray(keys) || keys.length === 0) {
      throw new HttpException({ statusCode: 400, message: 'Request body must contain a non-empty "keys" array.', code: 'MISSING_KEYS' }, HttpStatus.BAD_REQUEST);
    }

    if (keys.length > MAX_MODEL_ACCESS_MULTI_READ_KEYS) {
      throw new HttpException({ statusCode: 400, message: `Maximum ${MAX_MODEL_ACCESS_MULTI_READ_KEYS} keys per request.`, code: 'TOO_MANY_KEYS' }, HttpStatus.BAD_REQUEST);
    }

    const auth = (req as FirebaseServerAuthenticatedRequest).auth;

    try {
      return await this.accessService.readDocuments(modelType, keys, auth);
    } catch (error: any) {
      throw this._toHttpException(error);
    }
  }

  // MARK: Path-Based Dispatch
  /**
   * Catch-all handler for callModel dispatch via path.
   *
   * Path: `/api/model/:modelType/:call/:specifier?`
   *
   * The call type (create, read, update, delete, query, etc.) is determined by the
   * path segment, not the HTTP method. POST and PUT are allowed for any call type.
   * DELETE is only allowed when the call segment is `'delete'`.
   *
   * @param req - The Express request whose path segments encode modelType, call, and optional specifier.
   * @returns The result of the dispatched model call.
   */
  @All('{*path}')
  async handleDispatchRequest(@Req() req: Request) {
    if (!ALLOWED_DISPATCH_METHODS.has(req.method)) {
      throw new HttpException({ statusCode: 405, message: `HTTP method ${req.method} is not supported.`, code: 'METHOD_NOT_ALLOWED' }, HttpStatus.METHOD_NOT_ALLOWED);
    }

    const { modelType, call, specifier } = this._parsePath(req);

    if (req.method === 'DELETE' && call !== 'delete') {
      throw new HttpException({ statusCode: 405, message: 'DELETE method is only allowed for the "delete" call type.', code: 'METHOD_NOT_ALLOWED' }, HttpStatus.METHOD_NOT_ALLOWED);
    }

    const params: OnCallTypedModelParams = { call, modelType, specifier, data: req.body };
    return this._dispatch(params, req);
  }

  // MARK: Internal
  /**
   * Parses modelType, call, and specifier from the wildcard path segments.
   *
   * Expected path format: `:modelType/:call/:specifier?`
   *
   * @param req - The Express request containing wildcard path params.
   * @returns Parsed path components with modelType, call, and specifier (defaults to '_').
   */
  private _parsePath(req: Request): { modelType: string; call: string; specifier: string } {
    const pathSegments = ((req.params as any).path ?? (req.params as any)[0] ?? '').split('/').filter((s: string) => s.length > 0);

    const modelType = pathSegments[0];

    if (!modelType) {
      throw new HttpException({ statusCode: 400, message: 'Missing model type in path.', code: 'MISSING_MODEL_TYPE' }, HttpStatus.BAD_REQUEST);
    }

    const call = pathSegments[1];

    if (!call) {
      throw new HttpException({ statusCode: 400, message: 'Missing call type in path.', code: 'MISSING_CALL_TYPE' }, HttpStatus.BAD_REQUEST);
    }

    const specifier = pathSegments[2] ?? '_';
    return { modelType, call, specifier };
  }

  private async _dispatch(params: OnCallTypedModelParams, req: Request): Promise<unknown> {
    const auth = (req as FirebaseServerAuthenticatedRequest).auth;

    try {
      return await this.dispatchService.dispatch(params, auth, req);
    } catch (error: any) {
      throw this._toHttpException(error);
    }
  }

  private _toHttpException(error: any): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    const status = error?.status ?? error?.httpErrorCode?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const message = error?.message ?? 'Internal server error';

    return new HttpException({ statusCode: status, message, code: error?.code }, status);
  }
}
