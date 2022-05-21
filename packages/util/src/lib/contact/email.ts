import { excludeValuesFromArray } from "../array";

export type EmailAddress = string;

export interface NameEmailPair {
  name?: string;
  email: EmailAddress;
}

export type EmailParticipant = NameEmailPair;

/**
 * Email participant string. Starts with the email, followed by the name if available.
 */
export type EmailParticipantString = string;

export function convertParticipantToEmailParticipantString(participant: EmailParticipant): EmailParticipantString {
  return `${participant.name?.trim() ?? ''}<${participant.email}>`;
}

export function convertEmailParticipantStringToParticipant(participantString: EmailParticipantString): EmailParticipant {
  const split = participantString.split('<');
  const name = split[0] || undefined;
  const email = split[1].substring(0, split[1].length - 1);
  return {
    name,
    email
  };
}

export function coerceToEmailParticipants({ participants = [], emails = [] }: { participants?: EmailParticipant[], emails?: EmailAddress[] }): EmailParticipant[] {
  if (!emails?.length) {
    return participants;
  } else {
    const participantEmails = participants?.map(x => x.email) ?? [];
    const emailsWithoutParticipants = excludeValuesFromArray(emails, participantEmails);
    return participants.concat(emailsWithoutParticipants.map(email => ({ email })));
  }
}
