# Cloudflare Telegram Bot for Gensyn

This is a Telegram bot that runs on Cloudflare Workers and provides the status of a Gensyn peer.

## Features

- Get the status of a Gensyn peer by providing a peer ID.
- Get the total rewards for a given Ethereum address.
- Scheduled hourly updates for a specific peer.

## Available Commands

- `/start`: Display a welcome message with available commands.
- `/status <peer_id>`: Get the status of a Gensyn peer.
- `/getTotalRewards <eoa_address>`: Get the total rewards for a given Ethereum address.

## Technologies Used

- [Cloudflare Workers](https://workers.cloudflare.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- [ethers](https://ethers.io/)
- [Vitest](https://vitest.dev/) for testing
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) for deployment

## Setup and Deployment

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/dajneem/cloudflare-telegrambot.git
    cd cloudflare-telegrambot
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Configure environment variables:**

    Rename `wrangler.jsonc.example` to `wrangler.jsonc` and fill in the required values for `ENV_BOT_TOKEN`, `ENV_BOT_SECRET`, and `ENV_CHAT_ID`.

4.  **Deploy the worker:**

    ```bash
    npm run deploy
    ```

## Usage

1.  Start a conversation with the bot on Telegram.
2.  Use the `/start` command to see the available commands.
3.  Use the `/status` command with a peer ID to get the status of a Gensyn peer.
4.  Use the `/getTotalRewards` command with an Ethereum address to get the total rewards.
