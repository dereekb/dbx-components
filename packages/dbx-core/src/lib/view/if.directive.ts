import { Directive, type OnInit, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { distinctUntilChanged, type Observable } from 'rxjs';
import { cleanSubscription } from '../rxjs/subscription';

/**
 * Abstract structural directive that conditionally renders its template based on a reactive boolean observable,
 * similar to `*ngIf` but driven by an `Observable<boolean>`.
 *
 * Subclasses provide the `show$` observable to control visibility. The template is created
 * when `show$` emits `true` and cleared when it emits `false`.
 *
 * @example
 * ```typescript
 * @Directive({ selector: '[appShowIfAdmin]' })
 * export class ShowIfAdminDirective extends AbstractIfDirective {
 *   readonly show$ = inject(AuthService).isAdmin$;
 * }
 * ```
 *
 * @example
 * ```html
 * <div *appShowIfAdmin>Only visible to admins</div>
 * ```
 */
@Directive()
export abstract class AbstractIfDirective implements OnInit {
  private readonly _templateRef = inject(TemplateRef);
  private readonly _viewContainer = inject(ViewContainerRef);

  /**
   * Observable that is watched for showing/hiding.
   */
  abstract readonly show$: Observable<boolean>;

  private readonly _sub = cleanSubscription();

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
