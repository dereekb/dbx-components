import { type MousableFunction } from './mousable';
import { type ClickableFunction, type ClickableUrl } from './clickable';
import { type SegueRef } from '../segue';
import { expandFlattenTreeFunction, expandTreeFunction, type ExpandTreeFunction, type FlattenTreeFunction, flattenTreeToArrayFunction, type Maybe, type TreeNode } from '@dereekb/util';
import { type Type, type Provider, forwardRef } from '@angular/core';
import { type Observable } from 'rxjs';
import { type DbxInjectionComponentConfig } from '../../injection/injection';

/**
 * Represents a clickable anchor element that combines click handling, mouse event handling, URL linking, and segue-based routing.
 *
 * This is the foundational anchor interface used across the application for navigation elements such as links, buttons, and menu items.
 *
 * @example
 * ```ts
 * const anchor: ClickableAnchor = {
 *   ref: 'app.dashboard',
 *   onClick: () => console.log('clicked'),
 *   disabled: false,
 *   selected: true
 * };
 * ```
 *
 * @see {@link ClickableFunction} for click handling
 * @see {@link MousableFunction} for mouse event handling
 * @see {@link ClickableUrl} for external URL configuration
 * @see {@link SegueRef} for router navigation references
 */
export interface ClickableAnchor extends ClickableFunction, MousableFunction, ClickableUrl, Partial<SegueRef> {
  /** Whether this anchor is disabled and should not be interactive. */
  readonly disabled?: boolean;
  /** Whether this anchor is currently in a selected/active state. */
  readonly selected?: boolean;
}

/**
 * Title and an optional icon.
 */
export interface IconAndTitle {
  readonly title: string;
  readonly icon?: Maybe<string>;
}

/**
 * A clickable anchor with a title, optional icon, hint text, and custom injection content.
 *
 * Used to represent navigation links in menus, sidebars, and other navigable UI components.
 *
 * @example
 * ```ts
 * const link: ClickableAnchorLink = {
 *   title: 'Dashboard',
 *   icon: 'dashboard',
 *   hint: 'View your main dashboard',
 *   ref: 'app.dashboard'
 * };
 * ```
 *
 * @see {@link ClickableAnchor} for the base anchor interface
 * @see {@link IconAndTitle} for the title and icon properties
 */
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
/**
 * A {@link ClickableAnchorLink} that is guaranteed to have a {@link SegueRef}, ensuring it represents a navigable router link.
 *
 * @see {@link ClickableAnchorLink}
 * @see {@link SegueRef}
 */
export type ClickableAnchorLinkSegueRef = ClickableAnchorLink & SegueRef;

/**
 * A clickable anchor link where the icon is required but the title is omitted.
 *
 * Useful for icon-only navigation elements such as toolbar buttons.
 *
 * @see {@link ClickableAnchorLink}
 */
export interface ClickableIconAnchorLink extends Omit<ClickableAnchorLink, 'title'> {
  /** The icon identifier (e.g., Material icon name). */
  readonly icon: string;
}

/**
 * A hierarchical tree structure of {@link ClickableAnchorLink} nodes, where each node can have child links.
 *
 * Used to represent nested navigation structures such as sidebar menus with sub-items.
 *
 * @example
 * ```ts
 * const tree: ClickableAnchorLinkTree = {
 *   title: 'Settings',
 *   icon: 'settings',
 *   ref: 'app.settings',
 *   children: [
 *     { title: 'Profile', ref: 'app.settings.profile' },
 *     { title: 'Security', ref: 'app.settings.security' }
 *   ]
 * };
 * ```
 *
 * @see {@link ClickableAnchorLink}
 * @see {@link expandClickableAnchorLinkTree} for flattening trees
 */
export interface ClickableAnchorLinkTree extends ClickableAnchorLink {
  /** Optional child links forming a nested navigation tree. */
  readonly children?: ClickableAnchorLinkTree[];
}

/**
 * A tree node wrapping a {@link ClickableAnchorLinkTree} value, produced by expanding the tree structure.
 *
 * @see {@link expandClickableAnchorLinkTreeNode}
 * @see {@link TreeNode}
 */
export type ExpandedClickableAnchorLinkTree = TreeNode<ClickableAnchorLinkTree>;

/**
 * Function that expands a single {@link ClickableAnchorLinkTree} node into a tree of {@link ExpandedClickableAnchorLinkTree} nodes.
 *
 * @see {@link expandClickableAnchorLinkTree} for the full expand-and-flatten operation
 */
export const expandClickableAnchorLinkTreeNode: ExpandTreeFunction<ClickableAnchorLinkTree, ExpandedClickableAnchorLinkTree> = expandTreeFunction({
  getChildren: (x) => x.children
});

/**
 * Flattens an expanded tree of {@link ExpandedClickableAnchorLinkTree} nodes into a flat array, preserving the tree node wrappers.
 */
export const flattenExpandedClickableAnchorLinkTree: FlattenTreeFunction<ExpandedClickableAnchorLinkTree, ExpandedClickableAnchorLinkTree> = flattenTreeToArrayFunction();

/**
 * Flattens an expanded tree of {@link ExpandedClickableAnchorLinkTree} nodes into a flat array of the underlying {@link ClickableAnchorLinkTree} values.
 */
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

/**
 * Determines the {@link ClickableAnchorType} for a given anchor based on its properties.
 *
 * Priority order: disabled > sref (router link) > clickable (onClick handler) > href (external URL) > plain.
 *
 * @param anchor - The anchor to evaluate.
 * @param disabled - An optional external disabled override; if `true`, the anchor type will be `'disabled'` regardless of the anchor's own state.
 * @returns The determined {@link ClickableAnchorType}.
 */
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

/**
 * Abstract base class representing a reactive anchor element that exposes its state as observables.
 *
 * Subclasses provide concrete implementations that manage the anchor's disabled, selected, and type states.
 *
 * @typeParam T - The specific anchor type, defaulting to {@link ClickableAnchor}.
 *
 * @example
 * ```ts
 * @Component({ ... })
 * class MyAnchorComponent extends DbxAnchor {
 *   readonly disabled$ = of(false);
 *   readonly selected$ = of(true);
 *   readonly anchor$ = of({ ref: 'app.home' });
 *   readonly type$ = of('sref' as ClickableAnchorType);
 * }
 * ```
 *
 * @see {@link provideDbxAnchor} for configuring DI providers
 * @see {@link AbstractDbxAnchorDirective} for the directive-based implementation
 */
export abstract class DbxAnchor<T extends ClickableAnchor = ClickableAnchor> {
  abstract readonly disabled$: Observable<Maybe<boolean>>;
  abstract readonly selected$: Observable<Maybe<boolean>>;
  abstract readonly anchor$: Observable<Maybe<T>>;
  abstract readonly type$: Observable<ClickableAnchorType>;
}

/**
 * Creates Angular DI providers that register the given source type as a {@link DbxAnchor} provider using `forwardRef`.
 *
 * @typeParam S - The concrete {@link DbxAnchor} subclass to provide.
 * @param sourceType - The class type to register as the anchor provider.
 * @returns An array of Angular providers.
 *
 * @example
 * ```ts
 * @Directive({
 *   selector: '[myAnchor]',
 *   providers: provideDbxAnchor(MyAnchorDirective)
 * })
 * class MyAnchorDirective extends DbxAnchor { ... }
 * ```
 */
export function provideDbxAnchor<S extends DbxAnchor>(sourceType: Type<S>): Provider[] {
  return [
    {
      provide: DbxAnchor,
      useExisting: forwardRef(() => sourceType)
    }
  ];
}
