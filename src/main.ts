import { Markup, Telegraf, Context } from 'telegraf'
import { config } from 'dotenv'
import LocalSession = require('telegraf-session-local')
import * as path from 'path'
import words from '../words.json'

// Read env
config()

// Bot context types
interface BotCtx extends Context
{
	sessionDB: {
		get: (string) => any,
		set: (string, any) => ({
			write: () => void
		})
	}
}

// Create bot
const bot = new Telegraf<BotCtx>(process.env['BOT_TOKEN'])
bot.use(new LocalSession<{
	groupChat: number,
	whoPropose: number,
	word: string,
	lb: { user: string, score: number }[]
}>({
	database: path.resolve(__dirname, 'session.json'),
	storage: LocalSession.storageFileAsync,
	state: {
		groupChat: 0, // chat id
		whoPropose: 0, // user id
		word: '',
		lb: []
	}
}).middleware())

// Start event
bot.start(async ctx =>
{
	// if (ctx.sessionDB.get('groupChat') != 0)
	// 	return await ctx.reply('А вот фиг тебе. Я такой уникальный, на один чат заточен')

	await ctx.reply('Объяснений нет. Пиши /go@croco_game_bot и погнали.\n\n' +
		'PS: Кто угадал - тот молодец. Кто Лилит - тот пидарас')
	ctx.sessionDB.set('groupChat', ctx.chat.id).write()

	await ctx.telegram.setMyCommands([
		{ command: 'go', description: 'Начать игру' },
		{ command: 'lb', description: 'Рейтинговая таблица' }
	])
})

// On leaderboard
bot.command('lb', async ctx =>
{
	const data = ctx.sessionDB.get('lb').value().sort((a,b) => a.score > b.score ? -1 : 1)
	const message = ['Топ игроков в крокодила:', '']

	console.log(data)

	for (let i = 0; i < data.length; i++)
		message.push(`${i + 1}. @${data[i].user} — ${data[i].score}`)

	await ctx.reply(message.join('\n'))
})


// Mention event
bot.command('go', async ctx => {
	if (ctx.sessionDB.get('whoPropose') != 0)
		return await ctx.reply('Пиздани себя лопатой. Отгадай сначала прошлое')

	ctx.sessionDB.set('whoPropose', ctx.from.id).write()
	ctx.sessionDB.set('word', words[Math.floor(Math.random() * words.length)]).write()

	await ctx.reply(`Игрок @${ctx.from.username} загадывает слово!`, {
		reply_markup: Markup.inlineKeyboard([[
			{ text: 'Посмотреть слово', callback_data: 'croco_show_word' }
		]]).reply_markup
	})
})

// Show word callback query
bot.action('croco_show_word', async ctx =>
{
	const user = ctx.from.id
	const wp = ctx.sessionDB.get('whoPropose')

	await ctx.answerCbQuery(user == wp ? ctx.sessionDB.get('word') : 'Пошёл(-ла) нахуй, не твоё слово', {
		show_alert: true,
	})
})

// On word
bot.on('message', async ctx =>
{
	if (!('text' in ctx.message))
		return

	const text = ctx.message.text
	const conditions = ctx.sessionDB.get('whoPropose') == 0
		|| ctx.from.id == ctx.sessionDB.get('whoPropose')
		|| ctx.sessionDB.get('word') != text

	if (conditions) return

	await ctx.reply(`@${ctx.from.username} отгадал слово!`)

	const lb = ctx.sessionDB.get('lb').value() as { user: string, score: number }[]
	console.log(lb)

	const ind = lb.findIndex(i => i.user == ctx.from.username)
	if (ind != -1) lb[ind].score++
	else lb.push({ user: ctx.from.username, score: 1 })

	ctx.sessionDB.set('lb', lb).write()
	ctx.sessionDB.set('whoPropose', 0).write()
})

// Setup exit events
const exit = () => bot.stop()
process.on('SIGINT', exit.bind(this))
process.on('SIGTERM', exit.bind(this))

// Launch the bot
bot.launch().catch((e) => {
	console.log('Whooops!')
	console.log(e)
})
