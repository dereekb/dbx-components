import { NgModule } from '@angular/core';
import { DbxRouteModelKeyDirective } from './model.router.key.directive';
import { DbxRouteModelIdFromAuthUserIdDirective } from './model.router.uid.directive';
import { DbxRouteModelIdDirective } from './model.router.id.directive';

const importsAndExports = [DbxRouteModelIdDirective, DbxRouteModelKeyDirective, DbxRouteModelIdFromAuthUserIdDirective];

/**
 * @deprecated Import declarations directly instead.
 *
 * @see DbxRouteModelIdDirective
 * @see DbxRouteModelKeyDirective
 * @see DbxRouteModelIdFromAuthUserIdDirective
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxCoreRouterModelModule {}
