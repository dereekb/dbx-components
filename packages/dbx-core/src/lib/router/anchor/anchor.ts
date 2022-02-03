import { ClickableFunction, ClickableUrl } from './clickable';
import { SegueRef } from '../segue';
import { expandFlattenTreeFunction, expandTreeFunction, ExpandTreeFunction, expandTrees, flattenTree, FlattenTreeFunction, flattenTrees, flattenTreeToArray, flattenTreeToArrayFunction, Maybe, TreeNode } from '@dereekb/util';
import { Type, Provider } from '@angular/core';
import { Observable } from 'rxjs';

export interface ClickableAnchor extends ClickableFunction, ClickableUrl, SegueRef {
  disabled?: boolean;
}

export interface ClickableAnchorLink extends ClickableAnchor {
  title: string;
  icon?: string;
}

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
  None = 0,
  Clickable = 1,
  Sref = 2,
  Href = 3,
  Disabled = 4
}

export function anchorTypeForAnchor(anchor: Maybe<ClickableAnchor>, disabled?: Maybe<boolean>): AnchorType {
  let type: AnchorType = AnchorType.Disabled;

  if (!disabled && anchor) {
    if (anchor.disabled) {
      type = AnchorType.Disabled;
    } else if (anchor.ref) {
      type = AnchorType.Sref;
    } else if (anchor.onClick) {
      type = AnchorType.Clickable;
    } else if (anchor.url) {
      type = AnchorType.Href;
    }
  }

  return type;
}

export abstract class DbxAnchor<T extends ClickableAnchor = ClickableAnchor> {
  abstract disabled$: Observable<Maybe<boolean>>;
  abstract anchor$: Observable<Maybe<T>>;
  abstract disabled: Maybe<boolean>;
  abstract anchor: Maybe<T>;
  abstract type$: Observable<AnchorType>;
}

export function ProvideDbxAnchor<S extends DbxAnchor>(sourceType: Type<S>): Provider[] {
  return [{
    provide: DbxAnchor,
    useExisting: sourceType
  }];
}
