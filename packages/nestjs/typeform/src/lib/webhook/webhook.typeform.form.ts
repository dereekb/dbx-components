import { MaybeSo, Maybe, filterMaybeArrayValues, joinStringsWithCommas } from '@dereekb/util';
import { TypeformFormResponseDefinition, TypeformFormResponseAnswer, TypeformFormResponseDefinitionField, TypeformFormResponseDefinitionFieldId } from '../typeform.type';
import { TypeformWebhookFormResponse } from './webhook.typeform.type';
import { findTypeformTemplateRefsInString } from '../typeform.util';

export interface TypeformFormResponseAnswerValuePair<T = unknown> {
  /**
   * The answer as retrieved from the form response.
   */
  readonly answer: TypeformFormResponseAnswer;
  /**
   * Answer value as was retrieved
   */
  readonly value: T;
  /**
   * Answer value as a string
   */
  readonly valueString: string;
}

export interface TypeformFormQuestionAnswerPair<T = unknown> extends TypeformFormResponseAnswerValuePair<T> {
  /**
   * The expanded question title, which replaces all field references with the field's value.
   *
   * Provided only if the definition field exists.
   */
  readonly questionTitle?: Maybe<string>;
  /**
   * True if the original title had a field reference.
   */
  readonly hadReferenceInTitle: boolean;
  /**
   * Definition field, if it exists.
   */
  readonly definitionField?: TypeformFormResponseDefinitionField;
}

/**
 * An expanded TypeformWebhookFormResponse, containing the original form response and a list of TypeformFormQuestionAnswerPair.
 */
export interface ExpandedTypeformWebhookFormResponse {
  readonly formResponse: TypeformWebhookFormResponse;
  readonly pairs: TypeformFormQuestionAnswerPair[];
}

/**
 * Creates an ExpandedTypeformWebhookFormResponse from a TypeformWebhookFormResponse.
 */
export function expandTypeformWebhookFormResponse(formResponse: TypeformWebhookFormResponse): ExpandedTypeformWebhookFormResponse {
  const { answers, definition } = formResponse;
  const { fields = [] } = definition;

  const questionFieldMap = new Map<TypeformFormResponseDefinitionFieldId, TypeformFormResponseDefinitionField>(filterMaybeArrayValues(fields.map((x) => (x.id ? [x.id, x] : null))));

  const answerValuePairs = answers.map((answer) => makeTypeformFormResponseAnswerValuePair(answer));
  const answerValueFieldRefMap = new Map<TypeformFormResponseDefinitionFieldId, TypeformFormResponseAnswerValuePair>(filterMaybeArrayValues(answerValuePairs.map((x) => (x.answer.field.ref ? [x.answer.field.ref, x] : null))));

  function expandQuestionTitle(title: Maybe<string>): { questionTitle: Maybe<string>; hadReferenceInTitle: boolean } {
    let result: Maybe<string> = title;
    let hadReferenceInTitle = false;

    if (result) {
      const refsInTitle = findTypeformTemplateRefsInString(result);

      if (refsInTitle.length > 0) {
        hadReferenceInTitle = true;

        refsInTitle.forEach((refInTitle) => {
          const { match, ref } = refInTitle;
          const fullMatch = match;
          const answer = answerValueFieldRefMap.get(ref);
          const answerValue = answer?.valueString;

          const replacedTitle = (result as string).replaceAll(fullMatch, answerValue || '');
          result = replacedTitle;
        });
      }
    }

    return {
      questionTitle: result,
      hadReferenceInTitle
    };
  }

  const pairs: TypeformFormQuestionAnswerPair[] = answerValuePairs.map((answerValue) => {
    const definitionField = questionFieldMap.get(answerValue.answer.field.id);
    const { questionTitle, hadReferenceInTitle } = expandQuestionTitle(definitionField?.title);

    const result: TypeformFormQuestionAnswerPair = {
      ...answerValue,
      definitionField,
      questionTitle,
      hadReferenceInTitle
    };

    return result;
  });

  return {
    formResponse,
    pairs
  };
}

/**
 * Creates a TypeformFormQuestionAnswerPair from a TypeformFormResponseAnswer.
 */
export function makeTypeformFormResponseAnswerValuePair(answer: TypeformFormResponseAnswer): TypeformFormResponseAnswerValuePair {
  let value: any;
  let valueString: string;

  switch (answer.type) {
    case 'number':
      value = answer.number;
      valueString = answer.number.toString();
      break;
    case 'boolean':
      value = answer.boolean;
      valueString = answer.boolean.toString();
      break;
    case 'email':
      value = answer.email;
      valueString = answer.email;
      break;
    case 'phone_number':
      value = answer.phone_number;
      valueString = answer.phone_number;
      break;
    case 'date':
      value = answer.date;
      valueString = answer.date;
      break;
    case 'payment':
      value = answer.payment;
      valueString = answer.payment.amount.toString();
      break;
    case 'text':
      value = answer.text;
      valueString = answer.text;
      break;
    case 'choices':
      value = answer.choices;
      valueString = answer.choices.other || joinStringsWithCommas(answer.choices.labels);
      break;
    case 'choice':
      value = answer.choice;
      valueString = answer.choice.other || answer.choice.label || '';
      break;
    case 'url':
      value = answer.url;
      valueString = answer.url;
      break;
    case 'file_url':
      value = answer.file_url;
      valueString = answer.file_url;
      break;
  }

  const result: TypeformFormResponseAnswerValuePair = {
    answer,
    value,
    valueString
  };

  return result;
}
