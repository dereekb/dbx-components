import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DbxDetailBlockComponent } from './detail.block.component';
import { DbxDetailBlockHeaderComponent } from './detail.block.header.component';
import { DbxFormDescriptionComponent } from './form.description.component';
import { DbxHintComponent } from './hint.component';
import { DbxIconSpacerDirective } from './icon.spacer.component';
import { DbxLabelBlockComponent } from './label.block.component';
import { DbxLabelComponent } from './label.component';
import { DbxLinkifyComponent } from './linkify.component';
import { DbxNoteComponent } from './note.component';
import { DbxNoticeComponent } from './notice.component';
import { DbxOkComponent } from './ok.component';
import { DbxSuccessComponent } from './success.component';
import { DbxChipDirective } from './text.chip.directive';
import { DbxTextChipsComponent } from './text.chips.component';
import { DbxWarnComponent } from './warn.component';

const declarations = [DbxChipDirective, DbxDetailBlockComponent, DbxDetailBlockHeaderComponent, DbxNoteComponent, DbxNoticeComponent, DbxSuccessComponent, DbxWarnComponent, DbxHintComponent, DbxLabelBlockComponent, DbxLabelComponent, DbxLinkifyComponent, DbxOkComponent, DbxTextChipsComponent, DbxIconSpacerDirective, DbxFormDescriptionComponent];

@NgModule({
  imports: [CommonModule, MatChipsModule, MatTooltipModule, MatIconModule],
  declarations,
  exports: declarations
})
export class DbxTextModule {}
