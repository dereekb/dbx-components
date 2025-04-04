import { NgModule } from '@angular/core';
import { DbxActionUIRouterTransitionSafetyDialogComponent } from './transition.safety.dialog.component';
import { DbxActionTransitionSafetyDirective as DbxActionUIRouterTransitionSafetyDirective } from './transition.safety.directive';

const importsAndExports = [DbxActionUIRouterTransitionSafetyDirective, DbxActionUIRouterTransitionSafetyDialogComponent];

/**
 * Provides the DbxActionUIRouterTransitionSafetyDirective.
 *
 * NOTE: Only works with UIRouter
 * 
 * @deprecated import the standalone components directly
 * 
 * @see DbxActionUIRouterTransitionSafetyDirective
 * @see DbxActionUIRouterTransitionSafetyDialogComponent
 
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxActionUIRouterTransitionModule {}
