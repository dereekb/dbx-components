import { type DbxValueAsListItem } from '@dereekb/dbx-web';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';

export interface ManualActionItemValue {
  readonly key: string;
  readonly title: string;
  readonly detail: string;
  /**
   * Trailing action button label.
   */
  readonly buttonText: string;
  /**
   * When set the trailing button renders raised + primary (the emphasized action); otherwise it renders stroked.
   */
  readonly buttonRaised?: Maybe<boolean>;
  readonly anchor?: Maybe<ClickableAnchor>;
}

export type ManualActionItemValueWithSelection = DbxValueAsListItem<ManualActionItemValue>;

export type ManualActionItemSeed = Omit<ManualActionItemValue, 'anchor'>;

export const MANUAL_ACTION_ITEM_SEEDS: readonly ManualActionItemSeed[] = [
  {
    key: 'refresh',
    title: 'Refresh',
    detail: 'Re-evaluate send conditions now and update the schedule.',
    buttonText: 'Refresh',
    buttonRaised: true
  },
  {
    key: 'force-send',
    title: 'Force send now',
    detail: 'Send a lorem immediately.',
    buttonText: 'Force send'
  },
  {
    key: 'pause-until',
    title: 'Pause until',
    detail: 'Temporarily stop sends until a specific date.',
    buttonText: 'Pick date'
  }
];

/**
 * Builds {@link ManualActionItemValue}s from {@link MANUAL_ACTION_ITEM_SEEDS},
 * giving each item an `anchor.onClick` that fires `onClick(key)` so the trailing
 * button is demonstrably wired. Mirrors `makeWorthKnowingItemValues`.
 *
 * @param onClick - Invoked with the seed `key` when an item's button is clicked.
 * @returns Anchored values ready for the list state.
 */
export function makeManualActionItemValues(onClick: (key: string) => void): ManualActionItemValue[] {
  return MANUAL_ACTION_ITEM_SEEDS.map((seed) => ({
    ...seed,
    anchor: { onClick: () => onClick(seed.key) }
  }));
}
