import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxActionUIRouterTransitionSafetyDialogComponent } from './transition.safety.dialog.component';
import { DbxActionTransitionSafetyDirective as DbxActionUIRouterTransitionSafetyDirective } from './transition.safety.directive';
import { DbxCoreActionModule } from '@dereekb/dbx-core';
import { DbxButtonModule } from '../../button';
import { DbxPromptModule } from './../../interaction';
import { DbxReadableErrorModule } from '../../error';

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
