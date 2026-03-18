# Zoho Sign Webhooks

This guide covers configuring Zoho Sign webhooks in the Zoho Sign dashboard and wiring up the `ZohoSignWebhookModule` in your NestJS application.

---

## 1. Create a Webhook in Zoho Sign

Navigate to **Settings > Developer Settings > Webhooks** in Zoho Sign, or go directly to `https://sign.zoho.com/zs/<YOUR_ORG_ID>#/devspace/webhooks/new`.

### Callback URL

Enter the public URL of your webhook endpoint. The NestJS controller registers at `/webhook/zoho/sign`, so the full URL will be something like:

```
https://your-api-domain.com/api/webhook/zoho/sign
```

Use the **"Test Url"** button to verify Zoho Sign can reach your endpoint.

### Name

Give the webhook a descriptive name (e.g. "Production API Webhook").

### Security Settings (HMAC)

Check **"Enable HMAC signature"** and either enter your own secret key or click **"Generate"** to create one.

> **Important:** Once saved, the secret key cannot be retrieved from Zoho Sign. Copy it immediately and store it in your environment variables as `ZOHO_SIGN_WEBHOOK_SECRET_TOKEN`.

When HMAC is enabled, Zoho Sign includes an `X-ZS-WEBHOOK-SIGNATURE` header on every webhook request. The signature is computed as `base64(HMAC-SHA256(payload, secret_key))`. The `ZohoSignWebhookModule` verifies this automatically.

### Callback Trigger Criteria (Optional)

You can optionally filter which documents trigger callbacks. For example, you can set criteria like "Document name Contains NDA" so that only matching documents fire the webhook. If no criteria is set, callbacks are triggered for all events selected below.

### Callback Events

Select which events should trigger the webhook. Events are split into two groups:

**Document events:**

| Event | Description |
|---|---|
| Sent | Documents are sent for signatures or approval |
| Completed by all | All recipients have signed and approved |
| Expires | Documents sent for signatures or approval expire |
| Recalled | Sender recalls the document |

**Recipient events:**

| Event | Description |
|---|---|
| Viewed | A recipient views the document |
| Signed by a recipient | A recipient signs the document |
| Approved by a recipient | A recipient approves the document |
| Declined | A recipient declines the document |
| Reassigned | A recipient reassigns to another person |

Click **"Save"** to create the webhook.

---

## 2. Webhook Payload

Every webhook POST contains a JSON body with two top-level keys:

```json
{
  "notifications": {
    "performed_by_email": "signer@example.com",
    "performed_by_name": "Jane Doe",
    "performed_at": 1555062604837,
    "reason": "",
    "activity": "Document has been signed",
    "operation_type": "RequestSigningSuccess",
    "action_id": "1000000000090",
    "ip_address": "192.168.100.100"
  },
  "requests": {
    "request_name": "NDA Document",
    "request_id": "1000000000000",
    "request_status": "inprogress",
    "org_id": "9876543210",
    "request_type_id": "10000000011",
    "document_ids": [
      {
        "document_name": "CommonNDA.pdf",
        "document_id": "100000000000050"
      }
    ]
  }
}
```

### Operation Types

The `operation_type` field identifies the event:

| Operation Type | Trigger |
|---|---|
| `RequestSubmitted` | Document submitted for signature |
| `RequestViewed` | Document viewed by a recipient |
| `RequestSigningSuccess` | A signer completes signing |
| `RequestCompleted` | All signers/approvers complete |
| `RequestRejected` | A recipient declines |
| `RequestRecalled` | Sender recalls the document |
| `RequestForwarded` | A recipient forwards to another person |
| `RequestExpired` | Document expires |

> For signer-related actions (`RequestViewed`, `RequestSigningSuccess`, `RequestRejected`, `RequestForwarded`), the `action_id` of the signer is present in the `notifications` object.

---

## 3. Best Practices

- **Return HTTP 200 within 5 seconds.** Do not perform heavy processing before responding.
- After **10-15 consecutive failures**, Zoho Sign sends a warning email to the admin.
- After **20 consecutive failures**, the webhook is **automatically disabled**. The admin must re-enable it from the Zoho Sign web interface.

---

## 4. NestJS Module Setup

### Environment Variable

```
ZOHO_SIGN_WEBHOOK_SECRET_TOKEN=<your-hmac-secret-key>
```

### Import the Module

`ZohoSignWebhookModule` is a standalone module that reads the webhook secret from the environment. It does not depend on the Zoho Sign API module (`appZohoSignModuleMetadata`), since webhook verification only needs the HMAC secret.

```typescript
import { Module } from '@nestjs/common';
import { ZohoSignWebhookModule } from '@dereekb/zoho/nestjs';

@Module({
  imports: [ZohoSignWebhookModule]
})
export class AppZohoSignWebhookModule {}
```

Import `AppZohoSignWebhookModule` in your API module alongside your other webhook modules.

### Handling Events

Inject `ZohoSignWebhookService` and use the `configure` accessor to register typed event handlers:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ZohoSignWebhookService } from '@dereekb/zoho/nestjs';
import { catchAllHandlerKey } from '@dereekb/util';

@Injectable()
export class MyZohoSignHandler implements OnModuleInit {
  constructor(private readonly zohoSignWebhookService: ZohoSignWebhookService) {}

  onModuleInit() {
    this.zohoSignWebhookService.configure(this, (x) => {
      x.handleRequestCompleted(this.handleCompleted);
      x.handleRequestSigningSuccess(this.handleSigned);
      x.handleRequestRejected(this.handleRejected);
      x.set(catchAllHandlerKey(), this.handleAny);
    });
  }

  async handleCompleted(event) {
    const { request_id, request_name } = event.requests;
    // All recipients have signed — process the completed document
  }

  async handleSigned(event) {
    const { action_id, performed_by_name } = event.notifications;
    // A single recipient signed — update progress
  }

  async handleRejected(event) {
    const { reason, performed_by_name } = event.notifications;
    // A recipient declined — notify the sender
  }

  async handleAny(event) {
    // Catch-all for any unhandled event types
  }
}
```

Register your handler service in the same module that imports `ZohoSignWebhookModule`:

```typescript
@Module({
  imports: [ZohoSignWebhookModule],
  providers: [MyZohoSignHandler]
})
export class AppZohoSignWebhookModule {}
```

### Webhook Middleware

The webhook controller is mounted at `/webhook/zoho/sign`. Your application must have webhook middleware enabled so the raw request body is preserved for HMAC verification. If using `@dereekb/firebase-server`, this is handled by setting `configureWebhooks: true` in your `nestServerInstance()` call. For plain NestJS apps, use `AppModuleWithWebhooksEnabled` or `consumeWebhooksWithRawBodyMiddleware()` from `@dereekb/nestjs`.
