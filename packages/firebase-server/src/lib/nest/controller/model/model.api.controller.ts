import { Controller, All, Get, Post, Body, Req, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { type Request } from 'express';
import { type OnCallTypedModelParams, type OnCallFunctionType } from '@dereekb/firebase';
import { type FirebaseServerAuthenticatedRequest } from '../auth.context.server';
import { ModelApiDispatchService } from './model.api.dispatch';

/**
 * Maps HTTP method strings to callModel CRUD call types for write operations.
 */
const WRITE_METHOD_TO_CALL_TYPE: Readonly<Record<string, OnCallFunctionType>> = {
  POST: 'create',
  PUT: 'update',
  DELETE: 'delete'
};

/**
 * REST API controller that exposes the callModel dispatch chain via HTTP.
 *
 * Mounted at `model` — under the `/api` global prefix, routes become `/api/model/*`.
 *
 * Provides three access patterns:
 * 1. **Direct dispatch**: `POST /api/model/call` with an {@link OnCallTypedModelParams} body.
 * 2. **Read routes**: `GET /api/model/:modelType/:specifier?` dispatches a `read` call.
 *    Data is sourced from query params.
 * 3. **Write routes**: `POST|PUT|DELETE /api/model/:modelType/:specifier?` dispatches
 *    create/update/delete calls. Data is sourced from the request body.
 *
 * Auth is provided by the OIDC bearer token middleware on the `req.auth` field.
 */
@Controller('model')
export class ModelApiController {
  constructor(@Inject(ModelApiDispatchService) private readonly dispatchService: ModelApiDispatchService) {}

  // MARK: Direct Dispatch
  /**
   * Direct dispatch with full OnCallTypedModelParams body.
   *
   * This route MUST be declared before the catch-all to prevent NestJS
   * from matching "call" as a modelType.
   */
  @Post('call')
  async directDispatch(@Body() body: OnCallTypedModelParams, @Req() req: Request) {
    return this._dispatch(body, req);
  }

  // MARK: Read
  /**
   * Read handler. Data is sourced from query params rather than the request body.
   *
   * Declared before the write catch-all so NestJS matches GET requests here first.
   */
  @Get('{*path}')
  async handleReadRequest(@Req() req: Request) {
    const { modelType, specifier } = this._parsePath(req);
    const params: OnCallTypedModelParams = { call: 'read', modelType, specifier, data: req.query as any };
    return this._dispatch(params, req);
  }

  // MARK: Write (Create / Update / Delete)
  /**
   * Catch-all write handler for POST, PUT, and DELETE.
   *
   * HTTP method determines the CRUD call type. Data is sourced from the request body.
   */
  @All('{*path}')
  async handleWriteRequest(@Req() req: Request) {
    const call = WRITE_METHOD_TO_CALL_TYPE[req.method];

    if (!call) {
      throw new HttpException({ statusCode: 405, message: `HTTP method ${req.method} is not supported.`, code: 'METHOD_NOT_ALLOWED' }, HttpStatus.METHOD_NOT_ALLOWED);
    }

    const { modelType, specifier } = this._parsePath(req);
    const params: OnCallTypedModelParams = { call, modelType, specifier, data: req.body };
    return this._dispatch(params, req);
  }

  // MARK: Internal
  /**
   * Parses modelType and specifier from the wildcard path segments.
   */
  private _parsePath(req: Request): { modelType: string; specifier: string } {
    const pathSegments = ((req.params as any).path ?? (req.params as any)[0] ?? '').split('/').filter((s: string) => s.length > 0);

    const modelType = pathSegments[0];

    if (!modelType) {
      throw new HttpException({ statusCode: 400, message: 'Missing model type in path.', code: 'MISSING_MODEL_TYPE' }, HttpStatus.BAD_REQUEST);
    }

    const specifier = pathSegments[1] ?? '_';
    return { modelType, specifier };
  }

  private async _dispatch(params: OnCallTypedModelParams, req: Request): Promise<unknown> {
    const auth = (req as FirebaseServerAuthenticatedRequest).auth;

    try {
      return await this.dispatchService.dispatch(params, auth, req);
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }

      const status = error?.status ?? error?.httpErrorCode?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error?.message ?? 'Internal server error';

      throw new HttpException(
        {
          statusCode: status,
          message,
          code: error?.code
        },
        status
      );
    }
  }
}
