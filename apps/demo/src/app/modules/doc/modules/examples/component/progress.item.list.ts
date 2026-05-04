import { type DbxValueAsListItem } from '@dereekb/dbx-web';

export interface ProgressItemValue {
  readonly key: string;
  readonly title: string;
  readonly progress: number;
  readonly total: number;
  readonly icon: string;
}

export type ProgressItemValueWithSelection = DbxValueAsListItem<ProgressItemValue>;

export const PROGRESS_ITEM_VALUES: ProgressItemValue[] = [
  {
    key: 'pa-k12',
    title: 'Pennsylvania K-12',
    icon: 'assignment_turned_in',
    progress: 1,
    total: 6
  },
  {
    key: 'ny-k12',
    title: 'New York K-12',
    icon: 'assignment_turned_in',
    progress: 4,
    total: 6
  },
  {
    key: 'oh-k12',
    title: 'Ohio K-12',
    icon: 'assignment_turned_in',
    progress: 6,
    total: 6
  }
];
