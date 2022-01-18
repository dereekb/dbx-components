import { OnDestroy, AfterContentInit, Provider, Type, Inject, ChangeDetectorRef, OnInit, Directive } from '@angular/core';

import { FormGroup, FormBuilder } from '@angular/forms';
import { Observable, Subscription, BehaviorSubject } from 'rxjs';
import { delay, debounceTime, startWith } from 'rxjs/operators';
import { SubscriptionObject } from '@dereekb/ngx-core';
import { DbNgxViewUtility } from '../utility';
import { LockSet } from '../utility/lock';

export enum FormComponentState {
    INITIALIZING = -1,
    INCOMPLETE = 0,
    COMPLETE = 1,
    RESET = 2
}

export interface FormErrors {
    [key: string]: string;
}

export interface ValidationMessages {
    [key: string]: string;
}

export interface ValidationMessagesSet {
    [key: string]: ValidationMessages;
}

export interface FormValidationErrors {
    [key: string]: FieldValidationError;
}

export interface FormGroupComponentErrors {
    formErrors: ValidationMessages;
    controlErrors: ValidationMessages;
}

export interface FormComponentEvent {
    readonly isComplete: boolean;
    readonly state: FormComponentState;
    readonly pristine?: boolean;
    readonly untouched?: boolean;
    readonly lastResetAt?: Date;
    readonly changesCount?: number;
}

export abstract class FormComponent {
    /**
     * LockSet the form may have exposed.
     */
    readonly lockSet?: LockSet;
    /**
     * True if the form is complete/valid.
     */
    readonly isComplete: boolean;
    readonly state: FormComponentState;
    readonly stream$: Observable<FormComponentEvent>;
    readonly value: any;
    abstract setValue(value: any): void;
    abstract resetForm(): void;
    abstract forceFormUpdate(): void;
}

export interface TypedFormComponent<T> extends FormComponent {
    readonly value: T;
    setValue(value: T): void;
    resetForm(): void;
}

export function ProvideFormComponent<S extends FormComponent>(sourceType: Type<S>): Provider[] {
    return [{ provide: FormComponent, useExisting: sourceType }];
}

export abstract class FormGroupComponent extends FormComponent {
    readonly controlErrorsObs: Observable<FormErrors>;
    readonly formErrorsObs: Observable<FormErrors>;
}

export function ProvideFormGroupComponent<S extends FormGroupComponent>(sourceType: Type<S>): Provider[] {
    return [...ProvideFormComponent(sourceType), { provide: FormGroupComponent, useExisting: sourceType }];
}

// MARK: Validation Errors
/**
 * @deprecated
 */
export enum FieldValidationErrorType {
    Field,
    FormGroup
}

/**
 * @deprecated
 */
export enum FieldValidationErrorChange {
    Set,
    Clear   // DEPRECATED
}

/**
 * @deprecated
 */
export class FieldValidationError {

    public errorKey?: string;
    public type = FieldValidationErrorType.Field;
    public makeDirty = false;

    static clearFieldError(): FieldValidationError {
        const config = new FieldValidationError();

        config.type = FieldValidationErrorType.Field;
        config.makeDirty = false;

        return config;
    }

    constructor() { }

}

// MARK: Component
/**
 * Base component that wraps a FormGroup and provides validation.
 * 
 * @deprecated Replaced by Formly.
 */
@Directive()
export abstract class AbstractFormGroupDirective implements FormGroupComponent, OnDestroy, OnInit, AfterContentInit {

    private _initialized = false;

    private _form: FormGroup;
    private _formSub = new SubscriptionObject();
    private _controlNames: string[];

    private _updatedSubject = new BehaviorSubject<FormComponentEvent>({ isComplete: false, state: FormComponentState.INITIALIZING });
    private _updatedObservable = this._updatedSubject.asObservable();

    protected debounce = 50;

    private _formErrors = new BehaviorSubject<FormErrors>({});
    private _controlErrors = new BehaviorSubject<FormErrors>({});

    protected validationMessages: ValidationMessagesSet = {};

    constructor(@Inject(FormBuilder) private _formBuilder: FormBuilder, @Inject(ChangeDetectorRef) protected readonly _cdRef: ChangeDetectorRef) { }

    ngOnInit(): void {
        this.resetFormGroup();
    }

    ngAfterContentInit(): void {
        this._initialize();
    }

    ngOnDestroy(): void {
        this._formSub.destroy();
        this._updatedSubject.complete();

        this._formErrors.complete();
        this._controlErrors.complete();
    }

    // MARK: External Accessors
    public get isComplete(): boolean {
        return this._form.valid;
    }

    public get isValid(): boolean {
        return this._form.valid;
    }

    public get formValue(): any {
        return this._form.value;
    }

    public get stream$(): Observable<FormComponentEvent> {
        return this._updatedObservable;
    }

    public get state(): FormComponentState {
        return this._updatedSubject.value.state;
    }

    setValue(value: any): void {
        if (value) {
            this._form.reset();

            this.controlNames.forEach((controlName) => {
                const newValue = value[controlName];
                if (newValue !== undefined) {
                    // newFormValue[controlName] = value[controlName];
                    this._form.get(controlName).setValue(newValue);
                }
            });
        } else {
            this.resetForm();
        }
    }

