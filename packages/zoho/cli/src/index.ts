import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { authCommand } from './lib/commands/auth.command';
import { doctorCommand } from './lib/commands/doctor.command';
import { recruitCommand } from './lib/commands/recruit.command';
import { crmCommand } from './lib/commands/crm.command';
import { deskCommand } from './lib/commands/desk.command';
import { requestCommand } from './lib/commands/request.command';
import { createAuthMiddleware } from './lib/middleware/auth.middleware';
import { outputError } from './lib/util/output';

async function main() {
  try {
    await yargs(hideBin(process.argv))
      .scriptName('zoho-cli')
      .usage('$0 <command> [options]')
      .option('verbose', {
        alias: 'v',
        type: 'boolean',
        default: false,
        global: true,
        describe: 'Verbose output'
      })
      .middleware([createAuthMiddleware()], true)
      .command(authCommand)
      .command(doctorCommand)
      .command(recruitCommand)
      .command(crmCommand)
      .command(deskCommand)
      .command(requestCommand)
      .demandCommand(1, 'Please specify a command. Use --help for available commands.')
      .strict()
      .fail(false)
      .help()
      .alias('help', 'h')
      .version(false)
      .wrap(Math.min(120, process.stdout.columns || 80))
      .parse();
  } catch (e) {
    outputError(e);
    process.exit(1);
  }
}

main();
