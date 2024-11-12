import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DbxUnitedStatesAddressComponent } from './address.component';
import { DbxDetailBlockComponent } from './detail.block.component';
import { DbxDetailBlockHeaderComponent } from './detail.block.header.component';
import { DbxIconSpacerDirective } from './icon.spacer.component';
import { DbxLabelBlockComponent } from './label.block.component';
import { DbxLinkifyComponent } from './linkify.component';
import { DbxChipDirective } from './text.chip.directive';
import { DbxTextChipsComponent } from './text.chips.component';

const declarations = [DbxUnitedStatesAddressComponent, DbxChipDirective, DbxDetailBlockComponent, DbxDetailBlockHeaderComponent, DbxLabelBlockComponent, DbxLinkifyComponent, DbxTextChipsComponent, DbxIconSpacerDirective];

@NgModule({
  imports: [CommonModule, MatChipsModule, MatTooltipModule, MatIconModule],
  declarations,
  exports: declarations
})
export class DbxTextModule {}
