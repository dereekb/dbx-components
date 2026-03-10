import { ChangeDetectionStrategy, Component, computed, input, type Signal } from '@angular/core';
import { type ClickableAnchorLinkTree, DbxInjectionComponent, type ExpandedClickableAnchorLinkTree, expandClickableAnchorLinkTrees } from '@dereekb/dbx-core';
import { type Configurable, type Maybe } from '@dereekb/util';
import { DbxAnchorComponent } from '../anchor/anchor.component';
import { MatListItem, MatListItemIcon, MatListItemLine, MatListItemTitle, MatNavList } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { NgClass } from '@angular/common';

/**
 * An expanded anchor link tree node with computed CSS classes for depth-based styling.
 */
export interface DbxAnchorListExpandedAnchor extends ExpandedClickableAnchorLinkTree {
  readonly classes: string;
}

/**
 * Displays a hierarchical list of {@link ClickableAnchorLinkTree} items inside a Material navigation list.
 *
 * Each anchor is expanded and assigned depth-based CSS classes for nested styling.
 *
 * @example
 * ```html
 * <dbx-anchor-list [anchors]="navLinks"></dbx-anchor-list>
 * ```
 */
@Component({
  selector: 'dbx-anchor-list',
  templateUrl: './anchorlist.component.html',
  imports: [NgClass, MatNavList, MatListItem, MatListItemIcon, MatListItemLine, MatListItemTitle, MatIconModule, MatDivider, DbxAnchorComponent, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxAnchorListComponent {
  readonly anchors = input.required<ClickableAnchorLinkTree[], Maybe<ClickableAnchorLinkTree[]>>({ transform: (x) => x ?? [] });

  readonly expandedAnchors: Signal<DbxAnchorListExpandedAnchor[]> = computed(() => {
    const anchors = this.anchors();
    return expandClickableAnchorLinkTrees(anchors).map((y) => {
      (y as Configurable<DbxAnchorListExpandedAnchor>).classes = `${y.depth > 0 ? 'dbx-anchor-list-child' : 'dbx-anchor-list-root'} dbx-anchor-list-depth-${y.depth}`;
      return y as DbxAnchorListExpandedAnchor;
    });
  });
}
