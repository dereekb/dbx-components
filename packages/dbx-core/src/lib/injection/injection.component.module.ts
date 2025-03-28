import { NgModule } from '@angular/core';
import { DbxInjectionArrayComponent } from './injection.array.component';
import { DbxInjectionComponent } from './injection.component';
import { DbxInjectionContextDirective } from './injection.context.directive';

const declarations = [DbxInjectionComponent, DbxInjectionArrayComponent, DbxInjectionContextDirective];

/**
 * @deprecated import the individual components instead.
 *
 * - DbxInjectionComponent
 * - DbxInjectionArrayComponent
 * - DbxInjectionContextDirective
 */
@NgModule({
  imports: declarations,
  exports: declarations
})
export class DbxInjectionComponentModule {}
