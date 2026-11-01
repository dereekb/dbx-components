import { type Maybe, websiteDomainAndPathPair } from '@dereekb/util';

/**
 * Matches a `scheme://` URL.
 */
const OPENROUTER_TEMPLATE_SCHEME_URL_REGEX = /\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"'`]+/gi;

/**
 * Matches a `www.` host and anything after it.
 */
const OPENROUTER_TEMPLATE_WWW_URL_REGEX = /\bwww\.[^\s<>"'`]+/gi;

/**
 * Matches a bare `name.tld` host with an optional path, which also catches the domain of an email address.
 */
const OPENROUTER_TEMPLATE_BARE_DOMAIN_REGEX = /\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b(?:[/:?#][^\s<>"'`]*)?/gi;

/**
 * Matches the scheme prefix of a URL.
 */
const OPENROUTER_TEMPLATE_SCHEME_PREFIX_REGEX = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Config for {@link checkOpenRouterTemplateOutputText}.
 */
export interface CheckOpenRouterTemplateOutputTextConfig {
  /**
   * The message text, as rendered by a script or written by a model.
   */
  readonly text: string;
  /**
   * The longest the trimmed text may be.
   */
  readonly maxLength: number;
  /**
   * The domains a URL may point at. When unset or empty, the text may carry no URL at all.
   */
  readonly allowedUrlDomains?: Maybe<string[]>;
}

/**
 * The result of {@link checkOpenRouterTemplateOutputText}.
 */
export interface OpenRouterTemplateOutputTextCheck {
  /**
   * Whether the text passed every check.
   */
  readonly valid: boolean;
  /**
   * The trimmed text. This is the text to send.
   */
  readonly text: string;
  /**
   * Every problem found.
   */
  readonly errors: string[];
  /**
   * Every host found in the text.
   */
  readonly hosts: string[];
  /**
   * The hosts that are not on an allowed domain.
   */
  readonly disallowedHosts: string[];
}

/**
 * Reads a host out of a URL-ish token: drops the scheme, the path, the query, the fragment, any user info and the port.
 *
 * @param token - The URL-ish token.
 * @returns The lower-cased host.
 */
export function openRouterTemplateUrlHost(token: string): string {
  const withoutScheme = token.replace(OPENROUTER_TEMPLATE_SCHEME_PREFIX_REGEX, '');
  let host = websiteDomainAndPathPair(withoutScheme).domain;
  host = host.split(/[?#]/)[0];
  host = host.slice(host.lastIndexOf('@') + 1);
  host = host.split(':')[0];
  return host.replace(/\.+$/, '').toLowerCase();
}

/**
 * Returns every host a text links to.
 *
 * Errs on the side of flagging: `scheme://` URLs, `www.` hosts and bare `name.tld[/…]` tokens (which include the domain of
 * an email address) all count.
 *
 * Meant for bounded text: {@link checkOpenRouterTemplateOutputText} only scans text that is within its length limit.
 *
 * @param text - The text to scan.
 * @returns The distinct lower-cased hosts, in the order found.
 */
export function findOpenRouterTemplateUrlHosts(text: string): string[] {
  const hosts = new Set<string>();

  [OPENROUTER_TEMPLATE_SCHEME_URL_REGEX, OPENROUTER_TEMPLATE_WWW_URL_REGEX, OPENROUTER_TEMPLATE_BARE_DOMAIN_REGEX].forEach((regex) => {
    for (const match of text.matchAll(regex)) {
      const host = openRouterTemplateUrlHost(match[0]);

      if (host) {
        hosts.add(host);
      }
    }
  });

  return Array.from(hosts);
}

/**
 * Whether a host is on one of the allowed domains: it equals the domain, or is a subdomain of it. A host that merely starts
 * with an allowed domain (`hellosubs.co.evil.com`) is not.
 *
 * @param host - The host to test.
 * @param allowedUrlDomains - The allowed domains.
 * @returns True when the host is allowed.
 */
export function isOpenRouterTemplateUrlHostAllowed(host: string, allowedUrlDomains: Maybe<string[]>): boolean {
  const normalizedHost = host.replace(/\.+$/, '').toLowerCase();

  return (allowedUrlDomains ?? []).some((domain) => {
    const normalizedDomain = domain
      .trim()
      .replaceAll(/^\.+|\.+$/g, '')
      .toLowerCase();
    return normalizedDomain !== '' && (normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`));
  });
}

/**
 * Checks a rendered message text against its type's output rules. Script text and model-written text get the same checks.
 *
 * - The text is trimmed, and must be non-empty and no longer than `maxLength`.
 * - Every URL in it must be on an allowed domain. Only text within the length limit is scanned. See {@link findOpenRouterTemplateUrlHosts} and
 *   {@link isOpenRouterTemplateUrlHostAllowed}.
 *
 * @param config - The text and the rules.
 * @returns Whether it passed, the trimmed text, the problems and the hosts found.
 */
export function checkOpenRouterTemplateOutputText(config: CheckOpenRouterTemplateOutputTextConfig): OpenRouterTemplateOutputTextCheck {
  const { maxLength, allowedUrlDomains } = config;
  const text = (config.text ?? '').trim();
  const errors: string[] = [];

  if (text === '') {
    errors.push('The message text is empty.');
  } else if (text.length > maxLength) {
    errors.push(`The message text is ${text.length} characters long, over the limit of ${maxLength}.`);
  }

  // Text over the limit is already refused, so the scan stays bounded by maxLength.
  const hosts = text.length <= maxLength ? findOpenRouterTemplateUrlHosts(text) : [];
  const disallowedHosts = hosts.filter((x) => !isOpenRouterTemplateUrlHostAllowed(x, allowedUrlDomains));

  if (disallowedHosts.length > 0) {
    const hostList = disallowedHosts.map((x) => '"' + x + '"').join(', ');
    errors.push(`The message text links to ${hostList}, which ${disallowedHosts.length === 1 ? 'is' : 'are'} not on an allowed domain.`);
  }

  return { valid: errors.length === 0, text, errors, hosts, disallowedHosts };
}

/**
 * Checks the OpenRouter input a body hands off against the type's `maxOpenRouterInputLength`.
 *
 * @param input - The input.
 * @param maxLength - The limit. No limit when unset.
 * @returns The problem, or undefined when the input is within the limit.
 */
export function checkOpenRouterTemplateOpenRouterInput(input: string, maxLength: Maybe<number>): Maybe<string> {
  return maxLength != null && input.length > maxLength ? `The OpenRouter input is ${input.length} characters long, over the limit of ${maxLength}.` : undefined;
}
