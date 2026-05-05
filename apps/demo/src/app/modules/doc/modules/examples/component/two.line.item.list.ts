import { type DbxValueAsListItem } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';

export interface TwoLineItemValue {
  readonly key: string;
  readonly icon?: Maybe<string>;
  readonly title: string;
  readonly details?: Maybe<string>;
  readonly footnote?: Maybe<string>;
  readonly status?: Maybe<'active' | 'pending' | 'archived'>;
}

export type TwoLineItemValueWithSelection = DbxValueAsListItem<TwoLineItemValue>;

export const TWO_LINE_ITEM_VALUES: TwoLineItemValue[] = [
  {
    key: 'invoice-1042',
    icon: 'receipt_long',
    title: 'Invoice #1042',
    details: 'Acme Corp · Due in 3 days',
    footnote: 'Last reminder sent 2 days ago',
    status: 'pending'
  },
  {
    key: 'invoice-1041',
    icon: 'receipt_long',
    title: 'Invoice #1041',
    details: 'Globex · Paid',
    status: 'active'
  },
  {
    key: 'invoice-1040',
    icon: 'receipt_long',
    title: 'Invoice #1040',
    details: 'Initech · Archived',
    footnote: 'Closed by system',
    status: 'archived'
  },
  {
    title: 'No-icon entry',
    key: 'plain-1',
    details: 'Entries can omit the icon — the layout collapses gracefully.'
  }
];
