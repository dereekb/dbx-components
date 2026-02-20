import { Directive, OnInit, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { distinctUntilChanged, Observable } from 'rxjs';
import { AbstractSubscriptionDirective } from '../rxjs/rxjs.directive';
import { subscriptionObject } from '../rxjs/subscription';

/**
 * Abstract directive class that watches a show$ observable and behaves like *ngIf.
 */
@Directive()
export abstract class AbstractIfDirective implements OnInit {
  private readonly _templateRef = inject(TemplateRef);
  private readonly _viewContainer = inject(ViewContainerRef);

  /**
   * Observable that is watched for showing/hiding.
   */
  abstract readonly show$: Observable<boolean>;

  private readonly _sub = subscriptionObject();

  ngOnInit() {
    this._sub.subscription = this.show$.pipe(distinctUntilChanged()).subscribe((show) => {
      if (show) {
        this._viewContainer.createEmbeddedView(this._templateRef);
      } else {
        this._viewContainer.clear();
      }
    });
  }
}
