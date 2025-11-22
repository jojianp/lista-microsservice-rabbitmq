require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
axios.defaults.timeout = 10000;

async function run() {
  try {
    console.log('Iniciando fluxo para testar checkout via API Gateway');

    // 1) Cria usuário demo
    const email = `demo${Date.now()}@example.com`;
    const username = `user${Date.now()}`;
    console.log('Registrando usuário:', email);
    try {
      await axios.post(`${BASE_URL}/api/auth/register`, {
        email,
        username,
        password: 'SenhaSegura123!'
      });
      console.log('Usuário registrado');
    } catch (err) {
      if (err.response && err.response.status === 409) {
        console.log('Usuário já existe — seguindo para login');
      } else {
        throw err;
      }
    }

    // 2) Login do usuario
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, { email, password: 'SenhaSegura123!' });
    const token = loginRes.data.token;
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    console.log('Login efetuado — token obtido');

    // 3) Cria uma lista
    const listRes = await axios.post(`${BASE_URL}/api/lists`, { name: 'Lista para checkout', description: 'Teste de checkout via gateway' }, auth);
    const listId = listRes.data.id;
    console.log('Lista criada — id:', listId);

    // 4) Busca items e adicionar um item
    const itemsRes = await axios.get(`${BASE_URL}/api/items`, auth);
    const item = itemsRes.data[0];
    if (item) {
      await axios.post(`${BASE_URL}/api/lists/${listId}/items`, { itemId: item.id, quantity: 2 }, auth);
      console.log('Item adicionado à lista:', item.name || item.id);
    } else {
      console.log('Nenhum item disponível para adicionar — continuando mesmo assim');
    }

    // 5) Dispara checkout via API Gateway
    console.log('Disparando checkout para lista', listId);
    const checkoutRes = await axios.post(`${BASE_URL}/api/lists/${listId}/checkout`, {}, auth);
    console.log('Resposta do checkout (status):', checkoutRes.status);
    console.log('Corpo da resposta:', checkoutRes.data);

    console.log('\nFluxo concluído — verifique os consumers para processarem o evento.');
  } catch (err) {
    console.error('Erro no fluxo de checkout:', err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
    process.exit(1);
  }
}

run();
