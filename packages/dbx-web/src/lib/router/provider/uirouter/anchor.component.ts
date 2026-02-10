import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, OnDestroy, viewChild } from '@angular/core';
import { AbstractDbxSegueAnchorDirective } from '../../layout/anchor/anchor.segue.directive';
import { Obj, StateOrName, TransitionOptions, UIRouterModule } from '@uirouter/angular';
import { DbxInjectionComponent } from '@dereekb/dbx-core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Maybe } from '@dereekb/util';

/**
 * SegueAnchor implementation for UIRouter.
 */
@Component({
  templateUrl: './anchor.component.html',
  imports: [UIRouterModule, DbxInjectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxUIRouterSegueAnchorComponent extends AbstractDbxSegueAnchorDirective implements OnDestroy {
  private _cleanupClickOverride: Maybe<() => void> = null;

  private readonly _parentAnchorSignal = toSignal(this.parent.anchor$, { initialValue: undefined });

  readonly anchorElement = viewChild.required<string, ElementRef<HTMLElement>>('anchor', { read: ElementRef });
  readonly injectionElement = viewChild.required<string, ElementRef<HTMLElement>>('injection', { read: ElementRef });
  readonly anchorDisabledSignal = computed(() => this.anchorSignal()?.disabled ?? false);

  /**
   * This effect exists to solve the issue of an injected element that utilizes event.stopPropogation() and doesn't also call event.preventDefault().
   *
   * We didn't want to use css's pointer-events: none as that would disable the Angular Material button effects.
   *
   * For example, dbx-button would call event.stopPropagation() on click, which would prevent the uiSref from being triggered, but the default behavior
   * of the anchor element would still be triggered, causing the browser to load/reload the page at the given href instead of navigating to the new state using uiSref.
   *
   * NOTE: Those nested event listeners are still ultimately triggered.
   */
  protected readonly _overrideClickElementEffect = effect(() => {
    const anchorElement = this.anchorElement();
    const injectionElement = this.injectionElement();
    const anchorDisabled = this.anchorDisabledSignal();

    if (injectionElement) {
      // cleanup/remove the previous/existing click function
      if (this._cleanupClickOverride) {
        this._cleanupClickOverride();
      }

      if (!anchorDisabled) {
        const clickOverride = (event: MouseEvent) => {
          // Allow ctrl+click, cmd+click, shift+click, and middle-click for new tab/window
          // Don't preventDefault or stopPropagation - let browser handle it naturally
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1) {
            return; // Browser will open in new tab/window
          } else {
            // otherwise, also trigger a click on the uiSref anchor element
            anchorElement?.nativeElement.click();
            // Prevents the default behavior of the anchor element's href from being triggered
            event.preventDefault();
            event.stopPropagation();
          }
        };

        this._cleanupClickOverride = () => {
          injectionElement.nativeElement.removeEventListener('click', clickOverride);
          delete this._cleanupClickOverride;
        };

        injectionElement.nativeElement.addEventListener('click', clickOverride, {
          capture: true // Use capture to ensure this event listener is called before any nested child's event listeners
        });
      }
    }
  });

  readonly uiSrefSignal = computed<StateOrName>(() => (this._parentAnchorSignal()?.ref ?? '') as StateOrName);
  readonly uiParamsSignal = computed<Obj | undefined>(() => this._parentAnchorSignal()?.refParams);
  readonly uiOptionsSignal = computed<TransitionOptions>(() => this._parentAnchorSignal()?.refOptions ?? ({} as TransitionOptions));

  ngOnDestroy(): void {
    if (this._cleanupClickOverride) {
      this._cleanupClickOverride();
    }
  }
}
