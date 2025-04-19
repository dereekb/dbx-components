import { excludeValuesFromArray } from '../array';

/**
 * Type representing an email address as a string.
 */
export type EmailAddress = string;

/**
 * Interface representing a pair of a name and an email address.
 */
export interface NameEmailPair {
  name?: string;
  email: EmailAddress;
}

/**
 * Type representing an email participant with a name and email address.
 * Alias for NameEmailPair for semantic clarity in email-related contexts.
 */
export type EmailParticipant = NameEmailPair;

/**
 * Email participant string. Starts with the email, followed by the name if available.
 */
export type EmailParticipantString = string;

/**
 * Converts an EmailParticipant object to a formatted string representation.
 * The format is: "name<email>" or "<email>" if no name is provided.
 *
 * @param participant - The email participant to convert
 * @returns A formatted string representation of the participant
 */
export function convertParticipantToEmailParticipantString(participant: EmailParticipant): EmailParticipantString {
  return `${participant.name?.trim() ?? ''}<${participant.email}>`;
}

/**
 * Converts a formatted participant string into an EmailParticipant object.
 * Parses strings in the format "name<email>" or "<email>".
 *
 * @param participantString - The string to parse
 * @returns An EmailParticipant object with the extracted name and email
 */
export function convertEmailParticipantStringToParticipant(participantString: EmailParticipantString): EmailParticipant {
  const split = participantString.split('<');
  const name = split[0] || undefined;
  const email = split[1].substring(0, split[1].length - 1);
  return {
    name,
    email
  };
}

/**
 * Combines an array of EmailParticipants with an array of email addresses.
 * Email addresses that don't already exist in the participants array are converted to EmailParticipant objects.
 *
 * @param options - Object containing participants and/or emails arrays
 * @param options.participants - Array of existing EmailParticipant objects
 * @param options.emails - Array of email addresses to include
 * @returns A combined array of EmailParticipant objects
 */
export function coerceToEmailParticipants({ participants = [], emails = [] }: { participants?: EmailParticipant[]; emails?: EmailAddress[] }): EmailParticipant[] {
  if (!emails?.length) {
    return participants;
  } else {
    const participantEmails = participants?.map((x) => x.email) ?? [];
    const emailsWithoutParticipants = excludeValuesFromArray(emails, participantEmails);
    return participants.concat(emailsWithoutParticipants.map((email) => ({ email })));
  }
}
