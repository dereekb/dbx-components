import { Controller, Get, HttpException, HttpStatus, Inject, Query, Res } from '@nestjs/common';
import { type Response } from 'express';
import { DOWNLOAD_API_ASSET_QUERY_PARAM, DOWNLOAD_API_ROUTE_PREFIX } from './download.api.config';
import { DownloadApiService } from './download.api.service';

/**
 * REST controller that streams one registered asset to whoever holds a valid signed URL.
 *
 * Mounted at `download` — under the `/api` global prefix the route becomes `GET /api/download`.
 *
 * `/api/download` must **NOT** be listed in the OIDC module's `protectedPaths`: it authenticates via
 * the signed `asset` query parameter, and a bearer middleware in front of it would 401 exactly the
 * callers the feature exists for (a bare machine that has no credential yet — obtaining one is the
 * whole point). Do not "fix" that by adding it.
 *
 * Follows `McpController`'s `@Res()` style; there is no `StreamableFile` precedent in this repo.
 */
@Controller(DOWNLOAD_API_ROUTE_PREFIX)
export class DownloadApiController {
  constructor(@Inject(DownloadApiService) private readonly downloadService: DownloadApiService) {}

  /**
   * Streams the asset named by a signed capability token.
   *
   * @param asset - The signed token from the `asset` query parameter.
   * @param res - The Express response the file is streamed to.
   */
  @Get()
  async downloadAsset(@Query(DOWNLOAD_API_ASSET_QUERY_PARAM) asset: string, @Res() res: Response): Promise<void> {
    let resolved;

    try {
      resolved = await this.downloadService.resolveDownloadRequest(asset);
    } catch (error: any) {
      throw toDownloadHttpException(error);
    }

    res.setHeader('Content-Type', resolved.contentType);
    res.setHeader('Content-Length', String(resolved.size));
    res.setHeader('Content-Disposition', `attachment; filename="${resolved.fileName.replaceAll('"', '')}"`);
    // a capability URL's response is nobody's to cache
    res.setHeader('Cache-Control', 'private, no-store');

    const stream = resolved.stream();

    await new Promise<void>((resolve, reject) => {
      stream.on('error', reject);
      stream.on('end', resolve);
      stream.pipe(res);
    });
  }
}

/**
 * Converts a thrown `HttpsError` into the `{ statusCode, message, code }` envelope the other API
 * controllers emit, preserving the specific code that `HttpsError` buries under `details`.
 *
 * The token is never echoed back — an error body carrying it would put a live capability into logs.
 *
 * @param error - The thrown value.
 * @returns The Nest exception to throw.
 */
function toDownloadHttpException(error: any): HttpException {
  let result: HttpException;

  if (error instanceof HttpException) {
    result = error;
  } else {
    const status = error?.status ?? error?.httpErrorCode?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const message = error?.message ?? 'Internal server error';
    const code = error?.details?.code ?? error?.code;

    result = new HttpException({ statusCode: status, message, code }, status);
  }

  return result;
}
