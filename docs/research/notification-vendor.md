# Which hosted notification vendor should Cadence use?

Research for issue #3, part of map #2 "Notifications in Cadence". Sources were checked on 2026-11-18. Pricing pages change often, so recheck them before you sign anything.

## Recommendation

**Knock** is the pick, and **Novu Cloud** is the runner-up.

Knock meets every high-priority criterion on its free plan:

- 10,000 messages a month, with no hard cap.
- Unlimited environments.
- Full per-person preferences, by workflow or category and by channel type.
- A headless feed client.
- An `Idempotency-Key` header on trigger.
- RS256 signed user tokens, with a Node helper to create them.

It has two real weaknesses:

- **Web push.** Knock has no first-party web push. It goes through FCM.
- **Price jump.** Moving to the paid plan goes straight from $0 to $250 a month.

## Comparison

| Criterion (priority order) | Knock | Novu Cloud | Courier | MagicBell | SuprSend |
|---|---|---|---|---|---|
| Free tier | 10k messages/mo, no hard cap, unlimited environments [K1] | 10k workflow runs/mo, **5 workflows max**, 2 environments, 3 team members [N1] | 10k sends/mo; you must add a card to go over [C1] | **1,000 deliveries/mo**, 1 project [M1] | 10k notifications/mo, **no preferences on Free** [S1] |
| Headless feed, read/unread on server | `@knocklabs/client` FeedClient: `fetch`, `markAsRead/Seen/Archived` (and the undo versions), `items.*` events [K2][K3] | `@novu/js`: `notifications.list/read/readAll/archive…` [N2] | Inbox SDK with read/opened/archived events [C2] | Inbox, JS client [M2] | Headless `@suprsend/web-sdk` [S2] |
| Cross-device sync | Status is stored on the server. The socket sends only `new-message`, with badge counts. Read changes on another device show up on the next fetch. Tabs in the same browser can sync through the experimental BroadcastChannel option [K3][K4] | Socket sends `notification_received`, `unread_count_changed` and `unseen_count_changed` [N2] | Not verified | Not verified | Not verified |
| Preferences by kind × channel | Yes, on Free. `workflows`/`categories` with `channel_types` nested inside. Environment-wide defaults [K5][K1] | Yes. Global preferences plus per-workflow channel preferences; "critical" workflows [N3] | Yes (preferences API) | Yes. Categories × channels, `PUT /v2/channels/user_preferences` [M3] | **Business plan and above only** [S1] |
| Node trigger + idempotency | `POST /v1/workflows/{key}/trigger` with an `Idempotency-Key` header. 24h window; only 2xx responses are cached [K6] | `Idempotency-Key` on `/v1/events/trigger`; returns 409 while the first request is in flight. Docs say it may need enabling per organisation [N4] | `Idempotency-Key` on `POST /send`; 25h default, up to 1 year [C3] | `IDEMPOTENCY-KEY` on broadcasts (v1 docs) [M4] | `idempotency_key`, 24h [S2] |
| Web push | Through FCM only ("Knock does not have a first-party web push channel") [K7] | FCM, OneSignal, Pushpad, Push Webhook. No native VAPID [N5] | Through OneSignal or FCM [C4] | **Native VAPID** [M5] | Native VAPID [S2] |
| Email | Bring your own provider (Resend, Postmark, SES…). Has a "Knock (testing only)" provider and sandbox mode for dev [K8] | Yes, all channels on Free [N1] | Yes | SES, Mailgun, SendGrid, SMTP [M2] | Bring your own provider [S1] |
| Per-user feed security | "Enhanced security mode": a JWT signed with RS256, containing `sub`/`iat`/`exp`, created by `signUserToken` in `@knocklabs/node`. Optional grants [K9] | `subscriberHash = HMAC-SHA256(secret, subscriberId)`. The token never expires on its own [N6] | `POST /auth/issue-token` with scopes. Tokens never expire unless you set `expires_in` [C2] | HS256 JWT signed with the project secret. The docs' examples use a 1-year expiry [M6] | ES256 JWT [S2] |
| Modest production price | Starter $250/mo for 50k messages, then $0.005 each [K1] | Pro from $30/mo for 30k runs, then $1.20 per 1k [N1] | $0.005 per send from the first send (50k sends = $250) [C1] | $249/mo for 50k deliveries [M1] | Essentials $100/mo (billed annually) for 50k, but preferences need Business at $250/mo [S1] |
| Lock-in | Templates and workflows are authored in Knock. The concepts (workflow key, recipient id, preference set) map cleanly elsewhere | Similar. Open-source core, though self-hosting is out of scope | Similar | Similar | Similar |

## Why Knock

