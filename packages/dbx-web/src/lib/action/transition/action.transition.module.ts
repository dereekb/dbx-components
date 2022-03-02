import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxActionUIRouterTransitionSafetyDialogComponent } from './transition.safety.dialog.component';
import { DbxActionTransitionSafetyDirective as DbxActionUIRouterTransitionSafetyDirective } from './transition.safety.directive';
import { DbxCoreActionModule } from '@dereekb/dbx-core';
import { DbxButtonModule } from '../../button';
import { DbxPromptModule } from './../../interaction';
import { DbxReadableErrorModule } from '../../error';

/**
 * Provides the DbxActionUIRouterTransitionSafetyDirective.
 * 
 * NOTE: Only works with UIRouter
 */
@NgModule({
  imports: [
    CommonModule,
    DbxCoreActionModule,
    DbxPromptModule,
    DbxButtonModule,
    DbxReadableErrorModule
  ],
  declarations: [
    DbxActionUIRouterTransitionSafetyDirective,
    DbxActionUIRouterTransitionSafetyDialogComponent
  ],
  exports: [
    DbxActionUIRouterTransitionSafetyDirective
  ]
})
export class DbxActionUIRouterTransitionModule { }
