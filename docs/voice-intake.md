# Voice intake

Lets a mechanic describe a customer, vehicle and job out loud, and have the
form filled and submitted after a spoken confirmation.

## Flow

The API is stateless: **the client holds the draft** between calls.

1. Client turns speech into text (browser Web Speech API / phone STT) — the
   server never receives audio.
2. `POST /api/v1/voice-intake/parse` `{ transcript, draft? }` — merges the new
   speech into the draft. Returns `draft`, `missing[]`, `nextQuestion`
   (read it aloud), `summary` (read back for confirmation), `readyToSubmit`.
   Writes nothing. Repeat until `readyToSubmit` is true; corrections work the
   same way ("no, the year is 2020").
3. Mechanic says yes -> `POST /api/v1/voice-intake/confirm` `{ draft, serviceCenterId? }`.
   Creates owner + vehicle + job card (service record, status `scheduled`).

Both routes are staff-side only (`requireStaffSide`). The center comes from the
caller's StaffProfile; admins must pass `serviceCenterId`.

## Extraction

A free, local open-source model through [Ollama](https://ollama.com):

```bash
ollama pull qwen2.5:3b
```

Config: `VOICE_LLM_BASE_URL`, `VOICE_LLM_MODEL`, `VOICE_LLM_TIMEOUT_MS`
(see `.env.example`). Model output is validated field by field, so a bad value
drops only that field. If Ollama is down, `parse` falls back to regex rules
(plate, phone, odometer, year, fuel, service type) and returns
`extractor: "rules"`; names/make/model then have to be typed.

## Behaviour to know

- Existing vehicle (same registration) -> reused with its current owner.
- New customer -> a password-less walk-in Account with placeholder email
  `walkin-<phone>@walkin.invalid` (the Account model requires a unique email)
  plus an OwnerProfile. It cannot log in.
- `confirm` is not transactional: the three creates run in sequence, so a
  failure part-way can leave an owner/vehicle without a job card. Retrying is
  safe — existing owner/vehicle are reused.
- Required before confirm: customer name + phone, registration, make, model,
  year, fuel type, odometer (km), work description.
