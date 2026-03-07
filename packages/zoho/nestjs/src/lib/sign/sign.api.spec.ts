import { appZohoSignModuleMetadata } from './sign.module';
import { DynamicModule, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ZohoSignApi } from './sign.api';
import { fileZohoAccountsAccessTokenCacheService, ZohoAccountsAccessTokenCacheService } from '../accounts/accounts.service';
import { type ZohoSignRequest, type ZohoSignRequestData } from '@dereekb/zoho';
import * as fs from 'fs';
import * as path from 'path';

const cacheService = fileZohoAccountsAccessTokenCacheService();

const TEST_FILES_DIR = path.resolve(__dirname, '../../../test/files');

function loadTestPdfFile(filename = 'resume.pdf'): File {
  const filePath = path.join(TEST_FILES_DIR, filename);
  const buffer = fs.readFileSync(filePath);
  return new File([buffer], filename, { type: 'application/pdf' });
}

@Module(appZohoSignModuleMetadata({}))
export class TestZohoSignModule {}

describe('sign.api', () => {
  let nest: TestingModule;

  beforeEach(async () => {
    const providers = [
      {
        provide: ZohoAccountsAccessTokenCacheService,
        useValue: cacheService
      }
    ];

    const rootModule: DynamicModule = {
      module: TestZohoSignModule,
      providers,
      exports: providers,
      global: true
    };

    const builder = Test.createTestingModule({
      imports: [rootModule]
    });

    nest = await builder.compile();
  });

  describe('ZohoSignApi', () => {
    let api: ZohoSignApi;
    let testRequest: ZohoSignRequest;

    beforeEach(async () => {
      api = nest.get(ZohoSignApi);

      // List existing documents; create one if none exist
      const listResult = await api.getDocuments({
        start_index: 1,
        row_count: 1,
        sort_column: 'created_time',
        sort_order: 'DESC'
      });

      console.log({
        listResult: listResult.requests[0]
      });

      if (listResult.requests.length > 0) {
        testRequest = listResult.requests[0];
      } else {
        const data: ZohoSignRequestData = {
          request_name: 'Test Document',
          is_sequential: false,
          actions: [
            {
              action_type: 'SIGN',
              recipient_name: 'Test Signer',
              recipient_email: 'derek.burgman@hellosubs.co',
              signing_order: 1
            }
          ]
        };

        const createResult = await api.createDocument({ requestData: data, file: loadTestPdfFile() });
        testRequest = createResult.requests;
      }
    });

    // MARK: Read Operations
    describe('getDocuments()', () => {
      it('should retrieve a list of documents', async () => {
        const result = await api.getDocuments({
          start_index: 1,
          row_count: 5,
          sort_column: 'created_time',
          sort_order: 'DESC'
        });

        expect(result).toBeDefined();
        expect(result.requests).toBeDefined();
        expect(result.page_context).toBeDefined();
        expect(result.page_context.total_count).toBeGreaterThanOrEqual(0);
      });
    });

    describe('getDocument()', () => {
      it('should retrieve details of a specific document', async () => {
        const requestId = testRequest.request_id!;
        const result = await api.getDocument({ requestId });

        expect(result).toBeDefined();
        expect(result.requests).toBeDefined();
        expect(result.requests.request_name).toBeDefined();
      });
    });

    describe('retrieveFieldTypes()', () => {
      it('should retrieve available field types', async () => {
        const result = await api.retrieveFieldTypes();

        expect(result).toBeDefined();
        expect(result.field_types).toBeDefined();
        expect(result.field_types.length).toBeGreaterThan(0);
        expect(result.field_types[0].field_type_id).toBeDefined();
        expect(result.field_types[0].field_type_name).toBeDefined();
      });
    });

    describe('getDocumentFormData()', () => {
      it('should retrieve form data for a completed document', async () => {
        const listResult = await api.getDocuments({
          start_index: 1,
          row_count: 10,
          sort_column: 'created_time',
          sort_order: 'DESC'
        });

        const completedRequest = listResult.requests.find((r: ZohoSignRequest) => r.request_status === 'completed');

        if (completedRequest) {
          const result = await api.getDocumentFormData({ requestId: completedRequest.request_id! });

          expect(result).toBeDefined();
          expect(result.document_form_data).toBeDefined();
          expect(result.document_form_data.request_name).toBeDefined();
        }
      });
    });

    describe('getDocumentsPageFactory', () => {
      it('should paginate through documents', async () => {
        const pageFactory = api.getDocumentsPageFactory;
        const firstPage = pageFactory({ start_index: 1, row_count: 2, sort_column: 'created_time', sort_order: 'DESC' });

        const firstResult = await firstPage.fetchNext();

        expect(firstResult).toBeDefined();
        expect(firstResult.result.requests).toBeDefined();
        expect(firstResult.result.page_context).toBeDefined();

        if (firstResult.hasNext) {
          const secondResult = await firstResult.fetchNext();
          expect(secondResult).toBeDefined();
          expect(secondResult.result.requests).toBeDefined();
        }
      });
    });

    describe('downloadPdf()', () => {
      it('should download a PDF for a completed document', async () => {
        const listResult = await api.getDocuments({
          start_index: 1,
          row_count: 10,
          sort_column: 'created_time',
          sort_order: 'DESC'
        });

        const completedRequest = listResult.requests.find((r: ZohoSignRequest) => r.request_status === 'completed');

        if (completedRequest) {
          const result = await api.downloadPdf({ requestId: completedRequest.request_id! });

          expect(result).toBeDefined();
          expect(result.ok).toBe(true);
        }
      });
    });

    describe('downloadCompletionCertificate()', () => {
      it('should download a completion certificate for a completed document', async () => {
        const listResult = await api.getDocuments({
          start_index: 1,
          row_count: 10,
          sort_column: 'created_time',
          sort_order: 'DESC'
        });

        const completedRequest = listResult.requests.find((r: ZohoSignRequest) => r.request_status === 'completed');

        if (completedRequest) {
          const result = await api.downloadCompletionCertificate({ requestId: completedRequest.request_id! });

          expect(result).toBeDefined();
          expect(result.ok).toBe(true);
        }
      });
    });

    // MARK: Write Operations
    describe('createDocument() and deleteDocument()', () => {
      it('should create a new document then delete it', async () => {
        const data: ZohoSignRequestData = {
          request_name: 'Test Create Document',
          is_sequential: false,
          actions: [
            {
              action_type: 'SIGN',
              recipient_name: 'Test Signer',
              recipient_email: 'derek.burgman@hellosubs.co',
              signing_order: 1
            }
          ]
        };

        // Create the document
        const createResult = await api.createDocument({ requestData: data, file: loadTestPdfFile() });

        expect(createResult).toBeDefined();
        expect(createResult.requests).toBeDefined();
        expect(createResult.requests.request_name).toBe('Test Create Document');

        const createdRequestId = createResult.requests.request_id!;
        expect(createdRequestId).toBeDefined();

        // Verify it exists by fetching it
        const getResult = await api.getDocument({ requestId: createdRequestId });
        expect(getResult).toBeDefined();
        expect(getResult.requests.request_id).toBe(createdRequestId);

        // Delete the document
        const deleteResult = await api.deleteDocument({ requestId: createdRequestId });
        expect(deleteResult).toBeDefined();
        expect(deleteResult.status).toBe('success');
      });
    });
  });
});
