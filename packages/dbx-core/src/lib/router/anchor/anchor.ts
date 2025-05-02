import { MousableFunction } from './mousable';
import { ClickableFunction, ClickableUrl } from './clickable';
import { SegueRef } from '../segue';
import { expandFlattenTreeFunction, expandTreeFunction, ExpandTreeFunction, FlattenTreeFunction, flattenTreeToArrayFunction, Maybe, TreeNode } from '@dereekb/util';
import { Type, Provider, forwardRef } from '@angular/core';
import { Observable } from 'rxjs';
import { DbxInjectionComponentConfig } from '../../injection/injection';

export interface ClickableAnchor extends ClickableFunction, MousableFunction, ClickableUrl, Partial<SegueRef> {
  readonly disabled?: boolean;
  readonly selected?: boolean;
}

/**
 * Title and an optional icon.
 */
export interface IconAndTitle {
  readonly title: string;
  readonly icon?: Maybe<string>;
}

export interface ClickableAnchorLink extends ClickableAnchor, IconAndTitle {
  /**
   * Optional detail string/content.
   */
  readonly hint?: string;
  /**
   * Custom injection content for this link.
   */
  readonly content?: DbxInjectionComponentConfig;
}

/**
 * ClickableAnchorLink that definitely has a SegueRef
 */
export type ClickableAnchorLinkSegueRef = ClickableAnchorLink & SegueRef;

export interface ClickableIconAnchorLink extends Omit<ClickableAnchorLink, 'title'> {
  readonly icon: string;
}

export interface ClickableAnchorLinkTree extends ClickableAnchorLink {
  readonly children?: ClickableAnchorLinkTree[];
}

export type ExpandedClickableAnchorLinkTree = TreeNode<ClickableAnchorLinkTree>;

export const expandClickableAnchorLinkTreeNode: ExpandTreeFunction<ClickableAnchorLinkTree, ExpandedClickableAnchorLinkTree> = expandTreeFunction({
  getChildren: (x) => x.children
});

export const flattenExpandedClickableAnchorLinkTree: FlattenTreeFunction<ExpandedClickableAnchorLinkTree, ExpandedClickableAnchorLinkTree> = flattenTreeToArrayFunction();
export const flattenExpandedClickableAnchorLinkTreeToLinks: FlattenTreeFunction<ExpandedClickableAnchorLinkTree, ClickableAnchorLinkTree> = flattenTreeToArrayFunction((x) => x.value);

/**
 * Fully expands the given parent link and flattens the tree to a single parent link.
 *
 * @param link
 * @returns
 */
export function expandClickableAnchorLinkTree(link: ClickableAnchorLinkTree): ExpandedClickableAnchorLinkTree[] {
  return flattenExpandedClickableAnchorLinkTree(expandClickableAnchorLinkTreeNode(link));
}

/**
 * Expands an array of links into an array of ExpandedClickableAnchorLinkTree tree values.
 */
export const expandClickableAnchorLinkTrees = expandFlattenTreeFunction<ClickableAnchorLinkTree, ExpandedClickableAnchorLinkTree>(expandClickableAnchorLinkTreeNode, flattenExpandedClickableAnchorLinkTree);

/**
 * Describes the Anchor type given a ClickableAnchor.
 *
 * - plain: When the anchor has no specific content but is not disabled. It is a passthrough for the content.
 * - clickable: When the anchor has a click handler
 * - sref: When the anchor has a SegueRef
 * - href: When the anchor has a URL
 * - disabled: When the anchor is disabled.
 */
export type ClickableAnchorType = 'plain' | 'clickable' | 'sref' | 'href' | 'disabled';

export function anchorTypeForAnchor(anchor: Maybe<ClickableAnchor>, disabled?: Maybe<boolean>): ClickableAnchorType {
  let type: ClickableAnchorType = 'disabled';

  if (!disabled && anchor) {
    if (anchor.disabled) {
      type = 'disabled';
    } else if (anchor.ref) {
      type = 'sref';
    } else if (anchor.onClick) {
      type = 'clickable';
    } else if (anchor.url) {
      type = 'href';
    } else {
      type = 'plain';
    }
  }

  return type;
}

export abstract class DbxAnchor<T extends ClickableAnchor = ClickableAnchor> {
  abstract readonly disabled$: Observable<Maybe<boolean>>;
  abstract readonly selected$: Observable<Maybe<boolean>>;
  abstract readonly anchor$: Observable<Maybe<T>>;
  abstract readonly type$: Observable<ClickableAnchorType>;
}

export function provideDbxAnchor<S extends DbxAnchor>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxAnchor,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
