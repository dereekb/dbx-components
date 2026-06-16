import { Module } from '@nestjs/common';
import { APP_CODE_PREFIXApiOidcModule } from '../../../api/oidc/oidc.module';
import { appOidcModelModuleMetadata } from '@dereekb/firebase-server/oidc';

@Module(
  appOidcModelModuleMetadata({
    oidcModule: APP_CODE_PREFIXApiOidcModule
  })
)
export class OidcModelModule {}
