import { Module } from '@nestjs/common';
import { DemoApiOidcModule } from '../api/oidc/oidc.module';
import { DemoModelApiModule } from './model/model.module';
import { DemoMcpModule } from './mcp/mcp.module';
import { DemoSessionApiModule } from './session/session.module';

/**
 * Imports all server-only modules.
 *
 * These modules may build on top of the shared firebase functions modules.
 */
@Module({
  imports: [DemoApiOidcModule, DemoModelApiModule, DemoMcpModule, DemoSessionApiModule]
})
export class DemoApiServerModule {}
