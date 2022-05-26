import { NgModule } from '@angular/core';
import { DbxButtonComponent } from './button.component';
import { DbxButtonSpacerDirective } from './button.spacer.component';
import { CommonModule } from '@angular/common';
import { DbxCoreButtonModule } from '@dereekb/dbx-core';
import { DbxProgressButtonsModule } from './progress/button.progress.module';

@NgModule({
  imports: [CommonModule, DbxProgressButtonsModule],
  declarations: [DbxButtonComponent, DbxButtonSpacerDirective],
  exports: [DbxCoreButtonModule, DbxProgressButtonsModule, DbxButtonComponent, DbxButtonSpacerDirective]
})
export class DbxButtonModule {}
