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