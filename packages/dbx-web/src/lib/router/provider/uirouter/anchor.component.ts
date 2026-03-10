import { ChangeDetectionStrategy, Component, computed, ElementRef, viewChild } from '@angular/core';
import { AbstractDbxSegueAnchorDirective } from '../../layout/anchor/anchor.segue.directive';
import { type Obj, type StateOrName, type TransitionOptions, UIRouterModule } from '@uirouter/angular';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { toSignal } from '@angular/core/rxjs-interop';
import { overrideClickElementEffect } from '../../../util/click';

/**
 * Segue anchor component that renders a `uiSref`-based anchor element for UIRouter.
 *
 * Injected by {@link DbxAnchorComponent} via {@link DbxRouterWebProviderConfig} when the app is configured with {@link provideDbxRouterWebUiRouterProviderConfig}.
 */
@Component({
  templateUrl: './anchor.component.html',
  imports: [UIRouterModule, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxUIRouterSegueAnchorComponent extends AbstractDbxSegueAnchorDirective {
  private readonly _parentAnchorSignal = toSignal(this.parent.anchor$, { initialValue: undefined });

  readonly anchorElement = viewChild.required<string, ElementRef<HTMLElement>>('anchor', { read: ElementRef });
  readonly injectionElement = viewChild.required<string, ElementRef<HTMLElement>>('injection', { read: ElementRef });
  readonly anchorDisabledSignal = computed(() => this.anchorSignal()?.disabled ?? false);

  protected readonly _overrideClickElementEffect = overrideClickElementEffect({
    clickTarget: this.anchorElement,
    childClickTarget: this.injectionElement,
    disabledSignal: this.anchorDisabledSignal
  });

  readonly uiSrefSignal = computed<StateOrName>(() => (this._parentAnchorSignal()?.ref ?? '') as StateOrName);
  readonly uiParamsSignal = computed<Obj | undefined>(() => this._parentAnchorSignal()?.refParams);
  readonly uiOptionsSignal = computed<TransitionOptions>(() => this._parentAnchorSignal()?.refOptions ?? ({} as TransitionOptions));
}
