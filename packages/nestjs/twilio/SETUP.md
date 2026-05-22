# `@dereekb/nestjs/twilio` — Setup

This package wraps the official `twilio` SDK with a NestJS module that exposes:

- **`TwilioModule`** — `TwilioApi` + `TwilioService` for sending SMS / MMS.
- **`TwilioVerifyModule`** — `TwilioVerifyApi` + `TwilioVerifyService` for OTP / 2FA (Twilio Verify v2).
- **`TwilioLookupModule`** — `TwilioLookupApi` + `TwilioLookupService` for phone-number validation and (optional) carrier info (Twilio Lookup v2).
- **`TwilioWebhookModule`** — controller + service that receive Twilio status callbacks (`POST /webhook/twilio/status`) and incoming SMS (`POST /webhook/twilio/incoming`), with `X-Twilio-Signature` verification.

The bridge to firebase-server's notification pipeline lives in [`@dereekb/firebase-server/twilio`](../../firebase-server/twilio/).

---

## 1. Create a Twilio account and gather credentials

1. Sign up at [twilio.com](https://www.twilio.com/try-twilio). The trial gives you a free phone number and ~$15 of credit.
2. From the [Twilio Console](https://console.twilio.com/) home, copy:
   - **Account SID** (begins with `AC…`)
   - **Auth Token** (revealed on click)
3. Provision an outbound sender — pick one:
   - **A Twilio phone number.** Phone Numbers → Buy a number → pick one with SMS capability. Copy it in E.164 form (e.g. `+15555550100`).
   - **A Messaging Service SID.** Messaging → Services → Create. Add your number(s) to the service's sender pool and copy the SID (begins with `MG…`). Required for A2P 10DLC traffic in the US.
4. *(Optional)* Create an API Key pair: Console → Account → API keys & tokens → Create API key. Lets you rotate credentials without touching the root Auth Token. Copy the SID (`SK…`) and Secret immediately — the secret is shown only once.
5. *(Optional)* Create a Verify service: Verify → Services → Create. Copy the SID (`VA…`). Required only if you use `TwilioVerifyModule`.

## 2. Configure your environment

All configuration is read from process env vars via NestJS `ConfigService`. The repo ships a committed `.env` file with the keys below pre-populated with `placeholder` values; copy them into your real environment (a `.env.secret`, your CI secret store, Firebase Functions config, etc.) and replace the values.

### Required for sending SMS (`TwilioModule`)

| Variable | Description |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID. Starts with `AC…`. |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token. *Required unless* an API key pair is provided. |
| `TWILIO_PHONE_NUMBER` | Default outbound sender, in E.164 (e.g. `+15555550100`). Optional if `TWILIO_MESSAGING_SERVICE_SID` is set. |

### Optional / advanced

| Variable | Description |
| --- | --- |
| `TWILIO_API_KEY_SID` | API key SID (`SK…`). When provided together with `TWILIO_API_KEY_SECRET`, the client authenticates with this pair instead of `TWILIO_AUTH_TOKEN`. |
| `TWILIO_API_KEY_SECRET` | Secret value paired with `TWILIO_API_KEY_SID`. |
| `TWILIO_MESSAGING_SERVICE_SID` | Messaging Service SID (`MG…`). When set, Twilio chooses the sender from the service's number pool. Takes precedence over `TWILIO_PHONE_NUMBER` for outbound. |
| `TWILIO_STATUS_CALLBACK_URL` | Default `statusCallback` URL applied to every outbound SMS. Twilio will POST delivery-status updates here. Point it at your deployment's `https://…/webhook/twilio/status`. |
| `TWILIO_SANDBOX` | `true` suppresses real SDK calls and returns synthetic message SIDs — useful for local development. Defaults to `false`. |

### Required for `TwilioVerifyModule` (OTP / 2FA)

| Variable | Description |
| --- | --- |
| `TWILIO_VERIFY_SERVICE_SID` | Verify Service SID (`VA…`). |

### Required for `TwilioWebhookModule`

| Variable | Description |
| --- | --- |
| `TWILIO_WEBHOOK_AUTH_TOKEN` | Auth token used to verify the `X-Twilio-Signature` header. When unset, falls back to `TWILIO_AUTH_TOKEN`. Set this to a separate value only if you rotate webhook tokens independently. |
| `TWILIO_WEBHOOK_BASE_URL` | Public base URL Twilio uses to call your webhook (e.g. `https://api.example.com`). Required when the service sits behind a proxy — Twilio computes the signature over the URL it called, so the verifier needs to reconstruct that exact URL. |
| `TWILIO_WEBHOOK_SKIP_VERIFY` | `true` bypasses signature verification. **Do not enable in production.** Intended for local development against Twilio test mode. Defaults to `false`. |

---

## 3. Wire the modules into your NestJS application

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TwilioModule, TwilioVerifyModule, TwilioLookupModule, TwilioWebhookModule } from '@dereekb/nestjs/twilio';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TwilioModule,
    TwilioVerifyModule,   // omit if you don't need OTP
    TwilioLookupModule,   // omit if you don't need phone validation
    TwilioWebhookModule   // omit if you don't accept Twilio webhooks
  ]
})
export class AppModule {}
```

### Webhook prerequisite — raw-body middleware

`TwilioWebhookController` uses `@RawBody()` from `@dereekb/nestjs`. The consuming application must register the raw-body middleware for the `/webhook/twilio` path so signature verification can read the unparsed form body. Extend `AppModuleWithWebhooksEnabled` (see `packages/nestjs/src/lib/middlewares/webhook.ts`) and include `/webhook/twilio` in its consumed path list — without this, every request is rejected with HTTP 403.

### Registering webhook handlers

```ts
import { Injectable } from '@nestjs/common';
import { TwilioWebhookService } from '@dereekb/nestjs/twilio';

