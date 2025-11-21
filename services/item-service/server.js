const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

const JsonDatabase = require('../../shared/JsonDatabase');
const registry = require('../../shared/serviceRegistry');

// App Express e middlewares básicos
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 3003;
const JWT_SECRET = process.env.JWT_SECRET || 'user-service-secret-key-puc-minas';

// Banco de dados local (arquivo JSON)
const dbPath = path.join(__dirname, 'database');
const itemsDb = new JsonDatabase(dbPath, 'items');

// Middleware de autenticação
function autenticacao(req, res, next) {
    const cab = req.headers.authorization;
    if (!cab) return res.status(401).json({ erro: 'Token não informado' });
    const partes = cab.split(' ');
    if (partes.length !== 2) return res.status(401).json({ erro: 'Formato de token inválido' });
    const [esq, token] = partes;
    if (!/^Bearer$/i.test(esq)) return res.status(401).json({ erro: 'Tipo de token inválido' });
    jwt.verify(token, JWT_SECRET, (err, dec) => {
        if (err) return res.status(401).json({ erro: 'Token inválido ou expirado' });
        req.usuario = dec;
        next();
    });
}

app.get('/health', (req, res) => res.json({ status: 'ok', servico: 'item-service' }));

app.get('/categories', async (req, res) => {
    try {
        console.log('Acessando endpoint /categories');
        const items = await itemsDb.find();
        console.log('Total de itens encontrados:', items.length);
        
        const categorias = Array.from(new Set(items.map(i => i.category))).sort();
        console.log('Categorias encontradas:', categorias);
        
        res.json(categorias);
    } catch (err) {
        console.error('Erro ao listar categorias (GET /categories):', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

app.get('/items', async (req, res) => {
    try {
        const { category, name, skip, limit } = req.query;
        console.log('📍 Filtro recebido - category:', category);
        
        const filter = {};
        if (category) {
            console.log('🔍 Aplicando filtro de categoria:', category);
            filter.category = category;
        }

        const todosItens = await itemsDb.find();
        console.log('📦 Total de itens no banco:', todosItens.length);
        console.log('🏷️  Categorias únicas:', [...new Set(todosItens.map(i => i.category))]);
        
        console.log('🎯 Filtro aplicado:', filter);
        const itemsFiltrados = await itemsDb.find(filter);
        console.log('✅ Itens encontrados:', itemsFiltrados.length);
        console.log('📋 Itens:', itemsFiltrados.map(i => ({ name: i.name, category: i.category })));
        
        res.json(itemsFiltrados);
    } catch (err) {
        console.error('❌ Erro ao listar itens:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Buscar por id do item
app.get('/items/:id', async (req, res) => {
    try {
        const item = await itemsDb.findById(req.params.id);
        if (!item) return res.status(404).json({ erro: 'Item não encontrado' });
        res.json(item);
    } catch (err) {
        console.error(`Erro ao buscar item por id (${req.params.id}):`, err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Criar novo item 
app.post('/items', autenticacao, async (req, res) => {
    try {
        const data = req.body;
        if (!data.name || !data.category) return res.status(400).json({ erro: 'Os campos name e category são obrigatórios' });
        const item = await itemsDb.create({ ...data, active: data.active !== false });
        res.status(201).json(item);
    } catch (err) {
        console.error('Erro ao criar item (POST /items):', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Atualizar item 
app.put('/items/:id', autenticacao, async (req, res) => {
    try {
        const atualizado = await itemsDb.update(req.params.id, req.body);
        if (!atualizado) return res.status(404).json({ erro: 'Item não encontrado' });
        res.json(atualizado);
    } catch (err) {
        console.error(`Erro ao atualizar item (${req.params.id}):`, err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Busca por termo 
app.get('/search', async (req, res) => {
    try {
        const q = req.query.q || '';
        if (!q) return res.json([]);
        const results = await itemsDb.search(q, ['name', 'brand', 'description', 'category']);
        res.json(results);
    } catch (err) {
        console.error('Erro na busca por termo (GET /search):', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

function registrarServico() {
    try {
        const url = `http://localhost:${PORT}`;
        registry.register('item-service', { url, port: PORT });
        console.log(`Registrando item-service no registry: ${url}`);
    } catch (err) {
        console.error('Falha ao registrar no registry:', err.message);
    }
}

app.get('/debug/items', async (req, res) => {
    try {
        const items = await itemsDb.find();
        res.json({
            total: items.length,
            categories: Array.from(new Set(items.map(i => i.category))),
            items: items
        });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

if (require.main === module) {
    const servidor = app.listen(PORT, () => {
        console.log(`Serviço de itens escutando na porta ${PORT}`);
        registrarServico();
    });

    process.on('SIGINT', () => servidor.close(() => process.exit(0)));
}

module.exports = app;