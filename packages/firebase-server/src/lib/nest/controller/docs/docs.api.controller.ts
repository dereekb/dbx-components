import { Controller, Get, Header, HttpException, HttpStatus, Inject, Query, Req } from '@nestjs/common';
import { type Request } from 'express';
import { type FirebaseServerAuthenticatedRequest } from '../auth.context.server';
import { DOCS_API_ROUTE_PREFIX } from './docs.api.config';
import { DocsApiService, type DocsListResult, type DocsReadResult, type DocsSearchResult } from './docs.api.service';

/**
 * Cache-Control applied to every docs response: the content depends on the caller's audiences.
 */
export const DOCS_API_CACHE_CONTROL = 'private, no-store';

/**
 * REST controller for the app's audience-gated docs.
 *
 * Mounted at `docs` — under the `/api` global prefix the routes are `GET /api/docs`, `GET /api/docs/search?q=&limit=`
 * and `GET /api/docs/read?id=&section=` (the id is a query parameter because doc ids contain `/`).
 *
 * **Bearer-protected** — the opposite of `/api/download`. `'/api/docs'` MUST be listed in the OIDC module's
 * `protectedPaths` (see `FIREBASE_SERVER_DOCS_API_PROTECTED_PATH`) so `req.auth` is populated. Every audience, scope
 * and containment check lives in {@link DocsApiService}, shared with the MCP docs tools.
 */
@Controller(DOCS_API_ROUTE_PREFIX)
export class DocsApiController {
  constructor(@Inject(DocsApiService) private readonly docsService: DocsApiService) {}

  /**
   * Lists the docs visible to the caller.
   *
   * @param req - The Express request carrying auth credentials on `req.auth`.
   * @returns The visible docs.
   */
  @Get()
  @Header('Cache-Control', DOCS_API_CACHE_CONTROL)
  listDocs(@Req() req: Request): DocsListResult {
    return this._run(() => this.docsService.listDocs((req as FirebaseServerAuthenticatedRequest).auth));
  }

  /**
   * Searches the visible docs.
   *
   * @param req - The Express request carrying auth credentials on `req.auth`.
   * @param q - The keyword query.
   * @param limit - Optional maximum number of results.
   * @returns The ranked hits.
   */
  @Get('search')
  @Header('Cache-Control', DOCS_API_CACHE_CONTROL)
  searchDocs(@Req() req: Request, @Query('q') q?: string, @Query('limit') limit?: string): DocsSearchResult {
    const parsedLimit = limit == null ? undefined : Number.parseInt(limit, 10);
    return this._run(() => this.docsService.searchDocs((req as FirebaseServerAuthenticatedRequest).auth, { query: q ?? '', limit: Number.isNaN(parsedLimit) ? undefined : parsedLimit }));
  }

  /**
   * Reads a visible doc, or one of its sections.
   *
   * @param req - The Express request carrying auth credentials on `req.auth`.
   * @param id - The doc id.
   * @param section - Optional section id.
   * @returns The doc content.
   */
  @Get('read')
  @Header('Cache-Control', DOCS_API_CACHE_CONTROL)
  readDoc(@Req() req: Request, @Query('id') id?: string, @Query('section') section?: string): DocsReadResult {
    return this._run(() => this.docsService.readDoc((req as FirebaseServerAuthenticatedRequest).auth, { id: id ?? '', section }));
  }

  private _run<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error: any) {
      throw this._toHttpException(error);
    }
  }

  private _toHttpException(error: any): HttpException {
    let result: HttpException;

    if (error instanceof HttpException) {
      result = error;
    } else {
      const status = error?.status ?? error?.httpErrorCode?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error?.message ?? 'Internal server error';
      // HttpsError keeps the specific code (DOCS_NOT_FOUND, MISSING_ENDPOINT_OIDC_SCOPE_ERROR, ...) under `details`.
      const code = error?.details?.code ?? error?.code;
      result = new HttpException({ statusCode: status, message, code }, status);
    }

    return result;
  }
}
