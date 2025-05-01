import { ClickableAnchor } from '@dereekb/dbx-core';
import { TextChip } from '@dereekb/dbx-web';
import { Component } from '@angular/core';
import { UnitedStatesAddressWithContact, unitedStatesAddressString } from '@dereekb/util';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxContentPitDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.pit.directive';
import { DbxLinkifyComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/text/linkify.component';
import { DbxTextChipsComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/text/text.chips.component';
import { DbxChipDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/text/text.chip.directive';
import { DbxColorDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/style/style.color.directive';
import { DbxButtonSpacerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/button/button.spacer.directive';
import { DbxLabelBlockComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/text/label.block.component';
import { DbxUnitedStatesAddressComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/text/address.component';
import { DbxDetailBlockComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/text/detail.block.component';
import { DbxAnchorComponent } from '../../../../../../../../../packages/dbx-web/src/lib/router/layout/anchor/anchor.component';

@Component({
    templateUrl: './text.component.html',
    standalone: true,
    imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentPitDirective, DbxLinkifyComponent, DbxTextChipsComponent, DbxChipDirective, DbxColorDirective, DbxButtonSpacerDirective, DbxLabelBlockComponent, DbxUnitedStatesAddressComponent, DbxDetailBlockComponent, DbxAnchorComponent]
})
export class DocTextTextComponent {
  readonly fullAddress: UnitedStatesAddressWithContact = {
    name: 'John Doe',
    phone: '123-456-7890',
    line1: '123 Main St.',
    line2: 'Apt. 456',
    city: 'Anytown',
    state: 'CA',
    zip: '12345'
  };

  readonly shortAddress: UnitedStatesAddressWithContact = {
    line1: '123 Main St.',
    city: 'Anytown',
    state: 'CA',
    zip: '12345'
  };

  readonly incompleteAddress: Partial<UnitedStatesAddressWithContact> = {
    line1: '123 Main St.',
    city: 'Anytown'
  };

  readonly fullAddressString = unitedStatesAddressString(this.fullAddress);
  readonly shortAddressString = unitedStatesAddressString(this.shortAddress);
  readonly incompleteAddressString = unitedStatesAddressString(this.incompleteAddress);

  readonly testAnchor: ClickableAnchor = {
    url: 'https://google.com'
  };

  readonly lorem = `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore
  et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
  ex ea commodo consequat.`;

  readonly linkify = `this feature is powered by https://linkify.js.org/`;

  readonly chips: TextChip[] = [
    {
      text: 'a chip with a tool tip',
      tooltip: 'tooltip to show'
    },
    {
      text: 'b'
    },
    {
      text: 'c'
    }
  ];
}
