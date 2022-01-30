import { skipFirstMaybe } from '@dereekb/rxjs';
import { Input, Component, TemplateRef, ViewChild } from '@angular/core';
import { AbstractDbxAnchorDirective, DbxInjectedComponentConfig } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';
import { map, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { DbxRouterWebProviderConfig } from '../provider/router.provider.config';

/**
 * Component that renders an anchor element depending on the input.
 */
@Component({
  selector: 'dbx-anchor, [dbx-anchor]',
  templateUrl: './anchor.component.html',
  // TODO: styleUrls: ['./anchor.scss']
})
export class DbxAnchorComponent extends AbstractDbxAnchorDirective {

  private _templateRef = new BehaviorSubject<Maybe<TemplateRef<any>>>(undefined);
  readonly templateRef$ = this._templateRef.pipe(skipFirstMaybe(), shareReplay(1));

  @Input()
  public block?: boolean;

  @ViewChild('content', { read: TemplateRef })
  get templateRef(): Maybe<TemplateRef<any>> {
    return this._templateRef.value;
  }

  set templateRef(templateRef: Maybe<TemplateRef<any>>) {
    this._templateRef.next(templateRef);
  }

  readonly url$ = this.anchor$.pipe(map(x => x?.url), distinctUntilChanged(), shareReplay(1));
  readonly target$ = this.anchor$.pipe(map(x => x?.target), distinctUntilChanged(), shareReplay(1));

  constructor(private readonly dbNgxRouterWebProviderConfig: DbxRouterWebProviderConfig) {
    super();
  }

  get srefAnchorConfig(): DbxInjectedComponentConfig {
    return this.dbNgxRouterWebProviderConfig.anchorSegueRefComponent;
  }

  get anchorBlockClass(): string {
    return this.block ? 'dbx-anchor-block' : '';
  }

  clickAnchor(event?: Maybe<MouseEvent>): void {
    this.anchor?.onClick?.(event);
  }

}
