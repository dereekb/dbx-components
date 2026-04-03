import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

/**
 * Responsive layout component that shows two ng-content slots (formly and forge)
 * side-by-side on desktop, and stacked vertically on mobile.
 *
 * @example
 * ```html
 * <doc-feature-form-tabs>
 *   <doc-form-example-form formly [dbxFormlyFields]="textFields"></doc-form-example-form>
 *   <doc-forge-example-form forge [config]="forgeTextFieldsConfig"></doc-forge-example-form>
 * </doc-feature-form-tabs>
 * ```
 */
@Component({
  selector: 'doc-feature-form-tabs',
  templateUrl: './feature.formtabs.component.html',
  styleUrls: ['./feature.formtabs.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFeatureFormTabsComponent {
  private readonly _breakpointObserver = inject(BreakpointObserver);
  readonly isMobile = toSignal(this._breakpointObserver.observe([Breakpoints.Handset, Breakpoints.TabletPortrait]).pipe(map((result) => result.matches)), { initialValue: false });
}
