import { NgModule } from '@angular/core';
import { DbxUnitedStatesAddressComponent } from './address.component';
import { DbxDetailBlockComponent } from './detail.block.component';
import { DbxDetailBlockHeaderComponent } from './detail.block.header.component';
import { DbxIconSpacerDirective } from './icon.spacer.component';
import { DbxLabelBlockComponent } from './label.block.component';
import { DbxLinkifyComponent } from './linkify/linkify.component';
import { DbxChipDirective } from './text.chip.directive';
import { DbxChipListComponent } from './text.chip.list.component';
import { DbxTextChipsComponent } from './text.chips.component';
import { DbxNumberWithLimitComponent } from './number.limit.component';
import { DbxClickToCopyTextDirective } from './copy.text.directive';
import { DbxClickToCopyTextComponent } from './copy.text.component';
import { DbxStepBlockComponent } from './step.block.component';

const importsAndExports = [DbxUnitedStatesAddressComponent, DbxNumberWithLimitComponent, DbxClickToCopyTextDirective, DbxClickToCopyTextComponent, DbxChipDirective, DbxChipListComponent, DbxDetailBlockComponent, DbxDetailBlockHeaderComponent, DbxStepBlockComponent, DbxLabelBlockComponent, DbxLinkifyComponent, DbxTextChipsComponent, DbxIconSpacerDirective];

/**
 * Angular module that bundles all text-related layout components and directives, including
 * address display, chips, detail blocks, copy-to-clipboard, linkify, and number-with-limit.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxTextModule {}
