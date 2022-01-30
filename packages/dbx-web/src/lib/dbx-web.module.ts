import { DbxLoadingModule } from './loading/loading.module';
import { MatProgressButtonsModule } from 'mat-progress-buttons';
import { NgModule } from '@angular/core';
import { DbxButtonModule } from './button';
import { DbxActionModule } from './action';

@NgModule({
  exports: [
    DbxButtonModule,
    DbxActionModule,
    DbxLoadingModule
  ],
})
export class DbxWebModule { }

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
export class DbxWebRootModule { }
