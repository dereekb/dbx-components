import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbNgxActionUIRouterTransitionSafetyDialogComponent } from './transition.safety.dialog.component';
import { DbNgxActionTransitionSafetyDirective as DbNgxActionUIRouterTransitionSafetyDirective } from './transition.safety.directive';
import { DbNgxCoreActionModule } from '@dereekb/ngx-core';
import { DbNgxButtonModule } from '../../button';
import { DbNgxPromptModule } from './../../interaction';

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
