import { Input, OnDestroy, Output, EventEmitter, HostListener, Directive, input, output, computed } from '@angular/core';
import { type Maybe } from '@dereekb/util';

@Directive({
  selector: '[dbxWindowKeyDownListener]',
  standalone: true
})
export class DbxWindowKeyDownListenerDirective {
  readonly dbxWindowKeyDownListener = output<KeyboardEvent>();

  readonly appWindowKeyDownEnabled = input<boolean>();
  readonly appWindowKeyDownFilter = input<Maybe<string[]>>();

  readonly keysFilter = computed(() => {
    const filterOnKeys = this.appWindowKeyDownFilter();
    let filter: Maybe<Set<string>>;

    if (filterOnKeys) {
      filter = new Set(filterOnKeys);
    }

    return filter;
  });

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    const keysFilter = this.keysFilter();

    if (this.appWindowKeyDownEnabled() !== false) {
      if (!keysFilter || keysFilter.has(event.key)) {
        this.dbxWindowKeyDownListener.emit(event);
      }
    }
  }
}
