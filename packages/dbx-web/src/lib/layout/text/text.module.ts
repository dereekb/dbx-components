import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DbxFormDescriptionComponent } from './form.description.component';
import { DbxHintComponent } from './hint.component';
import { DbxIconSpacerDirective } from './icon.spacer.component';
import { DbxLabelComponent } from './label.component';
import { DbxLinkifyComponent } from './linkify.component';
import { DbxNoteComponent } from './note.component';
import { DbxNoticeComponent } from './notice.component';
import { DbxOkComponent } from './ok.component';
import { DbxSuccessComponent } from './success.component';
import { DbxTextChipsComponent } from './text.chips.component';
import { DbxWarnComponent } from './warn.component';

@NgModule({
  imports: [CommonModule, MatChipsModule, MatTooltipModule, MatIconModule],
  declarations: [DbxNoteComponent, DbxNoticeComponent, DbxSuccessComponent, DbxWarnComponent, DbxHintComponent, DbxLabelComponent, DbxLinkifyComponent, DbxOkComponent, DbxTextChipsComponent, DbxIconSpacerDirective, DbxFormDescriptionComponent],
  exports: [DbxNoteComponent, DbxNoticeComponent, DbxSuccessComponent, DbxWarnComponent, DbxHintComponent, DbxLabelComponent, DbxLinkifyComponent, DbxOkComponent, DbxTextChipsComponent, DbxIconSpacerDirective, DbxFormDescriptionComponent]
})
export class DbxTextModule {}
