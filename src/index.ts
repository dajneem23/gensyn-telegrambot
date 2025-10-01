/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
export interface Env {
	ENV_BOT_TOKEN: string;
	ENV_BOT_SECRET: string;
	ENV_CHAT_ID: string; // Optional, for testing purposes
}

let TOKEN: string
const WEBHOOK = '/webhook'
let SECRET: string
import { ethers } from 'ethers';
/**
 * Handle requests to WEBHOOK
 * https://core.telegram.org/bots/api#update
 */
async function handleWebhook(request: Request): Promise<Response> {
	console.log('Received webhook request:', request)
	// Check secret
	if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== SECRET) {
		return new Response('Unauthorized', { status: 403 })
	}

	// Read request body synchronously
	const update = await request.json()
	// Deal with response asynchronously
	const r = await onUpdate(update)
	console.log('Webhook request processed successfully', JSON.stringify(r))

	return new Response('Ok')
}

/**
 * Handle incoming Update
 * https://core.telegram.org/bots/api#update
 */
async function onUpdate(update: any) {
	console.log('Received update:', JSON.stringify(update))
	if ('message' in update) {
		const r: any = await onMessage(update.message)
		if (!r?.ok) {
			console.error('Error sending message:', r)
			return r;
		}
	}
}
const escapeMarkdown = (text: string) => text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');

/**
 * Handle incoming Message
 * https://core.telegram.org/bots/api#message
 */
async function onMessage(message: any) {
	try {
		console.log('Received message:', message.chat.id, message.text)
		if (message?.from?.is_bot) {
			console.log('Ignoring message from bot:', message.from.id)
			return; // Ignore messages from bots
		}

		if (message.text && message.text.startsWith('/')) {
			const command = message.text.split(' ');
			if (command[ 0 ] === '/start') {
				const txt = escapeMarkdown(`Hello, I am a Gensyn bot . I can provide you with the current status of a Gensyn peer.
				\nAvailable commands:
				\n/status peer_id -- Get the status of a Gensyn peer
				\nExample: /status QmQfPmjJVS42aCJB99TqToVFk1tgaZ4GXnhhWgSWdtnQwq
				\n Powered by Cloudflare Workers, @dajneem23 with ❤️
				`);
				return sendPlainText(message.chat.id, txt);
			} else if (command[ 0 ] === '/status') {
				const id = command[ 1 ];
				if (!id) {
					return sendPlainText(message.chat.id, 'Please provide a peer ID\\.\nex: /status QmQfPmjJVS42aCJB99TqToVFk1tgaZ4GXnhhWgSWdtnQwq');
				}
				return sendGensynUpdate(message.chat.id, id);
			} else if (command[ 0 ] === '/getTotalRewards') {
				const ids = command[ 1 ]?.split(',');
				if (!ids || ids.length === 0) {
					return sendPlainText(message.chat.id, 'Please provide at least one EOA\\.\nex: /getTotalRewards 0xd11fd255107BD39FC143C8FF8dd504e738357d50');
				}
				return sendGensynUpdateTotalRewards(message.chat.id, ids);
			}
			else {
				return sendPlainText(message.chat.id, `Unknown command: ${command[ 0 ]}\n`);
			}
		}

	} catch (error) {
		console.error('Error processing message:', error)
		return sendPlainText(message.chat.id, 'An error occurred while processing your message.')

	}
}


async function sendGensynUpdateTotalRewards(chatId: string, ids: string[]) {
	const method = '0xb894a469'; // Method ID for getTotalRewards
	const addrs = [
		...ids,
	];
	const encodedAddresses = new ethers.AbiCoder().encode(['address[]'], [addrs]);
	const encodedInputData = `${method}${encodedAddresses.slice(2)}`; // Remove '0x' prefix
	const [ data ] = await Promise.race<any>([
		Promise.all([
			fetch("https://gensyn-testnet.g.alchemy.com/public", {
				"headers": {
					"accept": "*/*",
					"accept-language": "en-US,en;q=0.9,vi;q=0.8",
					"content-type": "application/json",
					"priority": "u=1, i",
					"sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Microsoft Edge\";v=\"140\"",
					"sec-ch-ua-mobile": "?0",
					"sec-ch-ua-platform": "\"macOS\"",
					"sec-fetch-dest": "empty",
					"sec-fetch-mode": "cors",
					"sec-fetch-site": "same-site"
				},
				"body": `[{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"eth_call\",\"params\":[{\"data\":\"${encodedInputData}\",\"to\":\"0xFaD7C5e93f28257429569B854151A1B8DCD404c2\",\"value\":\"0x0\"},\"latest\"]}]`,
				"method": "POST",
			}).then(r => r.json()),
		]),
		new Promise((resolve, reject) => {
			setTimeout(() => {
				reject(new Error('Request timed out'));
			}, 60000); // 5 seconds timeout
		})
	])
	const abiDecoder = new ethers.AbiCoder();
	if (!data || !data[0] || !data[0].result) {
		console.error('No data received from Gensyn API:', data);
		return sendPlainText(chatId, 'No data received from Gensyn API. Please check the peer ID and try again.');
	}
	const decodedData = abiDecoder.decode(['int256[]'], data[0].result).toString();
	const totalRewards = decodedData.split(',').map((reward: string, index: number) => `Reward ${addrs[index]}: ${reward}`).join('\n ');
	console.log('Decoded total rewards:', totalRewards);
	const txt = `🎰*EOA:* Total rewards\n
					\\-\\- *Normal Node* \\-\\-
					💰 *Reward:* \`${escapeMarkdown(`${totalRewards}`)}\`
				`;
	console.log('Sending Gensyn update:', txt)
	return sendPlainText(chatId, txt);
}

