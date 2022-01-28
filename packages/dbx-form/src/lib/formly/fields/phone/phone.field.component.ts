import { switchMap, shareReplay, map, filter, startWith, tap, first, distinctUntilChanged, delay, debounce, debounceTime, throttleTime, zipAll } from 'rxjs/operators';
import {
  Component, ComponentFactoryResolver, ElementRef, NgZone, OnDestroy, OnInit, Type, ViewChild, ViewContainerRef
} from '@angular/core';
import { AbstractControl, FormControl, ValidationErrors, Validators } from '@angular/forms';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';
import { BehaviorSubject, Observable, of, combineLatest, Subject, merge } from 'rxjs';

export interface DbNgxInternationalPhoneFieldConfig {
  preferredCountries?: string[];
  onlyCountries?: string[];
}

export interface InternationalPhoneFormlyFieldConfig extends DbNgxInternationalPhoneFieldConfig, FormlyFieldConfig { }

export const DEFAULT_PREFERRED_COUNTRIES = ['us'];

@Component({
  templateUrl: 'phone.field.component.html',
  // TODO: styleUrls: ['./phone.scss']
})
export class DbNgxInternationalPhoneFieldComponent extends FieldType<InternationalPhoneFormlyFieldConfig> {

  get label(): string {
    return this.field.templateOptions.label;
  }

  get placeholder(): string {
    return this.field.templateOptions.placeholder;
  }

  get description(): string {
    return this.field.templateOptions.description;
  }

  get preferredCountries(): string[] {
    return this.field.preferredCountries ?? DEFAULT_PREFERRED_COUNTRIES;
  }

  get onlyCountries(): string[] {
    return this.field.onlyCountries ?? [];
  }

  get required(): boolean {
    return this.field.templateOptions.required;
  }

  get errors(): ValidationErrors {
    return this.field.formControl.errors;
  }

}
