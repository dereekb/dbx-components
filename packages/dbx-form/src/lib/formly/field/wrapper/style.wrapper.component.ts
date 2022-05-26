import { OnInit, OnDestroy, Component } from '@angular/core';
import { asObservable, ObservableOrValue, switchMapMaybeDefault } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { FieldWrapper, FormlyFieldConfig } from '@ngx-formly/core';
import { BehaviorSubject, Observable, shareReplay } from 'rxjs';

export interface DbxFormStyleWrapperConfig {
  style: ObservableOrValue<string>;
}

export interface DbxFormStyleWrapperFormlyConfig extends FormlyFieldConfig {
  styleWrapper: DbxFormStyleWrapperConfig;
}

@Component({
  template: `
    <div [ngClass]="(style$ | async) ?? ''">
      <ng-container #fieldComponent></ng-container>
    </div>
  `
})
export class DbxFormStyleWrapperComponent extends FieldWrapper<DbxFormStyleWrapperFormlyConfig> implements OnInit, OnDestroy {
  private _style = new BehaviorSubject<Maybe<Observable<string>>>(undefined);
  readonly style$ = this._style.pipe(switchMapMaybeDefault(''), shareReplay(1));

  get styleWrapper(): DbxFormStyleWrapperConfig {
    return this.field.styleWrapper;
  }

  get styleGetter(): ObservableOrValue<string> {
    return this.styleWrapper.style;
  }

  ngOnInit(): void {
    this._style.next(asObservable(this.styleGetter));
  }

  ngOnDestroy(): void {
    this._style.complete();
  }
}
