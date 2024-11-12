import { DbxAuthHasAnyRoleDirective } from './auth.role.any.directive';
import { NgModule } from '@angular/core';
import { DbxAuthHasRolesDirective } from './auth.role.has.directive';
import { DbxAuthNotAnyRoleDirective } from './auth.role.not.directive';

@NgModule({
  imports: [],
  declarations: [DbxAuthHasRolesDirective, DbxAuthHasAnyRoleDirective, DbxAuthNotAnyRoleDirective],
  exports: [DbxAuthHasRolesDirective, DbxAuthHasAnyRoleDirective, DbxAuthNotAnyRoleDirective]
})
export class DbxCoreAuthModule {}
