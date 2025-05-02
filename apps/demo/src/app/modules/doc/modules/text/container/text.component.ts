import { ClickableAnchor } from '@dereekb/dbx-core';
import { TextChip, DbxContentContainerDirective, DbxContentPitDirective, DbxLinkifyComponent, DbxTextChipsComponent, DbxChipDirective, DbxColorDirective, DbxButtonSpacerDirective, DbxLabelBlockComponent, DbxUnitedStatesAddressComponent, DbxDetailBlockComponent, DbxAnchorComponent } from '@dereekb/dbx-web';
import { Component } from '@angular/core';
import { UnitedStatesAddressWithContact, unitedStatesAddressString } from '@dereekb/util';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

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
