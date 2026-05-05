import { type DbxValueAsListItem } from '@dereekb/dbx-web';

export interface AnchorRowItemValue {
  readonly key: string;
  readonly title: string;
  readonly icon: string;
  readonly progress: number;
  readonly total: number;
}

export type AnchorRowItemValueWithSelection = DbxValueAsListItem<AnchorRowItemValue>;

export const ANCHOR_ROW_ITEM_VALUES: AnchorRowItemValue[] = [
  {
    key: 'new-employee-onboarding',
    title: 'New Employee Onboarding',
    icon: 'school',
    progress: 1,
    total: 2
  },
  {
    key: 'texas-k12',
    title: 'Texas K-12 Requirements',
    icon: 'shield',
    progress: 1,
    total: 3
  }
];
