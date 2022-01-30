import { DbNgxLoadingModule } from './loading/loading.module';
import { MatProgressButtonsModule } from 'mat-progress-buttons';
import { NgModule } from '@angular/core';
import { DbNgxButtonModule } from './button';
import { DbNgxActionModule } from './action';

@NgModule({
  exports: [
    DbNgxButtonModule,
    DbNgxActionModule,
    DbNgxLoadingModule
  ],
})
export class DbNgxWebModule { }

/**
 * Should only be imported once in the root app.
 * 
 * Pre-configures the following modules:
 * - MatProgressButtonsModule
 */
@NgModule({
  imports: [
    MatProgressButtonsModule.forRoot()
  ]
})
export class DbNgxWebRootModule { }
