import { Module } from '@nestjs/common';

/**
 * Imports all server-only modules.
 *
 * These modules may build on top of the shared firebase functions modules.
 */
@Module({
  imports: [],
  exports: []
})
export class DemoApiServerModule {}
