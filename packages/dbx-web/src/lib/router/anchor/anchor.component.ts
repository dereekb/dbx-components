import { skipFirstMaybe } from '@dereekb/rxjs';
import { Input, Component, TemplateRef, ViewChild } from '@angular/core';
import { AbstractDbNgxAnchorDirective, DbNgxInjectedComponentConfig } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { BehaviorSubject } from 'rxjs';
import { map, distinctUntilChanged, shareReplay } from 'rxjs/operators';
import { DbNgxRouterWebProviderConfig } from '../provider/router.provider.config';

/**
 * Component that renders an anchor element depending on the input.
 */
@Component({
  selector: 'dbx-anchor, [dbx-anchor]',
  templateUrl: './anchor.component.html',
  styleUrls: ['./anchor.scss']
})
export class DbNgxAnchorComponent extends AbstractDbNgxAnchorDirective {

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

  constructor(private readonly dbNgxRouterWebProviderConfig: DbNgxRouterWebProviderConfig) {
    super();
  }

  get srefAnchorConfig(): DbNgxInjectedComponentConfig {
    return this.dbNgxRouterWebProviderConfig.anchorSegueRefComponent;
  }

  get anchorBlockClass(): string {
    return this.block ? 'dbx-anchor-block' : '';
  }

  clickAnchor(event?: Maybe<MouseEvent>): void {
    this.anchor?.onClick?.(event);
  }

}
