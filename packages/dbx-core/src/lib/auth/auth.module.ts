import { DbxAuthHasAnyRoleDirective } from './auth.role.any.directive';
import { NgModule } from '@angular/core';
import { DbxAuthHasRolesDirective } from './auth.role.has.directive';
import { DbxAuthNotAnyRoleDirective } from './auth.role.not.directive';

/**
 * @deprecated import the directives directly instead of using this module.
 *
 * @see DbxAuthHasRolesDirective
 * @see DbxAuthHasAnyRoleDirective
 * @see DbxAuthNotAnyRoleDirective
 */
@NgModule({
  imports: [DbxAuthHasRolesDirective, DbxAuthHasAnyRoleDirective, DbxAuthNotAnyRoleDirective],
  exports: [DbxAuthHasRolesDirective, DbxAuthHasAnyRoleDirective, DbxAuthNotAnyRoleDirective]
})
export class DbxCoreAuthModule {}
