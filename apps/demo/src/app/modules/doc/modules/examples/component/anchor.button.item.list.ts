import { type DbxValueAsListItem } from '@dereekb/dbx-web';
import { type ClickableAnchor } from '@dereekb/dbx-core';

export interface AnchorButtonItemValue {
  readonly key: string;
  readonly title: string;
  readonly icon: string;
  readonly progress: number;
  readonly total: number;
  readonly buttonText: string;
  readonly anchor: ClickableAnchor;
}

export type AnchorButtonItemValueWithSelection = DbxValueAsListItem<AnchorButtonItemValue>;

export type AnchorButtonItemSeed = Omit<AnchorButtonItemValue, 'anchor'>;

export const ANCHOR_BUTTON_ITEM_SEEDS: readonly AnchorButtonItemSeed[] = [
  {
    key: 'new-employee-onboarding',
    title: 'New Employee Onboarding',
    icon: 'school',
    progress: 1,
    total: 2,
    buttonText: 'View requirements'
  },
  {
    key: 'texas-k12',
    title: 'Texas K-12 Requirements',
    icon: 'shield',
    progress: 1,
    total: 3,
    buttonText: 'View requirements'
  }
];

/**
 * Builds {@link AnchorButtonItemValue}s from {@link ANCHOR_BUTTON_ITEM_SEEDS},
 * giving each item an `anchor.onClick` that fires `onClick(key)`. The example
 * host uses this to wire button clicks into a `signal` for display.
 *
 * @param onClick - Invoked with the seed `key` when an item's button is clicked.
 * @returns Anchored values ready for the list state.
 */
export function makeAnchorButtonItemValues(onClick: (key: string) => void): AnchorButtonItemValue[] {
  return ANCHOR_BUTTON_ITEM_SEEDS.map((seed) => ({
    ...seed,
    anchor: { onClick: () => onClick(seed.key) }
  }));
}
