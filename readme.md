# Lista de Compras Microservices

Sistema de gerenciamento de listas de compras utilizando **microsserviços** em Node.js com:

- API Gateway
- User Service, Item Service, List Service
- Service Registry
- Banco NoSQL baseado em JSON
- Autenticação JWT
- Circuit breaker e health checks

## Estrutura do Projeto

```

lista-compras-microservices/
├── services/
│   ├── user-service/
│   ├── item-service/
│   └── list-service/
├── api-gateway/
├── shared/
│   ├── JsonDatabase.js
│   └── serviceRegistry.js
└── client-demo.js

````

## Execução

Instalar dependências:

```bash
npm run install:all
````

Executar microsserviços:

```bash
# Terminal 1
npm run start:user

# Terminal 2  
npm run start:item

# Terminal 3
npm run start:list

# Terminal 4
npm run start:gateway

# Terminal 5 - Cliente demo
node client-demo.js
```

**Mensageria — Testes**

- **AMQP (variável):** defina a variável de ambiente `AMQP_URL` com a sua URL AMQPS antes de executar os workers (não inclua a URL neste arquivo; use a sua instância CloudAMQP).

- **Start (consumers):** em terminais separados, execute os workers que escutam o exchange `shopping_events`:

```powershell
node .\scripts\consumer-log.js
node .\scripts\consumer-analytics.js
```

- **Publicar mensagem de teste:** envie uma mensagem de checkout de exemplo para verificar os consumers:

```powershell
node .\scripts\publish-test.js
```