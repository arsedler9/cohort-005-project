# Research: Can Cadence send web push without a mobile app?

Ticket: #4 (map #2, "Notifications in Cadence"). Researched 2026-11-18 against primary sources (MDN, WebKit blog, Apple Developer, Chrome/Chromium blogs, Mozilla blog, IETF RFCs).

## Conclusion

Web push does not need a native app. It works on desktop Chrome, Edge, Firefox and Safari, and on Android browsers, with no app-store presence and no Apple Developer account. It **cannot reach most iPhone/iPad users, though**. On iOS/iPadOS, web push works only after the person adds Cadence to their Home Screen as a web app with a manifest, and then grants permission from a tap inside that installed app. A plain Safari or Chrome tab on iOS never gets push. Every platform also needs an explicit opt-in tied to a user gesture, and delivery is best-effort: if the desktop browser is fully quit, nothing arrives until it restarts, and subscriptions expire silently.

**Recommendation (not a decision):** make **email the default second channel**, because it reaches every Cadence user on every device with no opt-in. Treat web push as an **optional, opt-in third channel** that people turn on from Settings. It suits desktop users and Android/installed-PWA users. It should not be the only channel for anything that matters, such as refund decisions or Seat claims. The in-app Notification Feed stays the record of what happened. Push and email only point people to it.

## 1. Platform support

