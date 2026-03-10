import { HostListener, Directive, input, output, computed } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Listens for `window:keydown` events and emits matching keyboard events.
 *
 * Optionally filters by specific key names and can be disabled at runtime.
 *
 * @example
 * ```html
 * <!-- Listen for all keydown events -->
 * <div dbxWindowKeyDownListener (dbxWindowKeyDownListener)="onKey($event)"></div>
 *
 * <!-- Listen only for Escape and Enter keys -->
 * <div dbxWindowKeyDownListener
 *   [dbxWindowKeyDownFilter]="['Escape', 'Enter']"
 *   (dbxWindowKeyDownListener)="onKey($event)">
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxWindowKeyDownListener]',
  standalone: true
})
export class DbxWindowKeyDownListenerDirective {
  readonly dbxWindowKeyDownListener = output<KeyboardEvent>();

  readonly dbxWindowKeyDownEnabled = input<Maybe<boolean>>();
  readonly dbxWindowKeyDownFilter = input<Maybe<string[]>>();

  readonly isEnabledSignal = this.dbxWindowKeyDownEnabled;

  readonly keysFilterSignal = computed(() => {
    const filterOnKeys = this.dbxWindowKeyDownFilter();
    let filter: Maybe<Set<string>>;

    if (filterOnKeys) {
      filter = new Set(filterOnKeys);
    }

    return filter;
  });

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    const keysFilter = this.keysFilterSignal();
    const enabled = this.isEnabledSignal();

    if (enabled !== false) {
      if (!keysFilter || keysFilter.has(event.key)) {
        this.dbxWindowKeyDownListener.emit(event);
      }
    }
  }
}
