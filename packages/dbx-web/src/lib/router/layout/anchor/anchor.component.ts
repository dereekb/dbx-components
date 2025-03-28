import { skipFirstMaybe } from '@dereekb/rxjs';
import { Input, Component, TemplateRef, ViewChild, OnDestroy, HostListener, inject, computed } from '@angular/core';
import { AbstractDbxAnchorDirective, DbxInjectionComponent, DbxInjectionComponentConfig, DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { map, distinctUntilChanged, shareReplay, BehaviorSubject } from 'rxjs';
import { DbxRouterWebProviderConfig } from '../../provider/router.provider.config';
import { NgIf, NgClass, NgSwitch, NgSwitchCase, NgSwitchDefault, NgTemplateOutlet, AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Component that renders an anchor element depending on the input.
 */
@Component({
  selector: 'dbx-anchor, [dbx-anchor]',
  templateUrl: './anchor.component.html',
  standalone: true,
  imports: [NgIf, NgClass, NgSwitch, NgSwitchCase, NgSwitchDefault, NgTemplateOutlet, AsyncPipe, DbxInjectionComponent],
  host: {
    class: 'd-inline dbx-anchor',
    'dbx-anchor-block': 'block'
  }
})
export class DbxAnchorComponent extends AbstractDbxAnchorDirective implements OnDestroy {
  private readonly dbNgxRouterWebProviderConfig = inject(DbxRouterWebProviderConfig);

  private readonly _templateRef = new BehaviorSubject<Maybe<TemplateRef<unknown>>>(undefined);
  readonly templateRef$ = this._templateRef.pipe(skipFirstMaybe(), shareReplay(1));

  readonly selectedClassSignal = computed(() => (this.selectedSignal() ? 'dbx-anchor-selected' : ''));

  @Input()
  public block?: boolean;

  @ViewChild('content', { read: TemplateRef })
  get templateRef(): Maybe<TemplateRef<unknown>> {
    return this._templateRef.value;
  }

  set templateRef(templateRef: Maybe<TemplateRef<unknown>>) {
    this._templateRef.next(templateRef);
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

  @HostListener('mouseenter')
  onMouseEnter(event?: Maybe<MouseEvent>) {
    this.anchor?.onMouse?.('enter', event);
  }

  @HostListener('mouseleave')
  onMouseLeave(event?: Maybe<MouseEvent>) {
    this.anchor?.onMouse?.('leave', event);
  }
}
