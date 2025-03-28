import { NgModule } from '@angular/core';
import { DbxAppContextStateDirective } from './context.directive';

/**
 * @deprecated Use provideDbxAppContextState() and import DbxAppContextStateDirective directly. DbxAppContextStateDirective is now standalone.
 */
@NgModule({
  imports: [DbxAppContextStateDirective],
  exports: [DbxAppContextStateDirective]
})
export class DbxAppContextStateModule {}
