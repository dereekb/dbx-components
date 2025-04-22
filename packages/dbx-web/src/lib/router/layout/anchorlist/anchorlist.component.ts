import { ChangeDetectionStrategy, Component, computed, input, Signal } from '@angular/core';
import { ClickableAnchorLinkTree, DbxInjectionComponent, ExpandedClickableAnchorLinkTree, expandClickableAnchorLinkTrees } from '@dereekb/dbx-core';
import { Configurable, type Maybe } from '@dereekb/util';
import { DbxAnchorComponent } from '../anchor/anchor.component';
import { MatListItem, MatListItemIcon, MatListItemLine, MatListItemTitle, MatNavList } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatDivider } from '@angular/material/divider';
import { NgClass } from '@angular/common';

export interface DbxAnchorListExpandedAnchor extends ExpandedClickableAnchorLinkTree {
  readonly classes: string;
}

/**
 * Component that displays a list of ClickableAnchorLink values within a MatNavList.
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
