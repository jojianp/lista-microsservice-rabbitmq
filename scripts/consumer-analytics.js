require('dotenv').config();
const amqplib = require('amqplib');

const AMQP_URL = process.env.AMQP_URL;
if (!AMQP_URL) {
    console.error('AMQP_URL not set. Create a .env file or set the AMQP_URL environment variable. See .env.example.');
    process.exit(1);
}
const EXCHANGE = 'shopping_events';
const BINDING_KEY = 'list.checkout.#';
const QUEUE = 'checkout_analytics';

async function start() {
    console.log(`Consumer (analytics) pronto — aguardando mensagens na fila '${QUEUE}' (exchange: ${EXCHANGE}, binding: ${BINDING_KEY})`);
    const conn = await amqplib.connect(AMQP_URL);
    const ch = await conn.createChannel();
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(QUEUE, { durable: true });
    await ch.bindQueue(QUEUE, EXCHANGE, BINDING_KEY);

    ch.prefetch(1);
    ch.consume(QUEUE, msg => {
        if (!msg) return;
        try {
            const payload = JSON.parse(msg.content.toString());
            const listId = payload.listId || payload.id || 'unknown';
            const summary = payload.summary || { estimatedTotal: 0 };
            const total = summary.estimatedTotal || (payload.items || []).reduce((s, it) => s + (it.estimatedPrice || 0), 0);
            console.log(`Analytics: lista ${listId} total gasto R$ ${total.toFixed(2)}`);
            ch.ack(msg);
        } catch (err) {
            console.error('Erro ao processar mensagem (analytics):', err.message);
            ch.nack(msg, false, false);
        }
    }, { noAck: false });

    process.on('SIGINT', async () => {
        console.log('Consumer (analytics) encerrando...');
        await ch.close();
        await conn.close();
        process.exit(0);
    });
}

start().catch(err => {
    console.error('Erro no consumer (analytics):', err.message);
    process.exit(1);
});
