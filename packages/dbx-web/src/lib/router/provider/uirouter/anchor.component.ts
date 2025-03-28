import { Component, computed } from '@angular/core';
import { AbstractDbxSegueAnchorDirective } from '../../layout/anchor/anchor.segue.directive';
import { Obj, StateOrName, TransitionOptions, UISref } from '@uirouter/angular';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * SegueAnchor implementation for UIRouter.
 */
@Component({
  templateUrl: './anchor.component.html',
  imports: [UISref, DbxInjectionComponent, AsyncPipe],
  standalone: true
})
export class DbxUIRouterSegueAnchorComponent extends AbstractDbxSegueAnchorDirective {
  private readonly _parentAnchorSignal = toSignal(this.parent.anchor$, { initialValue: undefined });

  readonly uiSrefSignal = computed<StateOrName>(() => (this._parentAnchorSignal()?.ref ?? '') as StateOrName);
  readonly uiParamsSignal = computed<Obj | undefined>(() => this._parentAnchorSignal()?.refParams);
  readonly uiOptionsSignal = computed<TransitionOptions>(() => this._parentAnchorSignal()?.refOptions ?? ({} as TransitionOptions));
}
