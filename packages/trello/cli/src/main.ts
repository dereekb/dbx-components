import { runTrelloCli } from './lib/cli';
import { TRELLO_CLI_PACKAGE_REFS } from './lib/docs/trello.docs';

/**
 * The stock `trello-cli` binary (`bin/index.js` of `@dereekb/trello`): the library's `runTrelloCli` with the package
 * refs embedded, so `trello-cli docs` works without reading the installed package.
 */
await runTrelloCli({ refs: TRELLO_CLI_PACKAGE_REFS });
