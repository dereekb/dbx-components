import { findUniqueCaseInsensitiveStrings, excludeValuesFromArray, unique, uniqueCaseInsensitiveStrings, hasNonNullValue, Maybe, filterMaybeValues } from "@dereekb/util";

export type EmailAddress = string;
export type EmailAddressDomain = string; // Domain name of an email address.

export interface NameEmailPair {
  name?: string;
  email: EmailAddress;
}

export interface EmailParticipant extends NameEmailPair { }

/**
 * Email participant string. Starts with the email, followed by the name if available.
 */
export type EmailParticipantString = string;

/**
 * Phone number string input. No format specified.
 */
export type PhoneNumber = string;

/**
 * E.164 Standardized Phone Number
 */
export type E164PhoneNumber = string;

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

export function readDomainsFromEmailAddresses(addresses: EmailAddress[]): EmailAddressDomain[] {
  return uniqueCaseInsensitiveStrings(addresses.map(readDomainFromEmailAddress));
}

export function readDomainFromEmailAddress(address: EmailAddress): EmailAddressDomain {
  const split = address.split('@');
  const domain = split[1];
  return domain.toLowerCase();
}
