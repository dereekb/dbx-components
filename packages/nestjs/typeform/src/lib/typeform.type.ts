import { DollarAmount, EmailAddress, ISO8601DayString, Maybe, MaybeSo, PhoneNumber, WebsiteUrl, WebsiteUrlWithPrefix } from '@dereekb/util';
import { createClient } from '@typeform/api-client';

/**
 * Client created by createClient
 */
export type TypeformClient = ReturnType<typeof createClient>;

/**
 * Options for createClient
 */
export type TypeformClientOptions = MaybeSo<Parameters<typeof createClient>[0]> & {
  readonly apiBaseUrl?: WebsiteUrl;
};

/**
 * Api token used by Typeform for making requests.
 */
export type TypeformApiToken = string;

/**
 * Webhook secret used by Typeform for validating webhook events.
 */
export type TypeformWebhookSecretToken = string;

/**
 * Typeform Response data
 */
export type TypeformResponse = Awaited<ReturnType<TypeformClient['responses']['list']>>['items'][0];

/**
 * Typeform form identifier
 */
export type TypeformFormId = string;

/**
 * Typeform form name
 */
export type TypeformFormName = string;

/**
 * Used for identifying a specific response to a form.
 */
export type TypeformFormResponseToken = string;

/**
 * Details about a form response that are hidden from the user.
 */
export interface TypeformFormHiddenMetadata {
  readonly email: EmailAddress;
  readonly lastname: string;
  readonly source: string;
  readonly utm_campaign: string;
  readonly utm_medium: string;
  readonly utm_source: string;
}

export interface TypeformFormResponseDefinition extends MaybeSo<TypeformResponse['definition']> {
  readonly id: TypeformFormId;
  readonly title: TypeformFormName;
  readonly endings: TypeformFormResponseDefinitionEnding[];
  readonly settings: TypeformFormResponseDefinitionSettings;
}

export interface TypeformFormResponseDefinitionEnding {
  readonly id: string;
  readonly ref?: string;
  readonly title: string;
  readonly type: string;
  readonly properties: {
    readonly redirect_url?: Maybe<string>;
    readonly button_text?: string;
    readonly show_button?: boolean;
    readonly share_icons?: boolean;
    readonly button_mode?: string;
  };
}

export interface TypeformFormResponseDefinitionSettings {
  readonly partial_responses_to_all_integrations: boolean;
}

export type TypeformFormResponseAnswer = TypeformFormTextAnswer | TypeformFormEmailAnswer | TypeformFormPhoneNumberAnswer | TypeformFormDateAnswer | TypeformFormNumberAnswer | TypeformFormBooleanAnswer | TypeformFormMultipleChoicesAnswer | TypeformFormChoiceAnswer | TypeformFormUrlAnswer | TypeformFormPaymentAnswer | TypeformFormFileUrlAnswer;

export type TypeformFormAnswerFieldType = 'rating' | 'opinion_scale' | 'number' | 'phone_number' | 'ranking' | 'short_text' | 'long_text' | 'dropdown' | 'multiple_choice' | 'picture_choice' | 'email' | 'date' | 'legal' | 'yes_no' | 'website' | 'calendly' | 'file_upload' | 'payment';

export interface TypeformFormAnswerField<T extends TypeformFormAnswerFieldType = TypeformFormAnswerFieldType> {
  readonly id: string;
  readonly type: T;
  readonly ref?: string;
}

export interface TypeformFormAnswerFieldRef<T extends TypeformFormAnswerFieldType = TypeformFormAnswerFieldType> {
  readonly field: TypeformFormAnswerField<T>;
}

export interface TypeformFormNumberAnswer extends TypeformFormAnswerFieldRef<'number' | 'rating' | 'opinion_scale'> {
  readonly type: 'number';
  readonly number: number;
}

export interface TypeformFormBooleanAnswer extends TypeformFormAnswerFieldRef<'yes_no'> {
  readonly type: 'boolean';
  readonly boolean: boolean;
}

export interface TypeformFormTextAnswer extends TypeformFormAnswerFieldRef<'short_text' | 'long_text'> {
  readonly type: 'text';
  readonly text: string;
}

export interface TypeformFormEmailAnswer extends TypeformFormAnswerFieldRef<'email'> {
  readonly type: 'email';
  readonly email: EmailAddress;
}

export interface TypeformFormPhoneNumberAnswer extends TypeformFormAnswerFieldRef<'phone_number'> {
  readonly type: 'phone_number';
  readonly phone_number: PhoneNumber;
}

export interface TypeformFormDateAnswer extends TypeformFormAnswerFieldRef<'date'> {
  readonly type: 'date';
  readonly date: ISO8601DayString;
}

/**
 * Selected choice value on a choice answer.
 */
export type TypeformFormChoiceAnswerChoiceLabel = string;
export type TypeformFormChoiceAnswerFieldTypes = 'dropdown' | 'multiple_choice' | 'picture_choice' | 'ranking';

export interface TypeformFormChoiceAnswer<T extends TypeformFormChoiceAnswerChoiceLabel = TypeformFormChoiceAnswerChoiceLabel> extends TypeformFormAnswerFieldRef<TypeformFormChoiceAnswerFieldTypes> {
  readonly type: 'choice';
  readonly choice: {
    readonly id?: string;
    readonly label?: T;
    readonly ref?: string;
    /**
     * Alternative value if label is not chosen.
     */
    readonly other?: string;
  };
}

export interface TypeformFormMultipleChoicesAnswer<T extends TypeformFormChoiceAnswerChoiceLabel = TypeformFormChoiceAnswerChoiceLabel> extends TypeformFormAnswerFieldRef<TypeformFormChoiceAnswerFieldTypes> {
  readonly type: 'choices';
  readonly choices: {
    readonly ids: string[];
    readonly labels: T[];
    readonly refs: string[];
    /**
     * Alternative value if label(s) are not chosen.
     */
    readonly other?: string;
  };
}

export interface TypeformFormUrlAnswer extends TypeformFormAnswerFieldRef<'website' | 'calendly'> {
  readonly type: 'url';
  readonly url: string;
}

/**
 * String that links to the file download url.
 *
 * Typically in the format of:
 *
 * https://api.typeform.com/responses/files/{file_id}/{file_name}
 */
export type TypeformFormFileUrlString = WebsiteUrlWithPrefix;

export interface TypeformFormFileUrlAnswer extends TypeformFormAnswerFieldRef<'file_upload'> {
  readonly type: 'file_url';
  readonly file_url: TypeformFormFileUrlString;
}

export interface TypeformFormPaymentAnswer extends TypeformFormAnswerFieldRef<'payment'> {
  readonly type: 'payment';
  readonly payment: {
    readonly amount: DollarAmount;
    readonly last4: string;
    readonly name: string;
    readonly success: boolean;
  };
}
