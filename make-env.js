/**
 * This is a stand-alone tool used to generate .env files for your deployments.
 *
 * The expected usage is:
 *
 * node make-env.js
 *
 * Be sure to put all environment variables that have secrets that need to be deployed into the .env file, or declare them below.
 */
const fs = require('fs');
const { parse, stringify } = require('envfile');

// NOTE: If run within nx, remember that nx adds all variables within .env to the environment and, thus, process.env.
// Variables that are within bash take prority.
const templateFilePath = '.env';
const templateEnv = fs.readFileSync(templateFilePath).toString();
const template = parse(templateEnv);

const env = {}; // this is the object that is parsed

const keysToIgnoreFromTemplate = ['PUT_YOUR_REAL_SECRETS_INTO_ENV_SECRET', 'THIS_FILE_IS_COMMITTED_TO_GITHUB']; // these keys are ignored
const keysToIgnore = new Set(keysToIgnoreFromTemplate);

Object.keys(template)
  .filter((x) => !keysToIgnore.has(x))
  .forEach((key) => (env[key] = ''));

function copyToEnvFromProcessEnv(key, defaultValue = '') {
  env[key] = process.env[key] || defaultValue;
}

function initWithProcessEnv(defaultValue, keysSource = env) {
  Object.keys(keysSource).forEach((key) => copyToEnvFromProcessEnv(key, defaultValue));
}

// ======================================
// Configure Here using JS
// ======================================
const placeholderValue = 'plc';

// Init with process.env, copying values from process.env onto the existing keys of our env variable
initWithProcessEnv(placeholderValue);

// Explicit Declaration
copyToEnvFromProcessEnv('MAILGUN_DOMAIN');

// ======================================
// Finish Configuration
// ======================================
console.log(stringify(env)); // output to console/stdout to allow piping.
