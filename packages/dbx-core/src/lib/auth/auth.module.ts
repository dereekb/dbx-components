import { DbxAuthHasAnyRoleDirective } from './auth.role.any.directive';
import { NgModule } from '@angular/core';
import { DbxAuthHasRolesDirective } from './auth.role.has.directive';
import { DbxAuthNotAnyRolesDirective } from './auth.role.not.directive';

@NgModule({
  imports: [],
  declarations: [DbxAuthHasRolesDirective, DbxAuthHasAnyRoleDirective, DbxAuthNotAnyRolesDirective],
  exports: [DbxAuthHasRolesDirective, DbxAuthHasAnyRoleDirective, DbxAuthNotAnyRolesDirective]
})
export class DbxCoreAuthModule {}
