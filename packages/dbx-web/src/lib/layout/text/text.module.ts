import { NgModule } from '@angular/core';
import { DbxUnitedStatesAddressComponent } from './address.component';
import { DbxDetailBlockComponent } from './detail.block.component';
import { DbxDetailBlockHeaderComponent } from './detail.block.header.component';
import { DbxIconSpacerDirective } from './icon.spacer.component';
import { DbxLabelBlockComponent } from './label.block.component';
import { DbxLinkifyComponent } from './linkify.component';
import { DbxChipDirective } from './text.chip.directive';
import { DbxTextChipsComponent } from './text.chips.component';

const importsAndExports = [DbxUnitedStatesAddressComponent, DbxChipDirective, DbxDetailBlockComponent, DbxDetailBlockHeaderComponent, DbxLabelBlockComponent, DbxLinkifyComponent, DbxTextChipsComponent, DbxIconSpacerDirective];

@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxTextModule {}
