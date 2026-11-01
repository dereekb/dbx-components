import { type OpenRouterTemplateLoader, type OpenRouterTemplateTypeConfig, type OpenRouterTemplateTypeKey, OpenRouterTemplateMode, openRouterTemplateType } from '@dereekb/openrouter';
import { type } from 'arktype';

/**
 * The only domain a demo message template may link to.
 */
export const DEMO_TEMPLATE_ALLOWED_URL_DOMAIN = 'demo.dereekb.com';

/**
 * The longest demo template text: three SMS segments of GSM-7 text.
 */
export const DEMO_TEMPLATE_MAX_LENGTH = 480;

/**
 * The input of the demo profile template types: the profile the message is about.
 */
export const demoProfileTemplateInputType = type({ profileKey: 'string' });

export type DemoProfileTemplateInput = typeof demoProfileTemplateInputType.infer;

/**
 * The profile data a demo template may load.
 */
export const demoProfileTemplateProfileType = type({ username: 'string', 'bio?': 'string' });

export type DemoProfileTemplateProfile = typeof demoProfileTemplateProfileType.infer;

/**
 * Loads the profile for a demo template. Provided by the server, since only it can read the profile.
 */
export type DemoProfileTemplateLoadProfileFunction = (input: DemoProfileTemplateInput) => Promise<DemoProfileTemplateProfile>;

/**
 * The loaders of the demo profile template types.
 */
export interface DemoProfileTemplateLoaders {
  readonly [key: string]: OpenRouterTemplateLoader<DemoProfileTemplateInput>;
  readonly loadProfile: OpenRouterTemplateLoader<DemoProfileTemplateInput>;
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
 * @param loadProfile - Loads the profile named by the input.
 * @returns The type config.
 */
export function demoProfileTextTemplateType(loadProfile: DemoProfileTemplateLoadProfileFunction): OpenRouterTemplateTypeConfig<DemoProfileTemplateInput, DemoProfileTemplateLoaders> {
  return openRouterTemplateType<DemoProfileTemplateInput, DemoProfileTemplateLoaders>({
    type: DEMO_PROFILE_TEXT_TEMPLATE_TYPE,
    name: 'Demo Profile Text',
    purpose: 'Tells a user something about their own demo profile, such as their username or bio.',
    mode: OpenRouterTemplateMode.DETERMINISTIC,
    input: demoProfileTemplateInputType,
    loaders: { loadProfile: { output: demoProfileTemplateProfileType, load: loadProfile } },
    output: { maxLength: DEMO_TEMPLATE_MAX_LENGTH, allowedUrlDomains: [DEMO_TEMPLATE_ALLOWED_URL_DOMAIN] },
    samples: { input: { profileKey: 'pr/sample' }, loaders: { loadProfile: DEMO_PROFILE_TEMPLATE_SAMPLE_PROFILE } }
  });
}

// MARK: Profile Announcement Text
/**
 * A DETERMINISTIC_OR_OPENROUTER type that announces something about a profile to everyone following it.
 *
 * It allows multiple recipients, so its loader returns only the public username, which every recipient may see. The script
 * either returns the text itself or hands the model a prompt input, and an optional final script formats the model output.
 */
export const DEMO_PROFILE_ANNOUNCEMENT_TEXT_TEMPLATE_TYPE: OpenRouterTemplateTypeKey = 'demo-profile-announcement-text';

/**
 * Creates the {@link DEMO_PROFILE_ANNOUNCEMENT_TEXT_TEMPLATE_TYPE} type config.
 *
 * @param loadProfile - Loads the profile named by the input. Only its username is kept, since every recipient sees the text.
 * @returns The type config.
 */
export function demoProfileAnnouncementTextTemplateType(loadProfile: DemoProfileTemplateLoadProfileFunction): OpenRouterTemplateTypeConfig<DemoProfileTemplateInput, DemoProfileTemplateLoaders> {
  return openRouterTemplateType<DemoProfileTemplateInput, DemoProfileTemplateLoaders>({
    type: DEMO_PROFILE_ANNOUNCEMENT_TEXT_TEMPLATE_TYPE,
    name: 'Demo Profile Announcement Text',
    purpose: 'Announces news about a demo profile to everyone following it.',
    mode: OpenRouterTemplateMode.DETERMINISTIC_OR_OPENROUTER,
    input: demoProfileTemplateInputType,
    loaders: {
      loadProfile: {
        output: type({ username: 'string' }),
        load: async (input: DemoProfileTemplateInput) => {
          const { username } = await loadProfile(input);
          return { username };
        }
      }
    },
    output: { maxLength: DEMO_TEMPLATE_MAX_LENGTH, allowedUrlDomains: [DEMO_TEMPLATE_ALLOWED_URL_DOMAIN], maxOpenRouterInputLength: 2000 },
    allowMultipleRecipients: true,
    finalScript: 'optional',
    samples: { input: { profileKey: 'pr/sample' }, loaders: { loadProfile: { username: DEMO_PROFILE_TEMPLATE_SAMPLE_PROFILE.username } }, output: { text: 'Sample model text.' } }
  });
}

// MARK: All Types
/**
 * Creates every demo template type config.
 *
 * @param loadProfile - Loads the profile named by a template input.
 * @returns The type configs, for `openRouterTemplateTypeConfigRecord`.
 */
export function demoOpenRouterTemplateTypes(loadProfile: DemoProfileTemplateLoadProfileFunction): OpenRouterTemplateTypeConfig[] {
  return [demoProfileTextTemplateType(loadProfile), demoProfileAnnouncementTextTemplateType(loadProfile)] as OpenRouterTemplateTypeConfig[];
}
