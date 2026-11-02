/**
 * `@dereekb/openrouter/template` — the message template core, loadable WITHOUT evaluating `@openrouter/sdk`.
 *
 * A message template renders a message string from a typed context. Its type is registered in code, and its body is either
 * a code render function or an uploaded script. This entry carries everything a template is DECLARED, VALIDATED and RUN
 * with, and nothing that calls a model:
 *
 * - the vocabulary — modes, body results and their classification;
 * - the type config, its registry, and the field walker that reads a type's declared names and paths;
 * - the script validator (the security boundary for uploaded scripts) and the runner that compiles a validated script;
 * - the context factory and builder, which hand a script deep-frozen, plain-data copies of the template data and each
 *   accessor's result — never validated or stripped, so an accessor returns only what scripts may read;
 * - the output checks (length and URL domains);
 * - the review prompt definition and its verdict reader.
 *
 * Model calls, approval signing and the stored-template service live in `@dereekb/openrouter/firebase-server`.
 *
 * Everything here is ALSO exported from the root entry, from the same modules, so there is one chunk and one class identity.
 */
export * from './lib/openrouter.template';
export * from './lib/openrouter.template.context';
export * from './lib/openrouter.template.output';
export * from './lib/openrouter.template.review';
export * from './lib/openrouter.template.script';
export * from './lib/openrouter.template.script.run';
export * from './lib/openrouter.template.type';
