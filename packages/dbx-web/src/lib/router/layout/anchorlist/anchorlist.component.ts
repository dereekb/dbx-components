import { OnDestroy, Input, Component } from '@angular/core';
import { BehaviorSubject, map, shareReplay, distinctUntilChanged, Observable } from 'rxjs';
import { ClickableAnchorLinkTree, ExpandedClickableAnchorLinkTree, expandClickableAnchorLinkTrees } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

export interface DbxAnchorListExpandedAnchor extends ExpandedClickableAnchorLinkTree {
  classes: string;
}

/**
 * Component that displays a list of ClickableAnchorLink values within a MatNavList.
 */
@Component({
  selector: 'dbx-anchor-list',
  templateUrl: './anchorlist.component.html'
})
export class DbxAnchorListComponent implements OnDestroy {
  private _anchors = new BehaviorSubject<ClickableAnchorLinkTree[]>([]);

  readonly expandedAnchors$: Observable<DbxAnchorListExpandedAnchor[]> = this._anchors.pipe(
    distinctUntilChanged(),
    map((x) =>
      expandClickableAnchorLinkTrees(x).map((y) => {
        (y as DbxAnchorListExpandedAnchor).classes = `${y.depth > 0 ? `dbx-anchor-list-child` : 'dbx-anchor-list-root'} dbx-anchor-list-depth-${y.depth}`;
        return y as DbxAnchorListExpandedAnchor;
      })
    ),
    shareReplay(1)
  );

  @Input()
  set anchors(anchors: Maybe<ClickableAnchorLinkTree[]>) {
    this._anchors.next(anchors ?? []);
  }

  ngOnDestroy(): void {
    this._anchors.complete();
  }
}
