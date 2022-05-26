import { OnDestroy, Input, Component } from '@angular/core';
import { BehaviorSubject, map, shareReplay, distinctUntilChanged } from 'rxjs';
import { ClickableAnchorLinkTree, expandClickableAnchorLinkTrees } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';

/**
 * Component that displays a list of ClickableAnchorLink values within a MatNavList.
 */
@Component({
  selector: 'dbx-anchor-list',
  templateUrl: './anchorlist.component.html'
})
export class DbxAnchorListComponent implements OnDestroy {
  private _anchors = new BehaviorSubject<ClickableAnchorLinkTree[]>([]);

  readonly expandedAnchors$ = this._anchors.pipe(
    distinctUntilChanged(),
    map((x) => expandClickableAnchorLinkTrees(x)),
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