async function sendGensynUpdate(chatId: string, id: string) {
	const [ dataHard, data ] = await Promise.race<any>([
		Promise.all([
			fetch(`https://dashboard-math-hard.gensyn.ai/api/v1/peer?id=${id}`).then(r => r.json()),
			fetch(`https://dashboard-math.gensyn.ai/api/v1/peer?id=${id}`).then(r => r.json()),
		]),
		new Promise((resolve, reject) => {
			setTimeout(() => {
				reject(new Error('Request timed out'));
			}, 60000); // 5 seconds timeout
		})
	])
	const { peerId, peerName, reward, score, online } = data as any
	const { reward: rewardH, score: scoreH, online: onlineH } = dataHard as any;

	const txt = `🎰*Peer ID:* \n ${escapeMarkdown(`${peerId}`)}\n
				👷‍♂️*Peer Name:* \n${escapeMarkdown(`${peerName}`)}\n
					\\-\\- *Normal Node* \\-\\-
					💰 *Reward:* \`${escapeMarkdown(`${reward}`)}\`
					📊 *Score:* \`${escapeMarkdown(`${score}`)}\`
					🛠*Online:* ${online ? '🟢 Yes' : '🔴 No'}
					\\-\\- *Hard Node* \\-\\-
					💰 *Reward:* \`${escapeMarkdown(`${rewardH}`)}\`
					📊 *Score:* \`${escapeMarkdown(`${scoreH}`)}\`
					🛠*Online:* ${onlineH ? '🟢 Yes' : '🔴 No'}
				`;
	console.log('Sending Gensyn update:', txt)
	return sendPlainText(chatId, txt);
}

/**
 * Send plain text message
 * https://core.telegram.org/bots/api#sendmessage
 */
async function sendPlainText(chatId: string, text: string, parse_mode: string = 'MarkdownV2') {
	return (await fetch(apiUrl('sendMessage', {
		chat_id: chatId,
		text,
		parse_mode,
	}))).json()
}
/**
 * Return url to telegram api, optionally with parameters added
 */
function apiUrl(methodName: string, params: any = null) {
	let query = ''
	if (params) {
		query = '?' + new URLSearchParams(params).toString()
	}
	return `https://api.telegram.org/bot${TOKEN}/${methodName}${query}`
}

var ENV = {} as Env

/**
 * Set webhook to this worker's url
 * https://core.telegram.org/bots/api#setwebhook
 */
async function registerWebhook(requestUrl: any, suffix: any, secret: string) {
	console.log('Registering webhook for', requestUrl, 'with suffix', suffix, 'and secret', secret)
	// https://core.telegram.org/bots/api#setwebhook
	const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`
	const r: any = await (await fetch(apiUrl('setWebhook', { url: webhookUrl, secret_token: secret }))).json()
	console.log('Webhook registered:', r)
	return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2))
}

const COMMANDS = [
	{
		command: 'status',
		description: 'Get current Gensyn status',
	},
]

/**
 * Remove webhook
 * https://core.telegram.org/bots/api#setwebhook
 */
async function unRegisterWebhook() {
	const r: any = await (await fetch(apiUrl('setWebhook', { url: '' }))).json()
	console.log('Webhook unregistered:', r)
	return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2))
}
export default {
	async fetch(request, env, ctx): Promise<Response> {
		ENV = env as Env;
		TOKEN = env.ENV_BOT_TOKEN // Get it from @BotFather https://core.telegram.org/bots#6-botfather
		SECRET = env.ENV_BOT_SECRET // A-Z, a-z, 0-9, _ and -
		console.log('Handle request:', request.method, request.url)
		const url = new URL(request.url);
		switch (url.pathname) {
			case '/message':
				const r = await fetch(apiUrl('sendMessage', {
					...url.searchParams
				}))
				return new Response(await r.text());
			case '/random':
				return new Response(crypto.randomUUID());
			case WEBHOOK:
				return new Response(await (await handleWebhook(request)).text())
			case "/registerWebhook":
				return new Response(await (await registerWebhook(url, WEBHOOK, SECRET)).json());
			case "/unRegisterWebhook":
				return new Response(await (await unRegisterWebhook()).json());
			default:
				return new Response('Not Found', { status: 404 });
		}
	},
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		ctx.waitUntil(sendGensynUpdate(env.ENV_CHAT_ID, `QmQfPmjJVS42aCJB99TqToVFk1tgaZ4GXnhhWgSWdtnQwq`));
	}
} satisfies ExportedHandler<Env>;
