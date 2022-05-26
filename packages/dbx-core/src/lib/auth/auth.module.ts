import { DbxAuthHasAnyRoleDirective } from './auth.role.any.directive';
import { NgModule } from '@angular/core';
import { DbxAuthHasRolesDirective } from './auth.role.has.directive';

@NgModule({
  imports: [],
  declarations: [DbxAuthHasRolesDirective, DbxAuthHasAnyRoleDirective],
  exports: [DbxAuthHasRolesDirective, DbxAuthHasAnyRoleDirective]
})
export class DbxCoreAuthModule {}
