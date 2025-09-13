# Telegram Mini App — CS 1.6 Rental (Stars)

This project provides a minimal end-to-end example of a Telegram **Mini App** paired with a **Bot** that rents temporary Counter-Strike 1.6 servers. Users configure a server in the web app, pay with **Telegram Stars**, and the bot provisions a server on a **Pterodactyl** panel.

## Features
- Single-page web mini app built with vanilla HTML and the Telegram WebApp JS SDK.
- Node.js backend using Express and Grammy that exposes REST endpoints and a Telegram bot.
- Price calculation and Telegram Stars (currency `XTR`) invoicing via `createInvoiceLink`.
- Placeholder provisioning function for a Pterodactyl game server panel.

## Project Structure
```
.
├── server.js                # Express server + Telegram bot
├── provision/pterodactyl.js # Pterodactyl provisioning helper
└── web/                     # Mini app static files
    ├── index.html
    └── app.js
```

## Pricing
The backend computes the total price in Stars as:

```
total = BASE_PRICE_STARS
        + STARS_PER_HOUR * duration
        + STARS_BOT_PER_SLOT * bot_quota
```

`duration` is clamped to 1–72 hours and `bot_quota` to 0–9 slots.

## Environment Variables
Create a `.env` file (see `.env.example`) with the following keys:

```
BOT_TOKEN=                 # Telegram bot token
WEBAPP_URL=                # Public URL to /web/index.html
BASE_PRICE_STARS=50        # (optional) base cost in Stars
STARS_PER_HOUR=25          # (optional) price per hour
STARS_BOT_PER_SLOT=2       # (optional) price per bot slot

PTERO_PANEL_URL=           # Base URL of your Pterodactyl panel
PTERO_API_KEY=             # Admin API key
PTERO_EGG_ID=              # Egg ID for CS 1.6 container
PTERO_LOCATION_ID=         # Location ID to deploy to
PTERO_USER_ID=             # Panel user ID servers are created under
PORT=3000                  # (optional) HTTP port
```

## Running
Install dependencies and start the server:

```
npm install
npm start
```

The Express server serves the mini app at `/web/`, exposes `/api/price` and `/api/invoice` endpoints, and starts the Telegram bot. `/healthz` can be used for simple monitoring.

Use `/start` in the bot to obtain a button that opens the mini app. After a successful Stars payment, the bot triggers `provisionServer` and replies with the server's connection info.

## Provisioning
`provision/pterodactyl.js` contains a minimal function that creates a CS 1.6 server via the Pterodactyl API. Fill in your panel details in the environment variables above. The function currently returns the allocated IP and port and a placeholder RCON password.

## License
Apache-2.0

