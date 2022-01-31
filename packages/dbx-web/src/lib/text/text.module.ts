import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DbxAnchorModule } from '../router';
import { DbxHintComponent } from './hint.component';
import { DbxLabelComponent } from './label.component';
import { DbxLinkComponent } from './link.component';
import { DbxLinkifyComponent } from './linkify.component';
import { DbxNoteComponent } from './note.component';
import { DbxNoticeComponent } from './notice.component';
import { DbxOkComponent } from './ok.component';
import { DbxSuccessComponent } from './success.component';
import { DbxTextChipsComponent } from './text.chips.component';
import { DbxWarnComponent } from './warn.component';

@NgModule({
  imports: [
    CommonModule,
    MatChipsModule,
    MatTooltipModule,
    MatIconModule,
    DbxAnchorModule
  ],
  declarations: [
    DbxNoteComponent,
    DbxNoticeComponent,
    DbxSuccessComponent,
    DbxWarnComponent,
    DbxHintComponent,
    DbxLinkComponent,
    DbxLabelComponent,
    DbxLinkifyComponent,
    DbxOkComponent,
    DbxTextChipsComponent
  ],
  exports: [
    DbxNoteComponent,
    DbxNoticeComponent,
    DbxSuccessComponent,
    DbxWarnComponent,
    DbxHintComponent,
    DbxLinkComponent,
    DbxLabelComponent,
    DbxLinkifyComponent,
    DbxOkComponent,
    DbxTextChipsComponent
  ],
})
export class DbxTextModule { }
