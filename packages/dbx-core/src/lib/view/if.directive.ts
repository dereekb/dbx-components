import { Directive, OnInit, TemplateRef, ViewContainerRef } from "@angular/core";
import { distinctUntilChanged, Observable } from "rxjs";
import { AbstractSubscriptionDirective } from "../subscription";

/**
 * Abstract directive class that watches a show$ observable and behaves like *ngIf.
 */
@Directive()
export abstract class AbstractIfDirective extends AbstractSubscriptionDirective implements OnInit {

  /**
   * Observable that is watched for showing/hiding.
   */
  readonly abstract show$: Observable<boolean>;

  constructor(
    private templateRef: TemplateRef<unknown>,
    private viewContainer: ViewContainerRef
  ) {
    super();
  }

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
