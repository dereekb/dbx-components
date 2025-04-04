import { MousableFunction } from './mousable';
import { ClickableFunction, ClickableUrl } from './clickable';
import { SegueRef } from '../segue';
import { expandFlattenTreeFunction, expandTreeFunction, ExpandTreeFunction, FlattenTreeFunction, flattenTreeToArrayFunction, Maybe, TreeNode } from '@dereekb/util';
import { Type, Provider, forwardRef } from '@angular/core';
import { Observable } from 'rxjs';
import { DbxInjectionComponentConfig } from '../../injection/injection';

export interface ClickableAnchor extends ClickableFunction, MousableFunction, ClickableUrl, Partial<SegueRef> {
  disabled?: boolean;
  selected?: boolean;
}

/**
 * Title and an optional icon.
 */
export interface IconAndTitle {
  title: string;
  icon?: Maybe<string>;
}

export interface ClickableAnchorLink extends ClickableAnchor, IconAndTitle {
  /**
   * Optional detail string/content.
   */
  hint?: string;
  /**
   * Custom injection content for this link.
   */
  content?: DbxInjectionComponentConfig;
}

/**
 * ClickableAnchorLink that definitely has a SegueRef
 */
export type ClickableAnchorLinkSegueRef = ClickableAnchorLink & SegueRef;

export interface ClickableIconAnchorLink extends Omit<ClickableAnchorLink, 'title'> {
  icon: string;
}

export interface ClickableAnchorLinkTree extends ClickableAnchorLink {
  children?: ClickableAnchorLinkTree[];
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

export enum AnchorType {
  /**
   * When the anchor has no specific content but is not disabled.
   *
   * Is a passthrough for the content.
   */
  PLAIN = 0,
  CLICKABLE = 1,
  SREF = 2,
  HREF = 3,
  DISABLED = 4
}

export function anchorTypeForAnchor(anchor: Maybe<ClickableAnchor>, disabled?: Maybe<boolean>): AnchorType {
  let type: AnchorType = AnchorType.DISABLED;

  if (!disabled && anchor) {
    if (anchor.disabled) {
      type = AnchorType.DISABLED;
    } else if (anchor.ref) {
      type = AnchorType.SREF;
    } else if (anchor.onClick) {
      type = AnchorType.CLICKABLE;
    } else if (anchor.url) {
      type = AnchorType.HREF;
    } else {
      type = AnchorType.PLAIN;
    }
  }

  return type;
}

export abstract class DbxAnchor<T extends ClickableAnchor = ClickableAnchor> {
  abstract readonly disabled$: Observable<Maybe<boolean>>;
  abstract readonly selected$: Observable<Maybe<boolean>>;
  abstract readonly anchor$: Observable<Maybe<T>>;
  abstract readonly disabled: Maybe<boolean>;
  abstract readonly selected: Maybe<boolean>;
  abstract readonly anchor: Maybe<T>;
  abstract readonly type$: Observable<AnchorType>;
}

export function provideDbxAnchor<S extends DbxAnchor>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxAnchor,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
