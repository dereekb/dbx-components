import { Input, OnDestroy, Output, EventEmitter, HostListener, Directive } from '@angular/core';
import { Maybe } from '@dereekb/util';

@Directive({
  selector: '[dbxWindowKeyDownListener]'
})
export class DbxWindowKeyDownListenerDirective implements OnDestroy {

  private _keysFilter?: Maybe<Set<string>>;

  @Input()
  appWindowKeyDownEnabled = true;

  @Output('dbxWindowKeyDownListener')
  keyPressed = new EventEmitter<KeyboardEvent>();

  @Input()
  set appWindowKeyDownFilter(filterOnKeys: string[]) {
    let filter: Maybe<Set<string>>;

    if (filterOnKeys) {
      filter = new Set(filterOnKeys);
    }

    this._keysFilter = filter;
  }

  ngOnDestroy(): void {
    this.keyPressed.complete();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (this.appWindowKeyDownEnabled !== false) {
      if (!this._keysFilter || this._keysFilter.has(event.key)) {
        this.keyPressed.emit(event);
      }
    }
  }

}
