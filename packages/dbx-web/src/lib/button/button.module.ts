import { NgModule } from '@angular/core';
import { MatProgressButtonsModule } from 'mat-progress-buttons';
import { DbxButtonComponent } from './button.component';
import { DbxButtonSpacerComponent } from './button.spacer.component';
import { CommonModule } from '@angular/common';
import { DbxCoreButtonModule } from '@dereekb/dbx-core';

@NgModule({
  imports: [
    CommonModule,
    MatProgressButtonsModule
  ],
  declarations: [
    DbxButtonComponent,
    DbxButtonSpacerComponent
  ],
  exports: [
    DbxCoreButtonModule,
    MatProgressButtonsModule,
    DbxButtonComponent,
    DbxButtonSpacerComponent
  ],
})
export class DbxButtonModule {}
