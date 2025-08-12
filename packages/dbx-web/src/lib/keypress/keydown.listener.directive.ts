import { HostListener, Directive, input, output, computed } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Binds to the window:keydown event and emits events.
 */
@Directive({
  selector: '[dbxWindowKeyDownListener]',
  standalone: true
})
export class DbxWindowKeyDownListenerDirective {
  readonly dbxWindowKeyDownListener = output<KeyboardEvent>();

  /**
   * @deprecated Use dbxWindowKeyDownEnabled instead.
   */
  readonly appWindowKeyDownEnabled = input<Maybe<boolean>>();

  /**
   * @deprecated Use dbxWindowKeyDownFilter instead.
   */
  readonly appWindowKeyDownFilter = input<Maybe<string[]>>();

  readonly dbxWindowKeyDownEnabled = input<Maybe<boolean>>();
  readonly dbxWindowKeyDownFilter = input<Maybe<string[]>>();

  readonly isEnabledSignal = computed(() => this.dbxWindowKeyDownEnabled() ?? this.appWindowKeyDownEnabled());

  readonly keysFilterSignal = computed(() => {
    const filterOnKeys = this.dbxWindowKeyDownFilter() ?? this.appWindowKeyDownFilter();
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
