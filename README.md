# Telegram Mini App — CS 1.6 Rental (Stars)

This is a minimal end-to-end example of a Telegram **Mini App** + **Bot** that lets a user
configure a CS 1.6 server, pay with **Telegram Stars**, and triggers provisioning on **Pterodactyl**.

It includes:
- `web/` – the Mini App (single page, vanilla HTML+JS, uses Telegram WebApp JS SDK).
- `server.js` – Node.js backend with Express + Grammy (Telegram Bot API).
- Dummy Pterodactyl provisioning function (fill in your panel details).
- WebApp data verification and Stars payments via `createInvoiceLink` (currency `XTR`).

> Replace placeholders in `.env.example` with real values.
