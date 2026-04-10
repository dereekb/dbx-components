import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, map } from 'rxjs';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { DbxSpacerDirective } from '@dereekb/dbx-web';

/**
 * Global disabled state shared across all DocFeatureFormTabsComponent instances.
 */
const _disabled$ = new BehaviorSubject(false);

/**
 * Responsive layout component that shows two ng-content slots (formly and forge)
 * side-by-side on desktop, and stacked vertically on mobile.
 *
 * Includes a built-in disabled toggle backed by a global BehaviorSubject,
 * so toggling any instance toggles all instances on the page.
 *
 * @example
 * ```html
 * <doc-feature-form-tabs #formTabs formlyFn="formlyTextField()" forgeFn="forgeTextField()">
 *   <doc-form-example-form formly [disabled]="formTabs.disabled()" [dbxFormlyFields]="textFields"></doc-form-example-form>
 *   <doc-forge-example-form forge [disabled]="formTabs.disabled()" [config]="forgeTextFieldsConfig"></doc-forge-example-form>
 * </doc-feature-form-tabs>
 * ```
 */
@Component({
  selector: 'doc-feature-form-tabs',
  templateUrl: './feature.formtabs.component.html',
  styleUrls: ['./feature.formtabs.component.scss'],
  standalone: true,
  imports: [MatSlideToggle, DbxSpacerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFeatureFormTabsComponent {
  private readonly _breakpointObserver = inject(BreakpointObserver);
  readonly isMobile = toSignal(this._breakpointObserver.observe([Breakpoints.Handset, Breakpoints.TabletPortrait]).pipe(map((result) => result.matches)), { initialValue: false });

  readonly formlyFn = input<string>();
  readonly forgeFn = input<string>();

  readonly disabled = toSignal(_disabled$, { initialValue: false });

  setDisabled(value: boolean): void {
    _disabled$.next(value);
  }
}
