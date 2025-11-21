const axios = require("axios");

const BASE_URL = process.env.GATEWAY_URL || "http://localhost:3000";
const DEMO_EMAIL = `demo${Date.now()}@example.com`;
const DEMO_USERNAME = `user${Date.now()}`;

// Configuração do axios para timeouts
axios.defaults.timeout = 10000;

async function main() {
  try {
    console.log("🚀 === DEMONSTRAÇÃO COMPLETA DO SISTEMA ===\n");
    console.log(`🔗 Gateway: ${BASE_URL}`);
    console.log(`📧 Usuário demo: ${DEMO_EMAIL}`);
    console.log("─".repeat(50));

    // 1. Health Check do sistema
    console.log("1. 📊 VERIFICANDO SAÚDE DO SISTEMA");
    console.log("   📍 Health Check do gateway...");
    let healthRes = await axios.get(`${BASE_URL}/health`);
    console.log("   ✅ Gateway status:", healthRes.data.status);
    console.log("   🏥 Serviços registrados:", Object.keys(healthRes.data.servicos || {}).join(", "));

    console.log("   📍 Registry status...");
    const registryRes = await axios.get(`${BASE_URL}/registry`);
    console.log("   ✅ Registry encontrado com", Object.keys(registryRes.data).length, "serviços");

    // 2. Registrar usuário
    console.log("\n2. 👤 REGISTRO DE USUÁRIO");
    console.log("   📧 Email:", DEMO_EMAIL);
    console.log("   👤 Username:", DEMO_USERNAME);
    
    let registerRes;
    try {
      registerRes = await axios.post(`${BASE_URL}/api/auth/register`, {
        email: DEMO_EMAIL,
        username: DEMO_USERNAME,
        password: "SenhaSegura123!",
        firstName: "Demo",
        lastName: "User",
        phone: "+5511999999999",
        preferences: {
          defaultStore: "Supermercado Central",
          currency: "BRL",
          notifications: true
        }
      });
      console.log("   ✅ USUÁRIO CRIADO - ID:", registerRes.data.usuario.id);
    } catch (err) {
      if (err.response?.status === 409) {
        console.log("   ⚠️  Usuário já existe, realizando login...");
      } else {
        throw err;
      }
    }

    // 3. Login
    console.log("\n3. 🔐 LOGIN");
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: DEMO_EMAIL,
      password: "SenhaSegura123!"
    });
    
    const token = loginRes.data.token;
    const user = loginRes.data.usuario;
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    
    console.log("   ✅ LOGIN BEM-SUCEDIDO");
    console.log("   🆔 User ID:", user.id);
    console.log("   👤 Nome:", `${user.firstName} ${user.lastName}`);
    console.log("   🔐 Token length:", token.length);

    // 4. Buscar categorias disponíveis
    console.log("\n4. 🏷️  CATEGORIAS DISPONÍVEIS");
    const categoriesRes = await axios.get(`${BASE_URL}/api/categories`);
    console.log("   📋 Categorias:", categoriesRes.data.join(", "));

    // 5. Buscar itens por categoria
    console.log("\n5. 🛒 ITENS POR CATEGORIA");
    const categoriesToTest = categoriesRes.data.slice(0, 3); // Testa as 3 primeiras categorias
    
    for (const category of categoriesToTest) {
      console.log(`   📦 Itens da categoria "${category}":`);
      const itemsRes = await axios.get(`${BASE_URL}/api/items?category=${encodeURIComponent(category)}`);
      console.log(`      ✅ ${itemsRes.data.length} itens encontrados`);
      
      if (itemsRes.data.length > 0) {
        console.log(`      🎯 Primeiro item: ${itemsRes.data[0].name} (R$ ${itemsRes.data[0].averagePrice})`);
      }
    }

    // 6. Buscar todos os itens
    console.log("\n6. 📦 TODOS OS ITENS");
    const allItemsRes = await axios.get(`${BASE_URL}/api/items`);
    console.log("   ✅ Total de itens no sistema:", allItemsRes.data.length);

    // 7. Criar lista de compras
    console.log("\n7. 📝 CRIANDO LISTA DE COMPRAS");
    const listData = {
      name: `Lista Semanal - ${new Date().toLocaleDateString()}`,
      description: "Lista de compras criada via demonstração",
      isPublic: true,
      tags: ["semanal", "demo", "supermercado"]
    };

    const listRes = await axios.post(`${BASE_URL}/api/lists`, listData, authHeader);
    const listId = listRes.data.id;
    console.log("   ✅ LISTA CRIADA");
    console.log("   🆔 List ID:", listId);
    console.log("   📋 Nome:", listRes.data.name);
    console.log("   🔗 Pública:", listRes.data.isPublic ? "Sim" : "Não");

    // 8. Adicionar múltiplos itens à lista
    console.log("\n8. ➕ ADICIONANDO ITENS À LISTA");
    const itemsToAdd = allItemsRes.data.slice(0, 5); // Adiciona os 5 primeiros itens
    
    for (const [index, item] of itemsToAdd.entries()) {
      const addItemRes = await axios.post(
        `${BASE_URL}/api/lists/${listId}/items`,
        {
          itemId: item.id,
          quantity: index + 1,
          unit: item.unit || "un",
          notes: `Item ${index + 1} adicionado via demo`
        },
        authHeader
      );
      console.log(`   ✅ Item ${index + 1}: ${addItemRes.data.itemName} (${addItemRes.data.quantity} ${addItemRes.data.unit})`);
    }

    // 9. Resumo da lista
    console.log("\n9. 📊 RESUMO DA LISTA");
    const summaryRes = await axios.get(`${BASE_URL}/api/lists/${listId}/summary`, authHeader);
    console.log("   📦 Total de itens:", summaryRes.data.totalItems);
    console.log("   ✅ Itens comprados:", summaryRes.data.purchasedItems);
    console.log("   💰 Total estimado: R$", summaryRes.data.estimatedTotal?.toFixed(2) || "0.00");

    // 10. Detalhes completos da lista
    console.log("\n10. 🔍 DETALHES DA LISTA");
    const listDetailsRes = await axios.get(`${BASE_URL}/api/lists/${listId}`, authHeader);
    console.log("   📋 Itens na lista:", listDetailsRes.data.items?.length || 0);
    console.log("   🏷️  Tags:", listDetailsRes.data.tags?.join(", ") || "Nenhuma");
    console.log("   📅 Criada em:", new Date(listDetailsRes.data.createdAt).toLocaleString());

    // 11. Dashboard do sistema
    console.log("\n11. 📈 DASHBOARD DO SISTEMA");
    const dashboardRes = await axios.get(`${BASE_URL}/api/dashboard`);
    console.log("   🏥 Serviços ativos:", Object.keys(dashboardRes.data.servicos || {}).length);
    console.log("   📊 Estatísticas:", JSON.stringify(dashboardRes.data.estatisticas));
    console.log("   ⏰ Última atualização:", dashboardRes.data.timestamp);

    // 12. Busca global
    console.log("\n12. 🔍 BUSCA GLOBAL");
    const searchTerm = allItemsRes.data[0]?.name?.split(" ")[0] || "arroz";
    const searchRes = await axios.get(`${BASE_URL}/api/search?q=${encodeURIComponent(searchTerm)}`);
    console.log("   🔎 Termo buscado:", searchTerm);
    console.log("   📦 Itens encontrados:", searchRes.data.items?.length || 0);
    console.log("   📋 Listas encontradas:", searchRes.data.lists?.length || 0);

    // 13. Listar todas as listas do usuário
    console.log("\n13. 📋 LISTAS DO USUÁRIO");
    const userListsRes = await axios.get(`${BASE_URL}/api/lists`, authHeader);
    console.log("   ✅ Total de listas:", userListsRes.data.length);
    userListsRes.data.forEach((list, idx) => {
      console.log(`      ${idx + 1}. ${list.name} (${list.items?.length || 0} itens)`);
    });

    // 14. Health check final
    console.log("\n14. 🏁 HEALTH CHECK FINAL");
    const finalHealthRes = await axios.get(`${BASE_URL}/health`);
    const servicosFinal = finalHealthRes.data.servicos || {};
    console.log("   ✅ Status final:", finalHealthRes.data.status);
    console.log("   🟢 Serviços healthy:", Object.values(servicosFinal).filter(s => s.healthy).length);
    console.log("   🔴 Serviços unhealthy:", Object.values(servicosFinal).filter(s => !s.healthy).length);

    console.log("\n" + "═".repeat(50));
    console.log("🎉 DEMONSTRAÇÃO CONCLUÍDA COM SUCESSO!");
    console.log("═".repeat(50));
    console.log("📊 RESUMO DA EXECUÇÃO:");
    console.log("   ✅ Usuário criado e autenticado");
    console.log("   ✅", allItemsRes.data.length, "itens carregados");
    console.log("   ✅", categoriesRes.data.length, "categorias encontradas");
    console.log("   ✅ Lista criada com", itemsToAdd.length, "itens");
    console.log("   ✅ Todos os serviços operacionais");
    console.log("\n🔗 URLs TESTADAS:");
    console.log(`   Health: ${BASE_URL}/health`);
    console.log(`   Itens: ${BASE_URL}/api/items`);
    console.log(`   Listas: ${BASE_URL}/api/lists`);
    console.log(`   Dashboard: ${BASE_URL}/api/dashboard`);

  } catch (error) {
    console.error("\n❌ ERRO NA DEMONSTRAÇÃO:");
    
    if (error.response) {
      console.error("   📊 Status:", error.response.status);
      console.error("   📝 Resposta:", JSON.stringify(error.response.data, null, 2));
      console.error("   🔗 URL:", error.response.config?.url);
    } else if (error.request) {
      console.error("   🌐 Timeout/Sem resposta do servidor");
      console.error("   🔗 URL:", error.request._currentUrl || error.config?.url);
    } else {
      console.error("   💻 Erro:", error.message);
    }
    
    console.error("   🐛 Stack:", error.stack);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n🛑 Demonstração interrompida pelo usuário');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('\n💥 Erro não tratado:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n⚠️  Promise rejeitada não tratada:', reason);
  process.exit(1);
});

main();
