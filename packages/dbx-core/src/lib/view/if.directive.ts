import { Directive, OnInit, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { distinctUntilChanged, Observable } from 'rxjs';
import { AbstractSubscriptionDirective } from '../subscription';

/**
 * Abstract directive class that watches a show$ observable and behaves like *ngIf.
 */
@Directive()
export abstract class AbstractIfDirective extends AbstractSubscriptionDirective implements OnInit {
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);

  /**
   * Observable that is watched for showing/hiding.
   */
  abstract readonly show$: Observable<boolean>;

  ngOnInit() {
    this.sub = this.show$.pipe(distinctUntilChanged()).subscribe((show) => {
      if (show) {
        this.viewContainer.createEmbeddedView(this.templateRef);
      } else {
        this.viewContainer.clear();
      }
    });
  }
}
