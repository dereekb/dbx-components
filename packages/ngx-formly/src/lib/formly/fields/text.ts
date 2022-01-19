import { ADDRESS_ZIP_MAX_LENGTH } from './../../utility/constants.validation';
import { Validators } from '@angular/forms';
import { FormlyFieldConfig } from '@ngx-formly/core/lib/core';
import { ADDRESS_CITY_MAX_LENGTH, ADDRESS_COUNTRY_MAX_LENGTH, ADDRESS_STATE_MAX_LENGTH } from '../../utility/constants.validation';
import { formlyField } from './field';
import { FormlyAttributeEvent } from '@ngx-formly/core/lib/components/formly.field.config';

export function textField({ key, label = '', placeholder = '', required = false, attributes = null, minLength = undefined as number, maxLength = undefined as number, pattern = undefined as string | RegExp }): FormlyFieldConfig {
  return formlyField({
    key,
    type: 'input',
    templateOptions: {
      label,
      placeholder,
      required,
      attributes,
      minLength,
      maxLength,
      pattern
    }
  });
}

export function textAreaField({ key, label = '', placeholder = '', rows = 3, required = false, maxLength = 1000, attributes = null }): FormlyFieldConfig {
  return formlyField({
    key,
    type: 'textarea',
    templateOptions: {
      label,
      placeholder,
      required,
      rows,
      maxLength,
      attributes
    }
  });
}

export function opNameField({ key = 'name', label = 'Workspace Name', placeholder = 'My Workspace', required = false }): FormlyFieldConfig {
  return nameField({ key, label, placeholder, required });
}

export function nameField({ key = 'name', label = 'Name', placeholder = 'John Doe', required = false, minLength = undefined as number, maxLength = undefined as number }): FormlyFieldConfig {
  return textField({
    key,
    label,
    placeholder,
    required,
    minLength,
    maxLength
  });
}

export function emailField({ key = 'email', label = 'Email Address', description = '', required = false, readonly = false }): FormlyFieldConfig {
  return formlyField({
    key,
    type: 'input',
    templateOptions: {
      label,
      placeholder: 'client@opmore.com',
      description,
      required,
      readonly
    },
    validation: {
      messages: {
        required: `Email is required.`
      }
    },
    validators: {
      email: {
        expression: (c) => !Validators.email(c),
        message: () => `Not a valid email address.`
      }
    },
  });
}

export function phoneField({ key = 'phone', required = false }): FormlyFieldConfig {
  return formlyField({
    key,
    type: 'input',
    templateOptions: {
      label: 'Phone Number',
      placeholder: '',
      required,
      attributes: {
        autocomplete: 'tel'
      }
    }
  });
}

export function cityField({ key = 'city', required = false }): FormlyFieldConfig {
  return textField({
    key,
    label: 'City',
    placeholder: '',
    required,
    attributes: {
      autocomplete: 'city'
    },
    maxLength: ADDRESS_CITY_MAX_LENGTH
  });
}

export function stateField({ key = 'state', required = false }): FormlyFieldConfig {
  return textField({
    key,
    label: 'State',
    placeholder: '',
    required,
    attributes: {
      autocomplete: 'state'
    },
    maxLength: ADDRESS_STATE_MAX_LENGTH
  });
}

export function countryField({ key = 'country', required = false }): FormlyFieldConfig {
  return textField({
    key,
    label: 'Country',
    placeholder: '',
    required,
    attributes: {
      autocomplete: 'country'
    },
    maxLength: ADDRESS_COUNTRY_MAX_LENGTH
  });
}

export function zipCodeField({ key = 'zip', required = false }): FormlyFieldConfig {
  return textField({
    key,
    label: 'Zip Code',
    placeholder: '',
    required,
    attributes: {
      autocomplete: 'postal-code'
    },
    maxLength: ADDRESS_ZIP_MAX_LENGTH
  });
}

export function inviteCodeField({ key = 'code', required = false }): FormlyFieldConfig {
  return textField({
    key,
    label: 'Invite Code',
    required
  });
}
