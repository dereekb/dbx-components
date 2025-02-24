import { NgModule } from '@angular/core';
import { DbxRouteModelKeyDirective } from './model.router.key.directive';
import { DbxRouteModelIdFromAuthUserIdDirective } from './model.router.uid.directive';
import { DbxRouteModelIdDirective } from './model.router.id.directive';

const declarations = [DbxRouteModelIdDirective, DbxRouteModelKeyDirective, DbxRouteModelIdFromAuthUserIdDirective];

@NgModule({
  imports: [],
  declarations,
  exports: declarations
})
export class DbxCoreRouterModelModule {}
