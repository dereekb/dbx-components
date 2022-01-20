import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DbNgxAnchorModule } from '../router';
import { DbNgxHintComponent } from './hint.component';
import { DbNgxLabelBarComponent } from './label.bar.component';
import { DbNgxLabelComponent } from './label.component';
import { DbNgxLinkComponent } from './link.component';
import { DbNgxLinkifyComponent } from './linkify.component';
import { DbNgxNoteComponent } from './note.component';
import { DbNgxNoticeComponent } from './notice.component';
import { DbNgxOkComponent } from './ok.component';
import { DbNgxSuccessComponent } from './success.component';
import { DbNgxTextChipsComponent } from './text.chips.component';
import { DbNgxWarnComponent } from './warn.component';

@NgModule({
  imports: [
    CommonModule,
    MatChipsModule,
    MatTooltipModule,
    MatIconModule,
    DbNgxAnchorModule
  ],
  declarations: [
    DbNgxNoteComponent,
    DbNgxNoticeComponent,
    DbNgxSuccessComponent,
    DbNgxWarnComponent,
    DbNgxHintComponent,
    DbNgxLinkComponent,
    DbNgxLabelComponent,
    DbNgxLinkifyComponent,
    DbNgxOkComponent,
    DbNgxTextChipsComponent,
    DbNgxLabelBarComponent
  ],
  exports: [
    DbNgxNoteComponent,
    DbNgxNoticeComponent,
    DbNgxSuccessComponent,
    DbNgxWarnComponent,
    DbNgxHintComponent,
    DbNgxLinkComponent,
    DbNgxLabelComponent,
    DbNgxLinkifyComponent,
    DbNgxOkComponent,
    DbNgxTextChipsComponent,
    DbNgxLabelBarComponent
  ],
})
export class DbNgxTextModule { }
