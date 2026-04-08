import { Directive, type OnInit, inject, input } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DBX_DETACH_DEFAULT_KEY, type DbxDetachKey } from './detach';
import { DbxDetachService } from './detach.service';

/**
 * Directive that ensures a detached component exists in the {@link DbxDetachService} for the given key.
 *
 * Place this on any element to declaratively initialize a detached component.
 * The component is created in the service on init and is NOT destroyed when this directive is destroyed —
 * it lives in the service until explicitly closed.
 *
 * @example
 * ```html
 * <div [dbxDetachInit]="chatWidgetConfig" dbxDetachInitKey="support-chat"></div>
 * ```
 */
@Directive({
  selector: '[dbxDetachInit]',
  standalone: true
})
export class DbxDetachInitDirective implements OnInit {
  private readonly _detachService = inject(DbxDetachService);

  readonly config = input.required<DbxInjectionComponentConfig>({ alias: 'dbxDetachInit' });
  readonly key = input<DbxDetachKey>(DBX_DETACH_DEFAULT_KEY, { alias: 'dbxDetachInitKey' });

  ngOnInit(): void {
    this._detachService.init({
      ...this.config(),
      key: this.key()
    });
  }
}
