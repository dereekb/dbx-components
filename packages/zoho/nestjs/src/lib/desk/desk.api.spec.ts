import { appZohoDeskModuleMetadata } from './desk.module';
import { type DynamicModule, Module } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ZohoDeskApi } from './desk.api';
import { fileZohoAccountsAccessTokenCacheService, ZohoAccountsAccessTokenCacheService } from '../accounts/accounts.service';
import { type ZohoDeskTicketId, type ZohoDeskDepartmentId, type ZohoDeskContactId } from '@dereekb/zoho';

const cacheService = fileZohoAccountsAccessTokenCacheService();

@Module(appZohoDeskModuleMetadata({}))
export class TestZohoDeskModule {}

describe('desk.api', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers = [
      {
        provide: ZohoAccountsAccessTokenCacheService,
        useValue: cacheService
      }
    ];

    const rootModule: DynamicModule = {
      module: TestZohoDeskModule,
      providers,
      exports: providers,
      global: true
    };

    const builder = Test.createTestingModule({
      imports: [rootModule]
    });

    nest = await builder.compile();
  });

  describe('ZohoDeskApi', () => {
    let api: ZohoDeskApi;

    beforeEach(() => {
      api = nest.get(ZohoDeskApi);
    });

    // MARK: Tickets
    describe('tickets', () => {
      describe('getTickets()', () => {
        it('should return a list of tickets', async () => {
          const result = await api.getTickets({ limit: 5 });

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
          expect(Array.isArray(result.data)).toBe(true);
        });

        it('should respect the limit parameter', async () => {
          const limit = 2;
          const result = await api.getTickets({ limit });

          expect(result.data.length).toBeLessThanOrEqual(limit);
        });

        it('should support include parameter', async () => {
          const result = await api.getTickets({ limit: 1, include: 'contacts' });

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
        });

        it('should support filtering by departmentId', async () => {
          // First get a department to filter by
          const departments = await api.getDepartments({});
          const departmentId = departments.data[0]?.id;

          if (departmentId) {
            const result = await api.getTickets({ limit: 5, departmentId });

            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
          }
        });
      });

      describe('getTicketById()', () => {
        let testTicketId: ZohoDeskTicketId;

        beforeEach(async () => {
          const tickets = await api.getTickets({ limit: 1 });
          testTicketId = tickets.data[0]?.id;
        });

        it('should return a single ticket', async () => {
          if (testTicketId) {
            const result = await api.getTicketById({ ticketId: testTicketId });

            expect(result).toBeDefined();
            expect(result.id).toBe(testTicketId);
            expect(result.ticketNumber).toBeDefined();
            expect(result.subject).toBeDefined();
          }
        });

        it('should support include parameter', async () => {
          if (testTicketId) {
            const result = await api.getTicketById({
              ticketId: testTicketId,
              include: ['contacts', 'departments', 'assignee']
            });

            expect(result).toBeDefined();
            expect(result.id).toBe(testTicketId);
          }
        });
      });

      describe('searchTickets()', () => {
        it('should search tickets by status', async () => {
          const result = await api.searchTickets({ status: 'Open', limit: 5 });

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
          expect(Array.isArray(result.data)).toBe(true);
        });

        it('should return empty results for non-matching search', async () => {
          const result = await api.searchTickets({
            subject: 'ThisSubjectShouldNotMatchAnyTicket_12345678901234567890',
            limit: 5
          });

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
        });
      });

      describe('getTicketsForContact()', () => {
        it('should return tickets for a contact', async () => {
          // Get a contact that has tickets
          const tickets = await api.getTickets({ limit: 1 });
          const contactId = tickets.data[0]?.contactId;

          if (contactId) {
            const result = await api.getTicketsForContact({ contactId, limit: 5 });

            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
          }
        });
      });

      describe('getTicketMetrics()', () => {
        it('should return metrics for a ticket', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const result = await api.getTicketMetrics({ ticketId });
            expect(result).toBeDefined();
          }
        });
      });

      describe('getTicketsPageFactory()', () => {
        it('should iterate through pages of tickets', async () => {
          const limit = 2;
          const fetchPage = api.getTicketsPageFactory({ limit });

          const firstPage = await fetchPage.fetchNext();
          expect(firstPage.page).toBe(0);
          expect(firstPage.result.data).toBeDefined();
          expect(firstPage.result.data.length).toBeLessThanOrEqual(limit);

          if (firstPage.result.data.length >= limit) {
            const secondPage = await firstPage.fetchNext();
            expect(secondPage.page).toBe(1);
            expect(secondPage.result.data).toBeDefined();

            // Ensure pages return different data
            if (secondPage.result.data.length > 0) {
              expect(secondPage.result.data[0].id).not.toBe(firstPage.result.data[0].id);
            }
          }
        });
      });
    });

    // MARK: Departments
    describe('departments', () => {
      describe('getDepartments()', () => {
        it('should return a list of departments', async () => {
          const result = await api.getDepartments({});

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
          expect(Array.isArray(result.data)).toBe(true);
          expect(result.data.length).toBeGreaterThan(0);
        });

        it('should support filtering by isEnabled', async () => {
          const result = await api.getDepartments({ isEnabled: true });

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
        });
      });

      describe('getDepartmentById()', () => {
        let testDepartmentId: ZohoDeskDepartmentId;

        beforeEach(async () => {
          const departments = await api.getDepartments({});
          testDepartmentId = departments.data[0]?.id;
        });

        it('should return a single department', async () => {
          if (testDepartmentId) {
            const result = await api.getDepartmentById({ departmentId: testDepartmentId });

            expect(result).toBeDefined();
            expect(result.id).toBe(testDepartmentId);
            expect(result.name).toBeDefined();
          }
        });
      });
    });

    // MARK: Contacts
    describe('contacts', () => {
      describe('getContacts()', () => {
        it('should return a list of contacts', async () => {
          const result = await api.getContacts({ limit: 5 });

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
          expect(Array.isArray(result.data)).toBe(true);
        });

        it('should respect the limit parameter', async () => {
          const limit = 2;
          const result = await api.getContacts({ limit });

          expect(result.data.length).toBeLessThanOrEqual(limit);
        });

        it('should support sorting', async () => {
          const result = await api.getContacts({
            limit: 5,
            sortBy: 'createdTime'
          });

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
        });
      });

      describe('getContactById()', () => {
        let testContactId: ZohoDeskContactId;

        beforeEach(async () => {
          const contacts = await api.getContacts({ limit: 1 });
          testContactId = contacts.data[0]?.id;
        });

        it('should return a single contact', async () => {
          if (testContactId) {
            const result = await api.getContactById({ contactId: testContactId });

            expect(result).toBeDefined();
            expect(result.id).toBe(testContactId);
            expect(result.lastName).toBeDefined();
          }
        });
      });

      describe('getContactsByIds()', () => {
        it('should return contacts by IDs', async () => {
          const contacts = await api.getContacts({ limit: 2 });
          const contactIds = contacts.data.map((c) => c.id);

          if (contactIds.length > 0) {
            const result = await api.getContactsByIds({ contactIds });

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
          }
        });
      });

      describe('getContactsPageFactory()', () => {
        it('should iterate through pages of contacts', async () => {
          const limit = 2;
          const fetchPage = api.getContactsPageFactory({ limit });

          const firstPage = await fetchPage.fetchNext();
          expect(firstPage.page).toBe(0);
          expect(firstPage.result.data).toBeDefined();
          expect(firstPage.result.data.length).toBeLessThanOrEqual(limit);
        });
      });
    });

    // MARK: Tags
    describe('tags', () => {
      let testDepartmentId: ZohoDeskDepartmentId;

      beforeEach(async () => {
        const departments = await api.getDepartments({});
        testDepartmentId = departments.data[0]?.id;
      });

      describe('getAllTags()', () => {
        it('should return a list of tags', async () => {
          const result = await api.getAllTags({ departmentId: testDepartmentId });

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
          expect(Array.isArray(result.data)).toBe(true);
        });
      });

      describe('searchTags()', () => {
        it('should search for tags by string', async () => {
          const result = await api.searchTags({ departmentId: testDepartmentId, searchVal: 'test' });

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
        });
      });

      describe('getTicketTags()', () => {
        it('should return tags for a ticket', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const result = await api.getTicketTags({ ticketId });

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
          }
        });
      });
    });

    // MARK: Followers
    describe('followers', () => {
      describe('getTicketFollowers()', () => {
        it('should return followers for a ticket', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const result = await api.getTicketFollowers({ ticketId });

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
          }
        });
      });
    });

    // MARK: Attachments
    describe('attachments', () => {
      describe('getTicketAttachments()', () => {
        it('should return attachments for a ticket', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const result = await api.getTicketAttachments({ ticketId });

            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
          }
        });
      });
    });

    // MARK: Comments
    describe('comments', () => {
      describe('getTicketComments()', () => {
        it('should return comments for a ticket', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const result = await api.getTicketComments({ ticketId });

            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
          }
        });
      });

      describe('getTicketCommentById()', () => {
        it('should return a single comment', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const comments = await api.getTicketComments({ ticketId, limit: 1 });
            const commentId = comments.data[0]?.id;

            if (commentId) {
              const result = await api.getTicketCommentById({ ticketId, commentId });

              expect(result).toBeDefined();
              expect(result.id).toBe(commentId);
            }
          }
        });
      });
    });

    // MARK: Time Tracking
    describe('time tracking', () => {
      describe('getTicketTimeEntries()', () => {
        it('should return time entries for a ticket', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const result = await api.getTicketTimeEntries({ ticketId });

            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
          }
        });
      });

      describe('getTicketTimeEntrySummation()', () => {
        it('should return time entry summation for a ticket', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const result = await api.getTicketTimeEntrySummation({ ticketId });
            expect(result).toBeDefined();
          }
        });
      });

      describe('getTicketTimer()', () => {
        it('should return the timer state for a ticket', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const result = await api.getTicketTimer({ ticketId });
            expect(result).toBeDefined();
          }
        });
      });
    });

    // MARK: Threads
    describe('threads', () => {
      describe('getTicketThreads()', () => {
        it('should return threads for a ticket', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const result = await api.getTicketThreads({ ticketId });

            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
          }
        });

        it('should support include parameter for plainText', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const result = await api.getTicketThreads({ ticketId, include: 'plainText' });

            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
          }
        });
      });

      describe('getTicketThreadById()', () => {
        it('should return a single thread', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const threads = await api.getTicketThreads({ ticketId, limit: 1 });
            const threadId = threads.data[0]?.id;

            if (threadId) {
              const result = await api.getTicketThreadById({ ticketId, threadId });

              expect(result).toBeDefined();
              expect(result.id).toBe(threadId);
              expect(result.content).toBeDefined();
            }
          }
        });
      });

      describe('getTicketThreadsPageFactory()', () => {
        it('should iterate through pages of threads', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const limit = 2;
            const fetchPage = api.getTicketThreadsPageFactory({ ticketId, limit });

            const firstPage = await fetchPage.fetchNext();
            expect(firstPage.page).toBe(0);
            expect(firstPage.result.data).toBeDefined();
          }
        });
      });
    });

    // MARK: Activities
    describe('activities', () => {
      describe('getTicketActivities()', () => {
        it('should return activities for a ticket', async () => {
          const tickets = await api.getTickets({ limit: 1 });
          const ticketId = tickets.data[0]?.id;

          if (ticketId) {
            const result = await api.getTicketActivities({ ticketId });

            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
            expect(Array.isArray(result.data)).toBe(true);
          }
        });
      });
    });

    // MARK: Agents
    describe('agents', () => {
      describe('getAgents()', () => {
        it('should return a list of agents', async () => {
          const result = await api.getAgents({});

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
          expect(Array.isArray(result.data)).toBe(true);
          expect(result.data.length).toBeGreaterThan(0);
        });

        it('should support include parameter', async () => {
          const result = await api.getAgents({ include: 'role', limit: 5 });

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
        });

        it('should support filtering by status', async () => {
          const result = await api.getAgents({ status: 'ACTIVE', limit: 5 });

          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
        });
      });

      describe('getAgentById()', () => {
        it('should return a single agent', async () => {
          const agents = await api.getAgents({ limit: 1 });
          const agentId = agents.data[0]?.id;

          if (agentId) {
            const result = await api.getAgentById({ agentId });

            expect(result).toBeDefined();
            expect(result.id).toBe(agentId);
            expect(result.name).toBeDefined();
          }
        });

        it('should support include for role and profile', async () => {
          const agents = await api.getAgents({ limit: 1 });
          const agentId = agents.data[0]?.id;

          if (agentId) {
            const result = await api.getAgentById({
              agentId,
              include: ['role', 'profile']
            });

            expect(result).toBeDefined();
            expect(result.id).toBe(agentId);
          }
        });
      });

      describe('getAgentsByIds()', () => {
        it('should return agents by IDs', async () => {
          const agents = await api.getAgents({ limit: 2 });
          const agentIds = agents.data.map((a) => a.id);

          if (agentIds.length > 0) {
            const result = await api.getAgentsByIds({ agentIds });

            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
          }
        });
      });

      describe('getMyInfo()', () => {
        it('should return the current agent info', async () => {
          const result = await api.getMyInfo();

          expect(result).toBeDefined();
          expect(result.id).toBeDefined();
          expect(result.emailId).toBeDefined();
        });
      });

      describe('getAgentsPageFactory()', () => {
        it('should iterate through pages of agents', async () => {
          const limit = 2;
          const fetchPage = api.getAgentsPageFactory({ limit });

          const firstPage = await fetchPage.fetchNext();
          expect(firstPage.page).toBe(0);
          expect(firstPage.result.data).toBeDefined();
          expect(firstPage.result.data.length).toBeLessThanOrEqual(limit);
        });
      });
    });
  });
});
