import { convertParticipantToEmailParticipantString, convertEmailParticipantStringToParticipant, coerceToEmailParticipants, type EmailParticipant } from './email';

const TEST_EMAIL = 'john@example.com';

describe('convertParticipantToEmailParticipantString', () => {
  it('should format a participant with name and email', () => {
    const participant: EmailParticipant = { name: 'John Doe', email: TEST_EMAIL };
    const result = convertParticipantToEmailParticipantString(participant);
    expect(result).toBe('John Doe<john@example.com>');
  });

  it('should format a participant with only an email', () => {
    const participant: EmailParticipant = { email: TEST_EMAIL };
    const result = convertParticipantToEmailParticipantString(participant);
    expect(result).toBe('<john@example.com>');
  });

  it('should trim whitespace from the name', () => {
    const participant: EmailParticipant = { name: '  John  ', email: TEST_EMAIL };
    const result = convertParticipantToEmailParticipantString(participant);
    expect(result).toBe('John<john@example.com>');
  });
});

describe('convertEmailParticipantStringToParticipant', () => {
  it('should parse a participant string with name and email', () => {
    const result = convertEmailParticipantStringToParticipant('John Doe<john@example.com>');
    expect(result.name).toBe('John Doe');
    expect(result.email).toBe(TEST_EMAIL);
  });

  it('should parse a participant string with only an email', () => {
    const result = convertEmailParticipantStringToParticipant('<john@example.com>');
    expect(result.name).toBeUndefined();
    expect(result.email).toBe(TEST_EMAIL);
  });
});

describe('coerceToEmailParticipants', () => {
  it('should return participants as-is when no emails are provided', () => {
    const participants: EmailParticipant[] = [{ name: 'John', email: TEST_EMAIL }];
    const result = coerceToEmailParticipants({ participants });
    expect(result).toEqual(participants);
  });

  it('should convert emails to participants when no participants are provided', () => {
    const result = coerceToEmailParticipants({ emails: ['a@example.com', 'b@example.com'] });
    expect(result).toEqual([{ email: 'a@example.com' }, { email: 'b@example.com' }]);
  });

  it('should combine participants and emails without duplicating existing participant emails', () => {
    const participants: EmailParticipant[] = [{ name: 'John', email: TEST_EMAIL }];
    const emails = [TEST_EMAIL, 'jane@example.com'];
    const result = coerceToEmailParticipants({ participants, emails });

    expect(result.length).toBe(2);
    expect(result[0]).toEqual({ name: 'John', email: TEST_EMAIL });
    expect(result[1]).toEqual({ email: 'jane@example.com' });
  });

  it('should return an empty array when neither participants nor emails are provided', () => {
    const result = coerceToEmailParticipants({});
    expect(result).toEqual([]);
  });
});
