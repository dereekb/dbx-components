import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxActionUIRouterTransitionSafetyDialogComponent } from './transition.safety.dialog.component';
import { DbNgxActionTransitionSafetyDirective as DbNgxActionUIRouterTransitionSafetyDirective } from './transition.safety.directive';
import { DbNgxCoreActionModule } from '@dereekb/dbx-core';
import { DbNgxButtonModule } from '../../button';
import { DbNgxPromptModule } from './../../interaction';
import { DbNgxReadableErrorModule } from '../../error';

/**
 * Provides the DbNgxActionUIRouterTransitionSafetyDirective.
 * 
 * NOTE: Only works with UIRouter
 */
@NgModule({
  imports: [
    CommonModule,
    DbNgxCoreActionModule,
    DbNgxPromptModule,
    DbNgxButtonModule,
    DbNgxReadableErrorModule
  ],
  declarations: [
    DbNgxActionUIRouterTransitionSafetyDirective,
    DbNgxActionUIRouterTransitionSafetyDialogComponent
  ],
  exports: [
    DbNgxActionUIRouterTransitionSafetyDirective
  ]
})
export class DbNgxActionUIRouterTransitionModule { }
