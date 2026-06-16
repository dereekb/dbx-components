import { type DbxValueAsListItem } from '@dereekb/dbx-web';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';

export interface WorthKnowingItemValue {
  readonly key: string;
  readonly icon: string;
  readonly title: string;
  readonly detail: string;
  /**
   * Optional trailing action button label. Items without a label render with no trailing action.
   */
  readonly buttonText?: Maybe<string>;
  readonly anchor?: Maybe<ClickableAnchor>;
}

export type WorthKnowingItemValueWithSelection = DbxValueAsListItem<WorthKnowingItemValue>;

export type WorthKnowingItemSeed = Omit<WorthKnowingItemValue, 'anchor'>;

export const WORTH_KNOWING_ITEM_SEEDS: readonly WorthKnowingItemSeed[] = [
  {
    key: 'lorems-need-review',
    icon: 'rate_review',
    title: '8 lorems need review',
    detail: 'From dolors completed in the last 14 days',
    buttonText: 'Review'
  },
  {
    key: 'high-demand-friday',
    icon: 'trending_up',
    title: 'High demand expected Friday',
    detail: 'Friday, April 24 · post early to lock in preferred lorems',
    buttonText: 'Post now'
  },
  {
    key: 'visit-milestone',
    icon: 'favorite',
    title: "Alisa Ipsum's 14th visit",
    detail: 'The most of any lorem this year'
  }
];

/**
 * Builds {@link WorthKnowingItemValue}s from {@link WORTH_KNOWING_ITEM_SEEDS},
 * giving each item that declares a `buttonText` an `anchor.onClick` that fires
 * `onClick(key)`. Items without a button stay anchor-less so they render as
 * plain informational rows.
 *
 * @param onClick - Invoked with the seed `key` when an item's button is clicked.
 * @returns Anchored values ready for the list state.
 */
export function makeWorthKnowingItemValues(onClick: (key: string) => void): WorthKnowingItemValue[] {
  return WORTH_KNOWING_ITEM_SEEDS.map((seed) => ({
    ...seed,
    anchor: seed.buttonText ? { onClick: () => onClick(seed.key) } : undefined
  }));
}
