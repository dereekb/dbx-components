import { NgModule } from '@angular/core';
import { MatProgressButtonsModule } from 'mat-progress-buttons';
import { DbxButtonComponent } from './button.component';
import { DbxButtonSpacerDirective } from './button.spacer.component';
import { CommonModule } from '@angular/common';
import { DbxCoreButtonModule } from '@dereekb/dbx-core';

@NgModule({
  imports: [
    CommonModule,
    MatProgressButtonsModule
  ],
  declarations: [
    DbxButtonComponent,
    DbxButtonSpacerDirective
  ],
  exports: [
    DbxCoreButtonModule,
    MatProgressButtonsModule,
    DbxButtonComponent,
    DbxButtonSpacerDirective
  ],
})
export class DbxButtonModule {}
