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

- **AMQP (.env padrão):** Os scripts e o `list-service` carregam automaticamente a URL via `.env`.
- **Start (consumers):** em terminais separados, execute os workers/scripts que escutam o exchange `shopping_events`:

```powershell
node .\scripts\consumer-log.js
node .\scripts\consumer-analytics.js
```

- **Publicar mensagem de teste (unitário):** envie uma mensagem de checkout de exemplo para verificar os consumers rapidamente:

```powershell
node .\scripts\publish-test.js
```

- **Demo end-to-end (recomendado):** O fluxo completo via API Gateway, pode ser testado com o script que: registra/loga o usuario, cria uma lista, adiciona item para essa lista e dispara o `checkout`:

```powershell
node .\scripts\trigger-checkout.js
```