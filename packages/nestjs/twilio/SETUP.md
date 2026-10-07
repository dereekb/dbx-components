# `@dereekb/nestjs/twilio` — Setup

This package wraps the official `twilio` SDK with a NestJS module that exposes:

- **`TwilioModule`** — `TwilioApi` + `TwilioService` for sending SMS / MMS.
- **`TwilioVerifyModule`** — `TwilioVerifyApi` + `TwilioVerifyService` for OTP / 2FA (Twilio Verify v2).
- **`TwilioLookupModule`** — `TwilioLookupApi` + `TwilioLookupService` for phone-number validation and (optional) carrier info (Twilio Lookup v2).
- **`TwilioWebhookModule`** — controller + service that receive Twilio status callbacks (`POST /webhook/twilio/status`) and incoming SMS (`POST /webhook/twilio/incoming`), with `X-Twilio-Signature` verification.

Each module has an `appTwilio*ModuleMetadata()` counterpart (`appTwilioModuleMetadata()`, `appTwilioVerifyModuleMetadata()`, `appTwilioLookupModuleMetadata()`, `appTwilioWebhookModuleMetadata()`) for declaring the app's own module with a `dependencyModule` and extra `imports` / `exports` / `providers`.

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
| `TWILIO_SANDBOX` | `true` suppresses real SDK calls and returns synthetic message SIDs — useful for local development. Defaults to `false`. |

### Required for `TwilioVerifyModule` (OTP / 2FA)

| Variable | Description |
| --- | --- |
| `TWILIO_VERIFY_SERVICE_SID` | Verify Service SID (`VA…`). |

### Required for `TwilioWebhookModule`

| Variable | Description |
| --- | --- |
| `TWILIO_WEBHOOK_AUTH_TOKEN` | Auth token used to verify the `X-Twilio-Signature` header. When unset or a placeholder, falls back to `TWILIO_AUTH_TOKEN`. Set this to a separate value only if you rotate webhook tokens independently. |
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

To declare your own modules instead, use the `appTwilio*ModuleMetadata()` functions. A `dependencyModule` that exports a `TwilioWebhookUrlsConfig` supplies the app's public webhook URLs (see [Webhook URLs](#webhook-urls)), and the Verify and Lookup modules take the app's Twilio module as their `dependencyModule` so they share its `TwilioApi`:

```ts
import { Module } from '@nestjs/common';
import { appTwilioModuleMetadata, appTwilioVerifyModuleMetadata, appTwilioWebhookModuleMetadata, TwilioWebhookUrlsConfig } from '@dereekb/nestjs/twilio';
import { twilioWebhookUrlsConfigProvider } from '@dereekb/firebase-server/twilio';

@Module({ providers: [twilioWebhookUrlsConfigProvider()], exports: [TwilioWebhookUrlsConfig] })
export class AppTwilioDependencyModule {}

@Module(appTwilioModuleMetadata({ dependencyModule: AppTwilioDependencyModule }))
export class AppTwilioModule {}

@Module(appTwilioVerifyModuleMetadata({ dependencyModule: AppTwilioModule }))
export class AppTwilioVerifyModule {}

@Module(appTwilioWebhookModuleMetadata({ dependencyModule: AppTwilioDependencyModule, providers: [MyTwilioHandlers] }))
export class AppTwilioWebhookModule {}
```

### Placeholder values

`TwilioApi` creates the `twilio` SDK client on first use rather than when it is constructed, because the SDK throws when the Account SID does not start with `AC`. The modules therefore start with the `placeholder` / `xxx` values of a committed `.env`, and only a call that reaches the SDK fails.

`twilioServiceConfigFactory()` removes placeholder values from a usable config through `usableTwilioServiceConfig()`, so a placeholder Messaging Service SID or API key never shadows a real sender or Auth Token. `usableTwilioServiceConfig()` treats `''`, `placeholder` and `xxx` as unset, and requires the `AC…` Account SID, an Auth Token or an `SK…` API key pair, and a `+…` sender number or an `MG…` Messaging Service SID. Use `isUsableTwilioServiceConfig(twilioService.twilioApi.config)` to decide whether the provided `TwilioService` can send.

### Webhook prerequisite — raw-body middleware

