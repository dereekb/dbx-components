import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DbxFormDescriptionComponent } from './form.description.component';
import { DbxHintComponent } from './hint.component';
import { DbxLabelComponent } from './label.component';
import { DbxNoteComponent } from './note.component';
import { DbxNoticeComponent } from './notice.component';
import { DbxOkComponent } from './ok.component';
import { DbxSuccessComponent } from './success.component';
import { DbxWarnComponent } from './warn.component';

const declarations = [DbxNoteComponent, DbxNoticeComponent, DbxSuccessComponent, DbxWarnComponent, DbxHintComponent, DbxLabelComponent, DbxOkComponent, DbxFormDescriptionComponent];

/**
 * Includes a number of deprecated text components.
 */
@NgModule({
  imports: [CommonModule, MatChipsModule, MatTooltipModule, MatIconModule],
  declarations,
  exports: declarations
})
export class DbxTextCompatModule {}