1. **The free tier works for real development.** It gives 10k messages a month, unlimited environments (dev and prod kept separate), unlimited workflows and unlimited team members. Going over the limit doesn't hard-fail; Knock asks you to add billing [K1]. Novu's free tier stops at 5 workflows [N1], which Cadence's Notification catalogue will quickly outgrow.
2. **The preference model matches the brief.** "By kind and by channel" is exactly a category or workflow with `channel_types` nested inside. Knock also has environment-level defaults, which help with per-role defaults, and `bulkSetPreferences` [K5].
3. **Sending is safe to retry.** The `Idempotency-Key` header on trigger works for 24h and caches only successful responses, so retrying after a failure is safe [K6]. Keys can come from the domain, for example `refund-decided:<refundId>:<userId>`.
4. **Feed access is secured properly.** The user token is an RS256 JWT with an expiry, signed on the server by `signUserToken`, and the SDK has an `onUserTokenExpiring` callback [K9]. Novu's HMAC hash never expires, and MagicBell's and Courier's examples use long-lived or non-expiring tokens.
5. **A headless client is first-class.** `@knocklabs/client` gives a FeedClient with a store, cursor pagination, status changes and real-time events [K2][K3]. Cadence can build its own React Notification Feed on top of it.

## Caveats to carry into the map

- **Web push needs Firebase.** Web push goes through FCM [K7]: a Firebase project, `firebase-messaging-sw.js`, and the FCM token stored as channel data. If web push makes the cut, this is a second sign-up. MagicBell and SuprSend are the only candidates with native VAPID, and each fails a higher-priority criterion: MagicBell's free tier is 1,000 deliveries, and SuprSend's Free plan has no preferences.
- **Cross-device read state isn't pushed.** The socket pushes only `new-message`, which carries badge counts [K4]. A read on another device appears when the feed is next fetched, for example on focus or navigation. Tabs in the same browser can use the experimental BroadcastChannel option [K3].
- **Email needs a provider for production.** The Knock test provider covers development [K8].
- **Paid plans start at $250 a month.** Starter is $250/mo [K1]. At modest scale the free tier may last a long time. If cost is decisive, Novu Pro at $30/mo is the cheap path.
- **Turn on enhanced security mode before production.** Without it, the public key can act as any user [K9].

## Runner-up: Novu Cloud

Novu passes nearly every criterion and is much cheaper at modest scale: Pro starts at $30/mo [N1]. It pushes `unread_count_changed` over the socket [N2] and uses the `Idempotency-Key` header [N4]. It loses to Knock on three points:

- **Workflow cap.** The free tier allows only 5 workflows [N1].
- **Weaker feed security.** The HMAC subscriber hash never expires [N6].
- **Idempotency may be off.** The docs note it may need enabling per organisation [N4].

## Ruled out

- **SuprSend.** Preferences are paywalled to Business at $250/mo [S1].
- **MagicBell.** The free tier is only 1,000 deliveries, and each channel counts separately [M1].
- **Courier.** It is viable, but it bills every send once you leave the free tier, and browser push is OneSignal-first [C1][C4]. It offers no advantage over Knock for this brief.

## Sources

- [K1] Knock pricing: https://knock.app/pricing
- [K2] @knocklabs/client README: https://github.com/knocklabs/javascript/blob/main/packages/client/README.md
- [K3] Knock FeedClient reference: https://docs.knock.app/in-app-ui/javascript/sdk/feed-client, and the React feed docs (`__experimentalCrossBrowserUpdates`): https://docs.knock.app/in-app-ui/react/feed
- [K4] Knock in-app APIs and real-time service: https://docs.knock.app/in-app-ui/api-overview
- [K5] Knock preferences overview: https://docs.knock.app/preferences/overview
- [K6] Knock API overview (idempotency): https://docs.knock.app/api-reference/overview; trigger: https://docs.knock.app/api-reference/workflows/trigger
- [K7] Knock web push with FCM: https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm
- [K8] Knock email integrations: https://docs.knock.app/integrations/email/overview
- [K9] Knock security and authentication: https://docs.knock.app/in-app-ui/security-and-authentication
- [N1] Novu pricing: https://novu.co/pricing
- [N2] @novu/js: https://docs.novu.co/platform/sdks/javascript
- [N3] Novu preferences: https://docs.novu.co/platform/concepts/preferences
- [N4] Novu idempotency: https://docs.novu.co/api-reference/idempotency; trigger: https://docs.novu.co/platform/concepts/trigger
- [N5] Novu push providers: https://docs.novu.co/platform/integrations/push
- [N6] Novu Inbox production (HMAC): https://docs.novu.co/platform/inbox/prepare-for-production
- [C1] Courier pricing: https://www.courier.com/pricing
- [C2] Courier Inbox authentication: https://www.courier.com/docs/platform/inbox/authentication
- [C3] Courier API overview (idempotency): https://www.courier.com/docs/reference/api-overview
- [C4] Courier push providers: https://www.courier.com/docs/integrations/push/overview
- [M1] MagicBell pricing: https://www.magicbell.com/pricing
- [M2] MagicBell docs: https://www.magicbell.com/docs
- [M3] MagicBell API v2 reference: https://www.magicbell.com/docs/api/reference
- [M4] MagicBell REST API v1 (idempotency): https://www.magicbell.com/docs/rest-api/reference
- [M5] MagicBell web push channel: https://www.magicbell.com/docs/channels/web_push
- [M6] MagicBell user JWT: https://www.magicbell.com/docs/api/authentication/user
- [S1] SuprSend pricing: https://www.suprsend.com/pricing
- [S2] SuprSend inbox quick start and trigger: https://docs.suprsend.com/docs/inbox-quick-start, https://docs.suprsend.com/docs/trigger-workflow