`TwilioWebhookController` uses `@RawBody()` from `@dereekb/nestjs`, so signature verification can read the unparsed form body. The raw-body middleware must cover `/webhook/twilio`. `AppModuleWithWebhooksEnabled` (see `packages/nestjs/src/lib/middlewares/webhook.ts`) applies it to every `POST /webhook/{*path}`, and a firebase-server app gets it by setting `configureWebhooks: true` in its `nestServerInstance()` config. Without it, every request is rejected with HTTP 403.

The routes sit under the app's global route prefix, if any. With `globalApiRoutePrefix: '/api'` the endpoints are `https://<your-app>/api/webhook/twilio/status` and `https://<your-app>/api/webhook/twilio/incoming`.

### Webhook URLs

The webhook URLs are not configured through the environment. `twilioWebhookUrls(webhookUrl)` builds them from the app's public webhook URL (the URL its `/webhook` routes are served at):

- **`statusCallbackUrl`** — the default `statusCallback` of every outbound SMS, so Twilio posts its delivery status to `/webhook/twilio/status`. Twilio has no account-wide default for this; it is sent with each message.
- **`incomingMessageUrl`** — set it in the Twilio Console as "A message comes in" on your phone number (or the Messaging Service's integration settings). Nothing registers it with Twilio for you.
- **`baseUrl`** — the public origin the webhook verifier uses. Twilio signs the URL it called, so behind a proxy the verifier needs the public origin to rebuild that URL. Without it, the URL is rebuilt from the `X-Forwarded-Proto` / `X-Forwarded-Host` / `Host` headers.

Supply them by exporting a `TwilioWebhookUrlsConfig` from the `dependencyModule` of `appTwilioModuleMetadata()` (which then sets the default status callback) and `appTwilioWebhookModuleMetadata()` (which then verifies against `baseUrl`). In a firebase-server app, `twilioWebhookUrlsConfigProvider()` from [`@dereekb/firebase-server/twilio`](../../firebase-server/twilio/) provides it from `FirebaseServerEnvService.appWebhookUrl`, as in the example above. It supplies no URLs when webhooks are disabled or the webhook URL is not reachable from the internet, such as `localhost` during local development, so no status callback is requested and the verifier falls back to the request headers.

The webhook module only needs the auth token, so it does not import the Twilio module.

### Registering webhook handlers

```ts
import { Injectable } from '@nestjs/common';
import { TwilioWebhookService } from '@dereekb/nestjs/twilio';

@Injectable()
export class MyTwilioHandlers {
  constructor(twilioWebhookService: TwilioWebhookService) {
    twilioWebhookService.configure(this, (handler) => {
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

### Syncing STOP/START replies

Twilio blocks every text to a number after it replies STOP (send error 21610), until that number texts START. Sync those replies back to the app so its notification settings match what Twilio will deliver. [`@dereekb/firebase-server/twilio`](../../firebase-server/twilio/) provides `twilioNotificationTextOptOutHandler()`, which calls the `applyNotificationUserTextOptOut` notification server action:

- STOP adds the number to `tso` on every `NotificationUser` whose texting number (`gc.t`) is that number. Texts to it then resolve to off at send time and in the health check, and the settings UI locks texts with a message on how to restart them.
- START removes the number, and re-records text consent (`gc.tcat`) for the users that still text it.
- HELP and other texts do nothing.

Setup:

1. Point the Messaging Service's (or number's) **"A message comes in"** webhook at your `/webhook/twilio/incoming` route.
2. Advanced Opt-Out is recommended. Twilio then sends the matched keyword as the `OptOutType` parameter, which wins over the body. Without it, the body is matched against Twilio's default keywords (STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, REVOKE, OPTOUT / START, YES, UNSTOP / HELP, INFO). With custom keywords, pass `optOutTypeOnly: true` so only `OptOutType` is trusted.
3. Never reply to keyword texts. Twilio already sends the confirmation.
4. Opt-outs are tracked per Messaging Service or sender. A number that replied STOP to one sender can still receive texts from another.

```ts
import { Inject, Injectable } from '@nestjs/common';
import { TwilioWebhookService } from '@dereekb/nestjs/twilio';
import { NotificationServerActions } from '@dereekb/firebase-server/model';
import { twilioNotificationTextOptOutHandler } from '@dereekb/firebase-server/twilio';

@Injectable()
export class MyTwilioHandlers {
  constructor(@Inject(TwilioWebhookService) twilioWebhookService: TwilioWebhookService, @Inject(NotificationServerActions) notificationServerActions: NotificationServerActions) {
    const handleTextOptOut = twilioNotificationTextOptOutHandler({ notificationServerActions });

    twilioWebhookService.configure(this, (handler) => {
      handler.handleIncomingMessage(async ({ payload }) => {
        const { optOutType } = await handleTextOptOut(payload);

        if (optOutType == null) {
          // handle any other text here
        }
      });
    });
  }
}
```

The module that registers the handlers must import your notification module, so `NotificationServerActions` can be injected.

Known limits: only the texting number (`gc.t`) is matched on STOP, not numbers on box entries, listed recipients or `dc.t` (Twilio still blocks those, and the send pipeline skips any number a loaded user stopped). STOPs from before the sync was set up, or from missed webhooks, are not backfilled; the Twilio health check still reports them from the message history.

### Sending notification texts

[`@dereekb/firebase-server/twilio`](../../firebase-server/twilio/) provides `twilioNotificationTextSendService()`, a `NotificationTextSendService` for the firebase-server notification pipeline. Provide it as the `textSendService` of your `NotificationSendService`, and fall back to `ignoreSendNotificationTextSendService()` when Twilio is not configured:

```ts
const textSendService = isUsableTwilioServiceConfig(twilioService.twilioApi.config) ? twilioNotificationTextSendService({ twilioService }) : ignoreSendNotificationTextSendService();
```

By default each message becomes one SMS. The body joins the `title`, `openingMessage`, `closingMessage` and `actionUrl` of the message's `textContent` (or its `content`) with newlines, truncated to 1600 characters, so give each notification template a short `textContent` with a deep link. Messages without a recipient phone number are dropped. Texts only go to a saved texting number (`gc.t`, or a box entry, `dc.t` or listed recipient `t`), never the Firebase Auth phone number, and never to a number that replied STOP. Sends suppressed by `TWILIO_SANDBOX=true` are reported as ignored. Pass `messageBuilders` to build the SMS for specific send template names yourself.

### Delivery health check

Pass `twilioNotificationTextSendServiceHealthCheckService()` as the send service's `healthCheckService` so the notification delivery health check can verify texts with Twilio instead of only checking the user's settings:

```ts
const textSendService = twilioNotificationTextSendService({
  twilioService,
  healthCheckService: twilioNotificationTextSendServiceHealthCheckService({
    twilioService,
    probeBuilder: ({ to }) => ({ to, body: 'Example App: this is a test text confirming we can text this number. No reply is needed.' })
  })
});
```

It reports an account that is not active, and classifies the most recent text to the number, read back from the Messages API: delivered, a STOP opt-out (21610), an unregistered sending number (30034), or a failure with its reason, such as a landline or a carrier spam filter. With a `probeBuilder` it can send a test text and follow its status until the carrier reports an outcome. A STOP opt-out is refused before any message is created, so the test text is how one is found for a number that has not been texted since. Set `lookupNumber: true` to also look the number up and report an invalid number or a landline; Twilio charges per lookup for the line type. The read helpers it uses (`twilioRecentMessagesForRecipient()`, `twilioMessageForSid()`, `twilioAccountState()`, `twilioLookupPhoneNumberForDiagnosis()`) are exported from this package and report an unreachable API as `unknown` rather than throwing.

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

- **Signature verification rejecting every request behind a proxy.** Pass the public origin Twilio dialed as `TwilioWebhookConfig.baseUrl` (`appTwilioWebhookModuleMetadata()` does this for firebase-server apps). The verifier rebuilds the request URL from `X-Forwarded-Proto` / `X-Forwarded-Host` when present, but an explicit base URL is more reliable.
- **`Authentication Error - invalid username` from the SDK.** The Account SID does not match the Auth Token (or the token has been rotated). Re-copy both from the Twilio Console.
- **Trial-account "unverified caller" errors.** During trial, Twilio refuses outbound SMS to numbers you have not verified in the console. Verify the test recipient under Phone Numbers → Verified Caller IDs.
- **A2P 10DLC required for US-bound traffic.** US carriers reject unregistered traffic. Register your brand and campaign via Messaging → Regulatory Compliance, then send through a `Messaging Service` whose pool includes the registered campaign.
