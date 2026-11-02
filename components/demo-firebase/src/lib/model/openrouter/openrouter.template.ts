import { type OpenRouterTemplateContextFactory, type OpenRouterTemplateContextSource, type OpenRouterTemplateTypeConfig, type OpenRouterTemplateTypeKey, OpenRouterTemplateMode, openRouterTemplateContextFactory, openRouterTemplateType } from '@dereekb/openrouter';
import { type Maybe, type ModelKey } from '@dereekb/util';

/**
 * The only domain a demo message template may link to.
 */
export const DEMO_TEMPLATE_ALLOWED_URL_DOMAIN = 'demo.dereekb.com';

/**
 * The longest demo template text. 480 characters of GSM-7 text send as four SMS segments, since each segment of a split
 * message holds 153 characters (`SMS_GSM7_MULTI_SEGMENT_LENGTH`).
 */
export const DEMO_TEMPLATE_MAX_LENGTH = 480;

/**
 * The data of the demo profile template types: the profile the message is about.
 *
 * Stored on the notification and not shape-checked at runtime, so the accessors check what they use.
 */
export interface DemoProfileTemplateData {
  readonly profileKey: ModelKey;
}

/**
 * The profile data a demo template may see.
 */
export interface DemoProfileTemplateProfile {
  readonly username: string;
  readonly bio?: Maybe<string>;
}

/**
 * The public part of a profile, which every recipient of a group message may see.
 */
export interface DemoPublicProfileTemplateProfile {
  readonly username: string;
}

/**
 * The accessor results of {@link demoProfileTemplateContextFactory}.
 */
export interface DemoProfileTemplateAccessorResults {
  readonly profile: DemoProfileTemplateProfile;
}

/**
 * The accessor results of {@link demoPublicProfileTemplateContextFactory}.
 */
export interface DemoPublicProfileTemplateAccessorResults {
  readonly profile: DemoPublicProfileTemplateProfile;
}

/**
 * Loads the profile for a demo template. Provided by the server, since only it can read the profile.
 */
export type DemoProfileTemplateLoadProfileFunction = (data: DemoProfileTemplateData) => Promise<DemoProfileTemplateProfile>;

/**
 * Creates the context factory of a single-recipient profile template: `context.accessor.profile()` returns the full profile.
 *
 * @param loadProfile - Loads the profile named by the template data.
 * @returns The context factory.
 */
export function demoProfileTemplateContextFactory(loadProfile: DemoProfileTemplateLoadProfileFunction): OpenRouterTemplateContextFactory<DemoProfileTemplateData, DemoProfileTemplateAccessorResults> {
  return openRouterTemplateContextFactory({
    accessors: {
      profile: ({ data }: OpenRouterTemplateContextSource<DemoProfileTemplateData>) => loadProfile(data)
    }
  });
}

/**
 * Creates the context factory of a group profile template: `context.accessor.profile()` returns only the public username,
 * since every recipient sees the text and nothing strips an accessor's extra fields.
 *
 * @param loadProfile - Loads the profile named by the template data.
 * @returns The context factory.
 */
export function demoPublicProfileTemplateContextFactory(loadProfile: DemoProfileTemplateLoadProfileFunction): OpenRouterTemplateContextFactory<DemoProfileTemplateData, DemoPublicProfileTemplateAccessorResults> {
  return openRouterTemplateContextFactory({
    accessors: {
      profile: async ({ data }: OpenRouterTemplateContextSource<DemoProfileTemplateData>) => {
        const { username } = await loadProfile(data);
        return { username };
      }
    }
  });
}

const DEMO_PROFILE_TEMPLATE_SAMPLE_PROFILE: DemoProfileTemplateProfile = { username: 'ana', bio: 'Teaches grade 3.' };

// MARK: Profile Text
/**
 * A DETERMINISTIC type that texts a user about their own profile. Single recipient: it loads the profile's bio.
 */
