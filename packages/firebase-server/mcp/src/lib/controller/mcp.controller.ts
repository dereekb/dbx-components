import { Controller, Post, Req, Res, Inject, Logger } from '@nestjs/common';
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
 * Each request gets a fresh transport + MCP server pair (stateless mode), which is
 * adequate for Claude custom-connector style usage. A session-tracked variant can
 * be layered on later if streaming tool output becomes a requirement.
 */
@Controller('mcp')
export class McpController {
  private readonly _logger = new Logger(McpController.name);

  constructor(@Inject(McpServerFactoryService) private readonly factory: McpServerFactoryService) {}

  @Post()
  async handleMcpRequest(@Req() req: Request, @Res() res: Response): Promise<void> {
    const auth = (req as FirebaseServerAuthenticatedRequest).auth;
    const server = this.factory.createServer({ auth, rawRequest: req });

    try {
      await handleStreamableHttpMcpRequest(req, res, server);
    } catch (error) {
      this._logger.error('MCP request handling failed', error);

      if (!res.headersSent) {
        res.status(500).json({ statusCode: 500, message: 'MCP request handling failed' });
      }
    }
  }
}
