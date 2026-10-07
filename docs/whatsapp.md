# WhatsApp notifications

Vehicle owners receive their updates on WhatsApp in addition to the in-app/email channels. Uses Meta's **WhatsApp Business Cloud API** via plain `fetch` (no SDK). Entirely off until `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` are set (see `.env.example`).

## Flow

```
anything calls notificationService.create({ recipientModel: "Account", ... })
  -> whatsapp.service.queueWhatsAppForNotification()     (no-op if not configured)
  -> "whatsapp" queue, job whatsapp_message               (own queue + worker, workers/index.ts)
  -> jobs/whatsapp.job.ts: load Account.phone, honour opt-out, normalise number, send
  -> result stored on notification.metadata.whatsapp { messageId, status, error }
  -> Meta webhook updates status: sent -> delivered -> read / failed
```

Hooking `notificationService.create` means any update that produces a notification for an Account reaches WhatsApp with no per-call-site code. Currently these produce notifications: service record created / status changed (scheduled, in progress, completed, cancelled), invoice sent (includes PDF link), payment received, invoice overdue, vehicle reminders, subscription expiring.

## Pieces

| File | Role |
|---|---|
| `config/whatsapp.ts` | Graph API calls (text + template), phone normalisation, webhook signature check, health probe |
| `services/whatsapp.service.ts` | Enqueue hook, delivery-status updates, STOP/START handling |
| `jobs/whatsapp.job.ts` | Queue handler `whatsapp_message` |
| `controllers/whatsappWebhook.controller.ts` + `routes/webhook.routes.ts` | `GET/POST /api/v1/webhooks/whatsapp` |

## Setup checklist (when you have a Meta account)

1. Create a WhatsApp Business app, add a phone number, get a permanent access token and the **phone number ID**.
2. Create + get approved a message template with **two body params** (`{{1}}` title, `{{2}}` content) and set `WHATSAPP_NOTIFICATION_TEMPLATE`. Required for business-initiated messages; without it plain text is sent, which Meta only delivers inside a 24h window after the customer last messaged you.
3. Point Meta's webhook at `https://<host>/api/v1/webhooks/whatsapp`, set `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (any string you choose) and `WHATSAPP_APP_SECRET` (the app secret, used to verify `X-Hub-Signature-256`). Subscribe to the `messages` field.
4. Set `WHATSAPP_DEFAULT_COUNTRY_CODE` (default `91`) — numbers stored without a country code get it prepended.

## Opt-out

`Account.preferences.notificationPreferences.whatsapp.enabled` (default `true`). A customer replying `STOP` / `UNSUBSCRIBE` flips it off and gets a confirmation; `START` flips it back on. The account is matched by the last 10 digits of the sender's number against `Account.phone`, so owners need a phone number saved on their account. **Make sure you have consent to message owners before enabling this in production** — default-on is a product decision, not a legal one.

## Not done

- Only `Account` recipients (vehicle owners, tenant owners). Service-center/staff recipients aren't messaged.
- Text/template only; no media. Invoices are shared as a link to the stored PDF.
- No per-notification-type preferences (all-or-nothing opt-out) and no quiet hours.