export const DEMO_PROFILE_TEXT_TEMPLATE_TYPE: OpenRouterTemplateTypeKey = 'demo-profile-text';

/**
 * Creates the {@link DEMO_PROFILE_TEXT_TEMPLATE_TYPE} type config.
 *
 * @param loadProfile - Loads the profile named by the template data.
 * @returns The type config.
 */
export function demoProfileTextTemplateType(loadProfile: DemoProfileTemplateLoadProfileFunction): OpenRouterTemplateTypeConfig<DemoProfileTemplateData, DemoProfileTemplateAccessorResults> {
  return openRouterTemplateType({
    type: DEMO_PROFILE_TEXT_TEMPLATE_TYPE,
    name: 'Demo Profile Text',
    purpose: 'Tells a user something about their own demo profile, such as their username or bio.',
    mode: OpenRouterTemplateMode.DETERMINISTIC,
    contextFactory: demoProfileTemplateContextFactory(loadProfile),
    output: { maxLength: DEMO_TEMPLATE_MAX_LENGTH, allowedUrlDomains: [DEMO_TEMPLATE_ALLOWED_URL_DOMAIN] },
    samples: { data: { profileKey: 'pr/sample' }, accessor: { profile: DEMO_PROFILE_TEMPLATE_SAMPLE_PROFILE } }
  });
}

// MARK: Profile Announcement Text
/**
 * A DETERMINISTIC_OR_OPENROUTER type that announces something about a profile to everyone following it.
 *
 * It allows multiple recipients, so its `profile` accessor returns only the public username, which every recipient may see. The script
 * either returns the text itself or hands the model a prompt input, and an optional final script formats the model output.
 */
export const DEMO_PROFILE_ANNOUNCEMENT_TEXT_TEMPLATE_TYPE: OpenRouterTemplateTypeKey = 'demo-profile-announcement-text';

/**
 * Creates the {@link DEMO_PROFILE_ANNOUNCEMENT_TEXT_TEMPLATE_TYPE} type config.
 *
 * @param loadProfile - Loads the profile named by the template data. Only its username is kept, since every recipient sees the text.
 * @returns The type config.
 */
export function demoProfileAnnouncementTextTemplateType(loadProfile: DemoProfileTemplateLoadProfileFunction): OpenRouterTemplateTypeConfig<DemoProfileTemplateData, DemoPublicProfileTemplateAccessorResults> {
  return openRouterTemplateType({
    type: DEMO_PROFILE_ANNOUNCEMENT_TEXT_TEMPLATE_TYPE,
    name: 'Demo Profile Announcement Text',
    purpose: 'Announces news about a demo profile to everyone following it.',
    mode: OpenRouterTemplateMode.DETERMINISTIC_OR_OPENROUTER,
    contextFactory: demoPublicProfileTemplateContextFactory(loadProfile),
    output: { maxLength: DEMO_TEMPLATE_MAX_LENGTH, allowedUrlDomains: [DEMO_TEMPLATE_ALLOWED_URL_DOMAIN], maxOpenRouterInputLength: 2000 },
    allowMultipleRecipients: true,
    finalScript: 'optional',
    samples: { data: { profileKey: 'pr/sample' }, accessor: { profile: { username: DEMO_PROFILE_TEMPLATE_SAMPLE_PROFILE.username } }, output: { text: 'Sample model text.' } }
  });
}

// MARK: All Types
/**
 * Creates every demo template type config.
 *
 * @param loadProfile - Loads the profile named by a template's data.
 * @returns The type configs, for `openRouterTemplateTypeConfigRecord`.
 */
export function demoOpenRouterTemplateTypes(loadProfile: DemoProfileTemplateLoadProfileFunction): OpenRouterTemplateTypeConfig[] {
  return [demoProfileTextTemplateType(loadProfile), demoProfileAnnouncementTextTemplateType(loadProfile)];
}
