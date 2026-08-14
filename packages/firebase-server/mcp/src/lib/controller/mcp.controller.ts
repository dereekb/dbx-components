import { Controller, Post, Get, Delete, Req, Res, Inject, Logger, HttpStatus } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { type FirebaseServerAuthenticatedRequest } from '@dereekb/firebase-server';
import { McpServerFactoryService } from '../service/mcp.server.factory';
import { handleStreamableHttpMcpRequest } from '../transport/streamable-http.transport';

/**
 * NestJS controller mounting the MCP Streamable HTTP transport at `POST /mcp`.
 *
 * Auth is enforced by the global OIDC bearer middleware (`OidcAuthBearerTokenMiddleware`)
 * which must include `'/mcp'` in its `protectedPaths`. By the time the request reaches
 * this controller, `req.auth` is populated with the authenticated user's data.
 *
 * Each request gets a fresh MCP server (stateless mode), which is adequate for Claude
 * custom-connector style usage. Both protocol eras are served — 2026-07-28 through the
 * SDK's per-request `createMcpHandler` entry, and 2025-era through a stateless Streamable
 * HTTP transport. A session-tracked variant can be layered on later if streaming tool
 * output becomes a requirement.
 */
@Controller('mcp')
export class McpController {
  private readonly _logger = new Logger(McpController.name);

  constructor(@Inject(McpServerFactoryService) private readonly factory: McpServerFactoryService) {}

  @Post()
  async handleMcpRequest(@Req() req: Request, @Res() res: Response): Promise<void> {
    const auth = (req as FirebaseServerAuthenticatedRequest).auth;

    try {
      await handleStreamableHttpMcpRequest(req, res, () => this.factory.createServer({ auth, rawRequest: req }));
    } catch (error) {
      this._logger.error('MCP request handling failed', error);

      if (!res.headersSent) {
        res.status(500).json({ statusCode: 500, message: 'MCP request handling failed' });
      }
    }
  }

  /**
   * Rejects the Streamable HTTP transport's optional `GET` method, which opens a standalone SSE
   * stream. Not applicable in stateless mode. Separate from {@link handleUnsupportedDelete} because
   * NestJS binds one HTTP method per handler — stacking route decorators would silently drop one.
   *
   * @param res - The Express response to write the rejection to.
   */
  @Get()
  handleUnsupportedGet(@Res() res: Response): void {
    this._rejectUnsupportedMethod(res);
  }

  /**
   * Rejects the Streamable HTTP transport's optional `DELETE` method, which tears down a session.
   * Not applicable in stateless mode — no session is ever issued.
   *
   * @param res - The Express response to write the rejection to.
   */
  @Delete()
  handleUnsupportedDelete(@Res() res: Response): void {
    this._rejectUnsupportedMethod(res);
  }

  /**
   * Answers with a spec-conformant `405 Method Not Allowed` + `Allow` header. Without these
   * handlers NestJS answers `404`, which some clients treat as a hard failure rather than
   * "the server doesn't offer this".
   *
   * @param res - The Express response to write the rejection to.
   */
  private _rejectUnsupportedMethod(res: Response): void {
    res.setHeader('Allow', 'POST');
    res.status(HttpStatus.METHOD_NOT_ALLOWED).json({ statusCode: HttpStatus.METHOD_NOT_ALLOWED, message: 'Method Not Allowed' });
  }
}