    resetForm(): void {
        this._form.reset();
        this._updatedSubject.next({ isComplete: false, state: FormComponentState.RESET });
    }

    // MARK: Internal Accessor
    public get formErrors(): FormErrors {
        return this._formErrors.value;
    }

    public get formErrorsObs(): Observable<FormErrors> {
        return this._formErrors;
    }

    public get controlErrors(): FormErrors {
        return this._controlErrors.value;
    }

    public get controlErrorsObs(): Observable<FormErrors> {
        return this._controlErrors;
    }

    protected get controlNames(): string[] {
        return this._controlNames;
    }

    public get form(): FormGroup {
        return this._form;
    }

    public get value(): any {
        return this.form.value;
    }

    protected setFormGroup(formGroup: FormGroup): void {
        this._form = formGroup;

        if (this._initialized) {
            this._bindToFormGroup();
        }
    }

    // MARK: Initialization
    protected resetFormGroup(): void {
        const formGroup = this.buildFormGroup(this._formBuilder);
        this.setFormGroup(formGroup);
    }

    protected abstract buildFormGroup(formBuilder: FormBuilder): FormGroup;

    protected get initialized(): boolean {
        return this._initialized;
    }

    private _initialize(): void {
        if (!this._initialized) {
            this.initialize();
        }
    }

    protected initialize(): void {
        this._bindToFormGroup();
        this._initialized = true;
    }

    protected _bindToFormGroup(): void {
        if (this._form) {
            this._controlNames = Object.keys(this._form.controls);
            this._formSub.subscription = this._form.valueChanges.pipe(
                debounceTime(this.debounce)
            ).subscribe((_) => this.updateForChange());

            // Update for change immediately.
            this.updateForChange();
        }
    }

    // MARK: Update
    public forceFormUpdate(): void {
        this.updateForChange();
    }

    protected updateForChange(): void {
        this.refreshValidation();
        this.next(this._nextUpdateEvent());
        DbNgxViewUtility.safeDetectChanges(this._cdRef);
    }

    protected next(event: FormComponentEvent): void {
        this._updatedSubject.next(event);
    }

    protected _nextUpdateEvent(): FormComponentEvent {
        const complete = this.isComplete;

        return {
            isComplete: complete,
            state: (complete) ? FormComponentState.COMPLETE : FormComponentState.INCOMPLETE
        };
    }

    // MARK: Validation
    protected refreshValidation(): void {
        const form = this._form;

        if (!form) { return; }

        const messages: FormGroupComponentErrors = {
            formErrors: {},
            controlErrors: {}
        };

        this.refreshFormGroupValidation(messages);
        this.refreshFormFieldValidation(messages);

        this._formErrors.next(messages.formErrors);
        this._controlErrors.next(messages.controlErrors);
    }

    private refreshFormGroupValidation(messages: FormGroupComponentErrors): void {
        const errors = this.form.errors || {};

        // Look through each of the current errors, and set the controls to be invalid.
        // Their messages will be set below.
        Object.keys(errors).forEach((errorName) => {
            const formValidationErrors: FormValidationErrors = errors[errorName];
            this._buildMessagesWithFormValidationErrors(errorName, formValidationErrors, messages);
        });
    }

    private _buildMessagesWithFormValidationErrors(errorName: string, formValidationErrors: FormValidationErrors, messages: FormGroupComponentErrors): void {
        Object.keys(formValidationErrors).forEach((control) => {
            // const control = this.form.get(control);
            const error: FieldValidationError = formValidationErrors[control];
            let errorMessages: ValidationMessages;

            if (!error) {
                return;
            }

            switch (error.type) {
                case FieldValidationErrorType.FormGroup:
                    errorMessages = messages.formErrors;
                    break;
                case FieldValidationErrorType.Field:
                default:
                    errorMessages = messages.controlErrors;

                    /*
                        if (error.makeDirty) {
                            control.markAsDirty(true);
                        }
                    */

                    break;
            }

            errorMessages[control] = this.validationMessages[control][error.errorKey || errorName];
        });
    }

    private refreshFormFieldValidation(messages: FormGroupComponentErrors): void {
        const controlErrorMessages: ValidationMessages = messages.controlErrors;

        this.controlNames.forEach((controlName) => {
            const control = this.form.get(controlName);

            if (control && control.dirty && !control.valid) {
                const controlValidationMessages = this.validationMessages[controlName];
                const controlErrors = control.errors;

                if (controlErrors && controlValidationMessages) {
                    for (const key in controlErrors) {
                        if (controlErrors[key] !== undefined) {
                            controlErrorMessages[controlName] = controlValidationMessages[key] || 'Unknown Error';    // Only show 1 error at a time.
                        }
                    }
                }
            }
        });
    }

}

/**
 * @deprecated
 */
@Directive()
export abstract class AbstractTypedFormGroupDirective<T> extends AbstractFormGroupDirective implements TypedFormComponent<T> {

    public get value(): T {
        return this.form.value;
    }

}
