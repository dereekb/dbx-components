import { Module } from '@nestjs/common';
import { DemoApiOidcModule } from './oidc/oidc.module';

/**
 * Imports all server-only modules.
 *
 * These modules may build on top of the shared firebase functions modules.
 */
@Module({
  imports: [DemoApiOidcModule]
})
export class DemoApiServerModule {}
