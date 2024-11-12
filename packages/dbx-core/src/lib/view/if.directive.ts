import { Directive, OnInit, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { distinctUntilChanged, Observable } from 'rxjs';
import { AbstractSubscriptionDirective } from '../subscription';

/**
 * Abstract directive class that watches a show$ observable and behaves like *ngIf.
 */
@Directive()
export abstract class AbstractIfDirective extends AbstractSubscriptionDirective implements OnInit {
  private readonly _templateRef = inject(TemplateRef<unknown>);
  private readonly _viewContainer = inject(ViewContainerRef);

  /**
   * Observable that is watched for showing/hiding.
   */
  abstract readonly show$: Observable<boolean>;

  constructor() {
    super();
  }

  ngOnInit() {
    this.sub = this.show$.pipe(distinctUntilChanged()).subscribe((show) => {
      if (show) {
        this._viewContainer.createEmbeddedView(this._templateRef);
      } else {
        this._viewContainer.clear();
      }
    });
  }
}