@Injectable()
export class MyTwilioHandlers {
  constructor(twilioWebhookService: TwilioWebhookService) {
    twilioWebhookService.configure((handler) => {
      handler.handleStatusCallback(async ({ payload }) => {
        // payload.MessageSid, payload.MessageStatus, payload.ErrorCode, …
      });
      handler.handleIncomingMessage(async ({ payload }) => {
        // payload.From, payload.Body, payload.mediaUrls, …
      });
    });
  }
}
```

---

## 4. Verify the setup

This package ships a "live API" identity check that fetches your account record from Twilio. It's skipped automatically when env vars are missing or set to `placeholder`.

```bash
# in a shell where TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_PHONE_NUMBER are real
pnpm nx run nestjs-twilio:test
```

A green run with the identity test executed (not skipped) proves your credentials authenticate and your account is reachable.

To smoke-test outbound SMS in a NestJS app, inject `TwilioService` and call:

```ts
await twilioService.sendSms({
  to: '+15555550456',
  body: 'hello from dbx-components'
});
```

Or to suppress real sends during local development without unsetting credentials:

```env
TWILIO_SANDBOX=true
```

---

## 5. Common pitfalls

- **Signature verification rejecting every request behind a proxy.** Set `TWILIO_WEBHOOK_BASE_URL` to the public URL Twilio dialed. The verifier rebuilds the request URL from `X-Forwarded-Proto` / `X-Forwarded-Host` when present, but an explicit base URL is more reliable.
- **`Authentication Error - invalid username` from the SDK.** The Account SID does not match the Auth Token (or the token has been rotated). Re-copy both from the Twilio Console.
- **Trial-account "unverified caller" errors.** During trial, Twilio refuses outbound SMS to numbers you have not verified in the console. Verify the test recipient under Phone Numbers → Verified Caller IDs.
- **A2P 10DLC required for US-bound traffic.** US carriers reject unregistered traffic. Register your brand and campaign via Messaging → Regulatory Compliance, then send through a `Messaging Service` whose pool includes the registered campaign.
