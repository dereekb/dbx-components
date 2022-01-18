import {
    Directive, Input, OnInit, AfterContentInit,
    OnDestroy, Inject, Host, Optional
} from '@angular/core';
import { BehaviorSubject, Subscription, Observable } from 'rxjs';

import { FormGroup, AbstractControl } from '@angular/forms';

import { FormErrors, FormGroupComponent } from './form.component';
import { ThemePalette } from '@angular/material/core';
import { SubscriptionObject } from '@dereekb/ngx-core';

@Directive({
    selector: '[dbxFormGroupErrors]'
})
export class DbNgxFormGroupErrorsDirective implements OnDestroy {

    private _errorsSubject = new BehaviorSubject<FormErrors>({});
    private _sub = new SubscriptionObject();

    constructor(@Optional() @Host() formGroupComponent: FormGroupComponent) {
        if (formGroupComponent) {
            this.appFormGroupErrors = formGroupComponent.controlErrorsObs;
        }
    }

    ngOnDestroy(): void {
        this._errorsSubject.complete();
        this._sub.destroy();
    }

    public get formErrors(): Observable<FormErrors> {
        return this._errorsSubject;
    }

    @Input()
    public set appFormGroupErrors(error: Observable<FormErrors>) {
        this._sub.subscription = error.subscribe((e) => {
            this._errorsSubject.next(e);
        });
    }

}

/**
 * Abstract form control component.
 */
@Directive()
export abstract class AbstractFormControlDirective {

    @Input()
    public color: ThemePalette;

    @Input()
    public required = false;

    @Input()
    public disabled = false;

    @Input()
    public field: string;

    @Input()
    public hint: string;

    @Input()
    public ariaLabel: string;

    private _placeholder?: string;

    @Input()
    public get placeholder(): string {
        return (this._placeholder || this.field);
    }

    public set placeholder(placeholder: string) {
        this._placeholder = placeholder;
    }

}

@Directive()
export abstract class AbstractExtendedFormControlDirective extends AbstractFormControlDirective implements AfterContentInit, OnDestroy {

    @Input()
    public form: FormGroup;

    public error?: string;

    private _errorSub = new SubscriptionObject();

    constructor(@Optional() @Inject(DbNgxFormGroupErrorsDirective) private _errors: DbNgxFormGroupErrorsDirective) {
        super();
    }

    ngAfterContentInit(): void {
        if (this._errors) {
            this._errorSub.subscription = this._errors.formErrors.subscribe((errors) => {
                const error = errors[this.field];
                this.error = (error && error.length > 0) ? error : undefined;
            });
        }
    }

    ngOnDestroy(): void {
        this._errorSub.destroy();
    }

    public get formControl(): AbstractControl {
        return this.form.get(this.field);
    }

    public get hasError(): boolean {
        return this.error !== undefined;
    }

    public get hintMsg(): string | undefined {
        return this.error || this.hint;
    }

    public get isListeningToErrors(): boolean {
        return this._errorSub.hasSubscription;
    }

}

