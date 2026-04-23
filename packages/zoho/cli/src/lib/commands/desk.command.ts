import type { CommandModule, Argv } from 'yargs';
import { noop } from '../util/noop';
import { deskTicketsCommand } from './desk/desk.tickets.command';
import { deskDepartmentsCommand } from './desk/desk.departments.command';
import { deskContactsCommand } from './desk/desk.contacts.command';
import { deskAgentsCommand } from './desk/desk.agents.command';
import { deskTagsCommand } from './desk/desk.tags.command';
import { deskCommentsCommand } from './desk/desk.comments.command';
import { deskAttachmentsCommand } from './desk/desk.attachments.command';
import { deskFollowersCommand } from './desk/desk.followers.command';
import { deskTimeCommand } from './desk/desk.time.command';
import { deskThreadsCommand } from './desk/desk.threads.command';
import { deskActivitiesCommand } from './desk/desk.activities.command';

export const deskCommand: CommandModule = {
  command: 'desk',
  describe: 'Zoho Desk operations',
  builder: (yargs: Argv) =>
    yargs
      .command(deskTicketsCommand)
      .command(deskDepartmentsCommand)
      .command(deskContactsCommand)
      .command(deskAgentsCommand)
      .command(deskTagsCommand)
      .command(deskCommentsCommand)
      .command(deskAttachmentsCommand)
      .command(deskFollowersCommand)
      .command(deskTimeCommand)
      .command(deskThreadsCommand)
      .command(deskActivitiesCommand)
      .demandCommand(1, 'Please specify a desk subcommand.')
      .example([
        ['$0 desk tickets list --limit 10', 'List first 10 tickets'],
        ['$0 desk tickets get 12345', 'Get a ticket by ID'],
        ['$0 desk agents my-info', 'Get current agent info'],
        ['$0 desk comments create 12345 --content "Looking into this"', 'Add a comment']
      ]),
  handler: noop
};
