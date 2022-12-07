import { skipFirstMaybe } from '@dereekb/rxjs';
import { Input, Component, TemplateRef, ViewChild, OnDestroy } from '@angular/core';
import { AbstractDbxAnchorDirective, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { map, distinctUntilChanged, shareReplay, BehaviorSubject } from 'rxjs';
import { DbxRouterWebProviderConfig } from '../../provider/router.provider.config';

/**
 * Component that renders an anchor element depending on the input.
 */
@Component({
  selector: 'dbx-anchor, [dbx-anchor]',
  templateUrl: './anchor.component.html',
  host: {
    class: 'd-inline dbx-anchor',
    'dbx-anchor-block': 'block'
  }
})
export class DbxAnchorComponent extends AbstractDbxAnchorDirective implements OnDestroy {
  private _templateRef = new BehaviorSubject<Maybe<TemplateRef<unknown>>>(undefined);
  readonly templateRef$ = this._templateRef.pipe(skipFirstMaybe(), shareReplay(1));

  @Input()
  public block?: boolean;

  @ViewChild('content', { read: TemplateRef })
  get templateRef(): Maybe<TemplateRef<unknown>> {
    return this._templateRef.value;
  }

  set templateRef(templateRef: Maybe<TemplateRef<unknown>>) {
    this._templateRef.next(templateRef);
  }

  readonly url$ = this.anchor$.pipe(
    map((x) => x?.url),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly target$ = this.anchor$.pipe(
    map((x) => x?.target),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly selectedClass$ = this.selected$.pipe(
    map((selected) => (selected ? 'dbx-anchor-selected' : '')),
    shareReplay(1)
  );

  constructor(private readonly dbNgxRouterWebProviderConfig: DbxRouterWebProviderConfig) {
    super();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._templateRef.complete();
  }

  get srefAnchorConfig(): DbxInjectionComponentConfig {
    return this.dbNgxRouterWebProviderConfig.anchorSegueRefComponent;
  }

  clickAnchor(event?: Maybe<MouseEvent>): void {
    this.anchor?.onClick?.(event);
  }
}
