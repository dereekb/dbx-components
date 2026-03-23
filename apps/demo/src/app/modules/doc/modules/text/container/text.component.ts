import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type TextChip, type DbxChipDisplay, DbxContentContainerDirective, DbxContentPitDirective, DbxLinkifyComponent, type DbxLinkifyConfig, DbxLinkifyService, DbxTextChipsComponent, DbxChipDirective, DbxChipListComponent, DbxColorDirective, DbxButtonSpacerDirective, DbxLabelBlockComponent, DbxUnitedStatesAddressComponent, DbxDetailBlockComponent, DbxStepBlockComponent, DbxAnchorComponent, type NumberWithLimit, DbxNumberWithLimitComponent, DbxClickToCopyTextDirective } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { type UnitedStatesAddressWithContact, dollarAmountString, unitedStatesAddressString } from '@dereekb/util';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxClickToCopyTextComponent } from 'packages/dbx-web/src/lib/layout/text/copy.text.component';
import { LOREM } from '../../shared';

@Component({
  templateUrl: './text.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentPitDirective, DbxLinkifyComponent, DbxTextChipsComponent, DbxChipDirective, DbxChipListComponent, DbxColorDirective, DbxButtonSpacerDirective, DbxLabelBlockComponent, DbxNumberWithLimitComponent, DbxUnitedStatesAddressComponent, DbxDetailBlockComponent, DbxStepBlockComponent, DbxAnchorComponent, DbxClickToCopyTextDirective, DbxClickToCopyTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocTextTextComponent {
  private readonly dbxLinkifyService = inject(DbxLinkifyService);

  constructor() {
    this.dbxLinkifyService.register({
      type: 'truncated',
      options: { defaultProtocol: 'https', target: { url: '_blank' }, truncate: 30 }
    });
  }

  readonly noTargetLinkifyConfig: DbxLinkifyConfig = { type: 'no-target' };
  readonly truncatedLinkifyConfig: DbxLinkifyConfig = { type: 'truncated' };
  readonly inlineOptionsLinkifyConfig: DbxLinkifyConfig = {
    options: {
      defaultProtocol: 'https',
      target: { url: '_blank' },
      rel: 'noopener noreferrer',
      className: 'dbx-primary',
      truncate: 40,
      format: (value, type) => (type === 'url' ? `🔗 ${value}` : value),
      attributes: {
        title: 'Click to visit this link'
      }
    }
  };

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

  readonly lorem = `COLORED TEXT: ` + LOREM;

  readonly loremBg = `COLORED BACKGROUND: ` + LOREM;

  readonly linkify = `this feature is powered by https://linkify.js.org/`;
  readonly linkifyWithLongerUrl = `This is the docs url: https://linkify.js.org/docs/linkify-react.html`;

  readonly chipDisplays: DbxChipDisplay[] = [
    { label: 'Primary', value: 'primary', color: 'primary' },
    { label: 'Accent', value: 'accent', color: 'accent' },
    { label: 'Warn', value: 'warn', color: 'warn' },
    { label: 'Notice', value: 'notice', color: 'notice' },
    { label: 'Ok', value: 'ok', color: 'ok' },
    { label: 'Success', value: 'success', color: 'success' },
    { label: 'Grey', value: 'grey', color: 'grey' },
    { label: 'Background', value: 'background', color: 'default', tone: 100 },
    { label: 'No Color', value: 'none' }
  ];

  readonly chipDisplaysWithTones: DbxChipDisplay[] = [
    { label: 'Primary 18%', value: 'primary-18', color: 'primary', tone: 18 },
    { label: 'Primary 40%', value: 'primary-40', color: 'primary', tone: 40 },
    { label: 'Primary 100%', value: 'primary-100', color: 'primary', tone: 100 },
    { label: 'Accent 18%', value: 'accent-18', color: 'accent', tone: 18 },
    { label: 'Accent 100%', value: 'accent-100', color: 'accent', tone: 100 },
    { label: 'Success 18%', value: 'success-18', color: 'success', tone: 18 },
    { label: 'Success 100%', value: 'success-100', color: 'success', tone: 100 }
  ];

  readonly chips: TextChip[] = [
    {
      label: 'a chip with a tool tip',
      value: 'a',
      tooltip: 'tooltip to show',
      color: 'primary'
    },
    {
      label: 'b',
      value: 'b',
      color: 'accent'
    },
    {
      label: 'c',
      value: 'c'
    },
    {
      label: 'not selected',
      value: 'd',
      color: 'success',
      selected: false
    }
  ];

  readonly numberLimitA: NumberWithLimit<number> = {
    value: 10,
    limit: 100
  };

  readonly numberLimitB: NumberWithLimit<number> = {
    value: 100,
    limit: 10,
    prefix: 'PRE',
    suffix: 'SUF',
    formatNumber: (number) => `${number}%`
  };

  readonly numberLimitC: NumberWithLimit<number> = {
    value: 10,
    limit: 100,
    prefix: '$',
    formatNumber: dollarAmountString,
    suffix: 'USD'
  };
}