| Platform | Web push? | Conditions | Source |
| --- | --- | --- | --- |
| Push API overall | Baseline "Widely available", "available across browsers since March 2023" | Needs an active service worker and a secure context (HTTPS) | [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [MDN subscribe()](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe) |
| Chrome / Edge (desktop and Android) | Yes | Reject `subscribe()` unless `userVisibleOnly: true` | [MDN subscribe()](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe) |
| Firefox | Yes | Permission prompt requires a user gesture (since Fx 72). Silent pushes are under a quota; pushes that show a notification are exempt | [Mozilla blog](https://blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox/), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API) |
| Safari macOS | Yes, Safari 16+ on macOS 13 Ventura+ (WebKit's "Meet Web Push"; the 18.4 post dates the first shipped release to 16.1). Arrives even when Safari isn't running | Standard Push API + VAPID. No Apple Developer Program membership needed. Requires a user gesture and `userVisibleOnly: true` | [WebKit: Meet Web Push](https://webkit.org/blog/12945/meet-web-push/), [WebKit: Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/) |
| Safari / any browser on iOS & iPadOS | **Only for Home Screen web apps**, iOS/iPadOS 16.4+ | The site must serve a manifest with `display: standalone` or `fullscreen` (otherwise it is saved as a plain bookmark). The person must add it to the Home Screen; third-party browsers can do this too. Permission must be requested "in response to direct user interaction" | [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) |
| iOS in the EU | Home Screen web apps were removed in the iOS 17.4 betas, then restored in iOS 17.4 | Still WebKit-only | [Apple: DMA and apps in the EU](https://developer.apple.com/support/dma-and-apps-in-the-eu/) |

Newer option: **Declarative Web Push** (iOS/iPadOS 18.4 Home Screen apps; macOS with Safari 18.5). The push payload is JSON (`"web_push": 8030`, with a `notification` containing `title` and `navigate`) and the browser shows it without a service worker. `window.pushManager` handles subscriptions. It is Safari-only so far and has been proposed for standardisation, so Cadence would still need the service-worker path for other browsers. Sources: [WebKit: Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/), [WebKit: Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/), [WebKit: Safari 18.5](https://webkit.org/blog/16923/webkit-features-in-safari-18-5/).

**What this means for Cadence:** a course platform used "mostly on desktop + mobile web" can reach desktop users and Android users. iPhone users in a browser tab cannot be reached, and installing a Home Screen web app is a step few people will take for a course site.

## 2. Permission-prompt rules

- **A user gesture is required everywhere that matters.** Firefox 72+ shows only a small URL-bar icon if the prompt comes without a tap, click or keypress ([Mozilla](https://blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox/)). Safari requires "an explicit user gesture" ([WebKit](https://webkit.org/blog/12945/meet-web-push/)), and so does iOS ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). MDN advises calling `subscribe()` from a click handler ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)).
- **Acceptance is low unless the prompt follows a clear action.** Mozilla measured about 99% of prompts not accepted ("for each prompt that is accepted, sixty are denied or ignored"), versus 56% acceptance when the prompt followed user interaction. Mozilla recommends an in-page "pre-prompt" that does not mimic browser UI ([Mozilla](https://blog.mozilla.org/futurereleases/2019/11/04/restricting-notification-permission-prompts-in-firefox/)).
- **Chrome's abuse heuristics:**
  - Chrome 80 added a quieter prompt for sites with low accept rates. Chrome 84 auto-enrols abusive sites ([New in Chrome 84](https://developer.chrome.com/blog/new-in-chrome-84)).
  - Enrolment is per device type ([CrUX notification data](https://developer.chrome.com/blog/notification-permission-data-in-crux)).
  - In the quiet UI, the site gets only a bell icon in the address bar ([Chrome Help](https://support.google.com/chrome/answer/3220216)).
  - Since October 2025, Chrome auto-revokes the permission for low-engagement, high-volume sites, but not for installed web apps ([Chromium blog](https://blog.chromium.org/2025/10/automatic-notification-permission.html)).
  - Since January 2026, Chrome rate-limits pushes (HTTP 429) for sites that send many notifications without engagement. It says "nearly all websites will be unaffected" ([Chrome: web push rate limits](https://developer.chrome.com/blog/web-push-rate-limits)).
- **Silent push is not allowed.** Every push must show a visible notification. Safari revokes subscriptions that break the `userVisibleOnly` promise ([WebKit](https://webkit.org/blog/12945/meet-web-push/)).

For Cadence, this means the opt-in belongs behind an explicit "Turn on browser notifications" button, for example in Settings or after a relevant action. It should not be a prompt on page load. Volume should stay at event notifications only, which matches the map's scope.

## 3. What a React Router 8 Node app would need

1. **HTTPS** in every non-localhost environment. Push is limited to secure contexts ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)).
2. **A service worker** served from the site origin, for example `public/sw.js` (Cadence's `public/` folder is served statically). It needs a `push` handler that calls `registration.showNotification(...)` inside `event.waitUntil`, a `notificationclick` handler that opens the deep link (for example, the Notification Feed), and a `pushsubscriptionchange` handler that re-subscribes and tells the server ([MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)).
3. **A web app manifest** with `display: "standalone"` and a stable `id`. iOS requires it to treat the site as a pushable web app, and iOS uses the manifest `id` to sync Focus settings across devices ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). It would be linked from the root layout.
4. **VAPID keys:** an ECDSA P-256 key pair. The public key goes to `subscribe({ applicationServerKey })`. The server signs an ES256 JWT with `aud` set to the push-service origin, `exp` at most 24h ahead, and `sub` set to a `mailto:`/`https:` contact, sent as `Authorization: vapid t=<JWT>, k=<pubkey>` ([RFC 8292](https://www.rfc-editor.org/rfc/rfc8292), [MDN subscribe()](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)). The private key is a server secret, one per environment.
5. **Subscription storage:** a table keyed by user, holding `endpoint`, the `p256dh` and `auth` keys, `expirationTime`, and the user agent. A person can have many subscriptions, one per browser or device. The endpoint is a capability URL and must be kept secret. MDN also warns to protect the subscribe endpoint against CSRF ([MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)).
6. **A sender:** payload encryption (RFC 8291) plus VAPID, using the `web-push` npm library or a hosted vendor. A hosted notification vendor would normally own items 4, 5 and 6, which fits the map's "one hosted vendor" destination. Cadence would then ship only the service worker, the manifest and the opt-in UI.

## 4. Reliability caveats

- **The desktop browser must be running.** Chrome delivers with no windows open, but "the only time a push won't be received is when the browser is completely closed" ([web.dev push FAQ](https://web.dev/articles/push-notifications-faq)). Android and macOS Safari are woken by the OS ([web.dev](https://web.dev/articles/push-notifications-faq), [WebKit](https://webkit.org/blog/12945/meet-web-push/)).
- **TTL decides what happens offline.** Every send must set `TTL`. If it elapses, the message is dropped and never delivered, and `TTL: 0` messages are lost if the device is offline ([RFC 8030 §5.2](https://www.rfc-editor.org/rfc/rfc8030)). `Topic` lets a newer message replace an undelivered one, which is useful for collapsing bursts (§5.4). `Urgency` hints priority (§5.3).
- **Subscriptions expire and get revoked.** `expirationTime` may be set, or it may be `null` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription/expirationTime)). Sends to an expired subscription return 404 under RFC 8030 §7.3, and push services commonly return 410 as well. The server must delete subscriptions on 404/410. Users can also revoke permission at any time, and browsers auto-revoke for abuse (section 2).
- **There is no delivery receipt you can rely on** for typical sends, and a lost push gives no signal. Anything important must also live in the Notification Feed, and email if needed.

## Open points for the map

- If push is adopted, the preferences model needs a per-device "push enabled" state alongside per-kind and per-channel preferences.
- Check whether the chosen vendor supports web push natively (VAPID, subscription storage, 404/410 cleanup) before planning to build it.
- Data is needed on what share of Cadence traffic is iOS-in-browser, since that share cannot be reached by push.
