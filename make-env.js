/**
 * This is a stand-alone tool used to generate .env files for your deployments. It uses the .env file as a template from which to pull keys that need to be defined.
 *
 * The expected usage is:
 *
 * node make-env.js <specifier>
 *
 * Example:
 *
 * node make-env.js staging       // This will copy all values in the current environment using the keys in the root .env value, and also look for those keys with values with a .staging prefix.
 *
 * For example, if MAILGUN_DOMAIN is defined in .env, the program will look at both MAILGUN_DOMAIN.staging and MAILGUN_DOMAIN for a value
 *
 * MAILGUN_DOMAIN_staging=staging.components.dereekb.com
 * MAILGUN_API_KEY=todo
 */
const fs = require('fs');
const { parse, stringify } = require('envfile');

const specifier = process.argv[2] || 'test';

const envSpecifierType = new String(specifier).toUpperCase(); // Also use this to find variables. Always lowercase
const envSpecifierTypeLower = envSpecifierType.toLowerCase();
const envSpecifierSeparator = '_';

// NOTE: If run within nx, remember that nx adds all variables within .env to the environment and, thus, process.env.
// Variables that are within bash take prority.
const templateFilePath = '.env';
const templateEnv = fs.readFileSync(templateFilePath).toString();
const template = parse(templateEnv);

// Also attempt to read an overriding template file with the name .env.<environment>
// Any variables from here are not added to the template; they're just used for overriding variables in the template.
// They are the lowest level of defaults.
const specifierTemplateOverridesFilePath = `.env.${envSpecifierTypeLower}`;
let specifierTemplateOverrides = {};

if (fs.existsSync(specifierTemplateOverridesFilePath)) {
  const specifierTemplateOverridesEnv = fs.readFileSync(specifierTemplateOverridesFilePath).toString();
  specifierTemplateOverrides = parse(specifierTemplateOverridesEnv);
}

const env = {}; // this is the object that is exported

const keysToIgnoreFromTemplate = ['PUT_YOUR_REAL_SECRETS_INTO_ENV_SECRET', 'THIS_FILE_IS_COMMITTED_TO_GITHUB']; // these keys are ignored
const keysToIgnore = new Set(keysToIgnoreFromTemplate);

Object.keys(template)
  .filter((x) => !keysToIgnore.has(x))
  .forEach((key) => (env[key] = ''));

function copyToEnvFromProcessEnv(key, defaultValue = '') {
  const envSpecificKey = `${key}${envSpecifierSeparator}${envSpecifierType}`; // MY_ENV_VARIABLE_TEST
  const envSpecificKeyLower = `${key}${envSpecifierSeparator}${envSpecifierTypeLower}`; // MY_ENV_VARIABLE_test

  env[key] = process.env[envSpecificKey] || process.env[envSpecificKeyLower] || process.env[key] || specifierTemplateOverrides[key] || defaultValue;
}

function initWithProcessEnv(defaultValue, keysSource = env) {
  Object.keys(keysSource).forEach((key) => copyToEnvFromProcessEnv(key, defaultValue));
}

function assertHasNoPlaceholderValues(defaultValue, ignoreKeys = new Set()) {
  const keysWithPlaceholderValues = [];

  Object.keys(env)
    .filter((x) => !ignoreKeys.has(x))
    .forEach((key) => {
      const value = env[key];

      if (value === defaultValue) {
        keysWithPlaceholderValues.push(key);
      }
    });

  // throw error with all failed keys.
  if (keysWithPlaceholderValues.length) {
    throw new Error(`The ${keysWithPlaceholderValues.length} environment variable(s) ${keysWithPlaceholderValues.map((x) => `"${x}"`).join(', ')} each had a placeholder value set. Ensure each exists in the environment.`);
  }
}

// ======================================
// Configure Here using JS
// ======================================
const defaultPlaceholderValue = 'placeholder'; // This is the default value to use if an environment variable that is requested is not defined.
initWithProcessEnv(defaultPlaceholderValue); // Init with process.env, copying values from process.env onto the existing keys of our env variable

// Check there are no placeholder values remaining when targeting either staging or prod.
if (envSpecifierTypeLower === 'staging' || envSpecifierTypeLower === 'prod') {
  assertHasNoPlaceholderValues(defaultPlaceholderValue);
}

// Explicit Declaration
copyToEnvFromProcessEnv('MAILGUN_DOMAIN');

// ======================================
// Finish Configuration
// ======================================
console.log(stringify(env)); // output to console/stdout to allow piping.
