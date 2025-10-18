import { expandTypeformWebhookFormResponse } from './webhook.typeform.form';
import { type TypeformWebhookFormResponse } from './webhook.typeform.type';

describe('expandTypeformWebhookFormResponse', () => {
  it('should expand the form response and build the expected question titles', () => {
    const testFieldRef = '123456789';
    const testFieldAnswerValue = 'a';

    const formResponse: TypeformWebhookFormResponse = {
      answers: [
        {
          type: 'text',
          text: testFieldAnswerValue,
          field: {
            type: 'short_text',
            id: 'a',
            ref: testFieldRef
          }
        },
        {
          type: 'text',
          text: 'other',
          field: {
            type: 'short_text',
            id: 'b',
            ref: 'other'
          }
        }
      ],
      definition: {
        title: 'form title',
        fields: [
          {
            title: 'EXPECTED',
            id: 'a',
            type: 'short_text'
          },
          {
            title: `Describe {{field:${testFieldRef}}}?`,
            id: 'b',
            type: 'short_text'
          }
        ],
        id: '',
        endings: [],
        settings: {
          partial_responses_to_all_integrations: false
        }
      },
      form_id: '',
      token: '',
      landed_at: '',
      submitted_at: '',
      hidden: {
        email: 'test@example.com'
      }
    };

    const result = expandTypeformWebhookFormResponse(formResponse);

    expect(result).toBeDefined();
    expect(result.pairs.length).toBe(2);
    expect(result.pairs[0].questionTitle).toBe('EXPECTED');
    expect(result.pairs[0].hadReferenceInTitle).toBe(false);
    expect(result.pairs[1].questionTitle).toBe(`Describe ${testFieldAnswerValue}?`);
    expect(result.pairs[1].hadReferenceInTitle).toBe(true);
  });
});
