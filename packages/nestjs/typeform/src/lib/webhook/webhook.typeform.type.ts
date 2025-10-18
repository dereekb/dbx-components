import { type ISO8601DateString } from '@dereekb/util';
import { type TypeformFormHiddenMetadata, type TypeformFormId, type TypeformFormResponseAnswer, type TypeformFormResponseDefinition, type TypeformFormResponseToken } from '../typeform.type';

export interface TypeformWebhookFormResponse {
  readonly form_id: TypeformFormId;
  readonly token: TypeformFormResponseToken;
  readonly landed_at: ISO8601DateString;
  readonly submitted_at: ISO8601DateString;
  readonly hidden: TypeformFormHiddenMetadata;
  readonly definition: TypeformFormResponseDefinition;
  readonly answers: TypeformFormResponseAnswer[];
}
