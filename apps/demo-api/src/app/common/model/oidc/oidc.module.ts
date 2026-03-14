import { Module } from '@nestjs/common';
import { DemoApiOidcModule } from '../../../api/oidc/oidc.module';
import { appOidcModelModuleMetadata } from '@dereekb/firebase-server/oidc';

// MARK: Factories
/**
 * OidcModel model module
 */
@Module(
  appOidcModelModuleMetadata({
    oidcModule: DemoApiOidcModule
  })
)
export class OidcModelModule {}
