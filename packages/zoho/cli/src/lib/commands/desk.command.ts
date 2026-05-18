import type { CommandModule, Argv } from 'yargs';
import { noop } from '@dereekb/util';
import { DESK_TICKETS_COMMAND } from './desk/desk.tickets.command';
import { DESK_DEPARTMENTS_COMMAND } from './desk/desk.departments.command';
import { DESK_CONTACTS_COMMAND } from './desk/desk.contacts.command';
import { DESK_AGENTS_COMMAND } from './desk/desk.agents.command';
import { DESK_TAGS_COMMAND } from './desk/desk.tags.command';
import { DESK_COMMENTS_COMMAND } from './desk/desk.comments.command';
import { DESK_ATTACHMENTS_COMMAND } from './desk/desk.attachments.command';
import { DESK_FOLLOWERS_COMMAND } from './desk/desk.followers.command';
import { DESK_TIME_COMMAND } from './desk/desk.time.command';
import { DESK_THREADS_COMMAND } from './desk/desk.threads.command';
import { DESK_ACTIVITIES_COMMAND } from './desk/desk.activities.command';

export const DESK_COMMAND: CommandModule = {
  command: 'desk',
  describe: 'Zoho Desk operations',
  builder: (yargs: Argv) =>
    yargs
      .command(DESK_TICKETS_COMMAND)
      .command(DESK_DEPARTMENTS_COMMAND)
      .command(DESK_CONTACTS_COMMAND)
      .command(DESK_AGENTS_COMMAND)
      .command(DESK_TAGS_COMMAND)
      .command(DESK_COMMENTS_COMMAND)
      .command(DESK_ATTACHMENTS_COMMAND)
      .command(DESK_FOLLOWERS_COMMAND)
      .command(DESK_TIME_COMMAND)
      .command(DESK_THREADS_COMMAND)
      .command(DESK_ACTIVITIES_COMMAND)
      .demandCommand(1, 'Please specify a desk subcommand.')
      .example([
        ['$0 desk tickets list --limit 10', 'List first 10 tickets'],
        ['$0 desk tickets get 12345', 'Get a ticket by ID'],
        ['$0 desk agents my-info', 'Get current agent info'],
        ['$0 desk comments create 12345 --content "Looking into this"', 'Add a comment']
      ]),
  handler: noop
};
