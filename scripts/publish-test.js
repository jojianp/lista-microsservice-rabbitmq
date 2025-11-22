require('dotenv').config();
const amqplib = require('amqplib');

const AMQP_URL = process.env.AMQP_URL || '';
const EXCHANGE = 'shopping_events';
const ROUTING_KEY = 'list.checkout.completed';

(async () => {
  try {
    console.log('Conectando ao broker...');
    const conn = await amqplib.connect(AMQP_URL);
    const ch = await conn.createChannel();
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });

    const message = {
      listId: 'test-123',
      userId: 'user-1',
      userEmail: 'test@example.com',
      items: [{ itemId: 'i1', estimatedPrice: 12.5 }],
      summary: { estimatedTotal: 12.5 },
      timestamp: new Date().toISOString()
    };

    ch.publish(EXCHANGE, ROUTING_KEY, Buffer.from(JSON.stringify(message)), { persistent: true });
    console.log('Mensagem publicada:', ROUTING_KEY, message);

    await ch.close();
    await conn.close();
    process.exit(0);
  } catch (err) {
    console.error('Erro ao publicar mensagem de teste:', err && err.stack ? err.stack : err.message);
    process.exit(1);
  }
})();
