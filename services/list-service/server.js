const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

const axios = require('axios');
const JsonDatabase = require('../../shared/JsonDatabase');
const registry = require('../../shared/serviceRegistry');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const PORT = process.env.PORT || 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'user-service-secret-key-puc-minas';

const dbPath = path.join(__dirname, 'database');
const listsDb = new JsonDatabase(dbPath, 'lists');

function autenticacao(req, res, next) {
    const cab = req.headers.authorization;
    if (!cab) return res.status(401).json({ erro: 'Token não informado' });
    const partes = cab.split(' ');
    if (partes.length !== 2) return res.status(401).json({ erro: 'Formato de token inválido' });
    const [esq, token] = partes;
    if (!/^Bearer$/i.test(esq)) return res.status(401).json({ erro: 'Tipo de token inválido' });
    jwt.verify(token, JWT_SECRET, (err, dec) => {
        if (err) return res.status(401).json({ erro: 'Token inválido ou expirado' });
        req.usuario = dec; // id, email, username
        next();
    });
}

app.get('/health', (req, res) => res.json({ status: 'ok', servico: 'list-service' }));

// Criar lista
app.post('/lists', autenticacao, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ erro: 'O campo name é obrigatório' });
        const usuario = req.usuario;
        const nova = await listsDb.create({
            userId: usuario.id,
            name,
            description: description || '',
            status: 'active',
            items: [],
            summary: { totalItems: 0, purchasedItems: 0, estimatedTotal: 0 }
        });
        res.status(201).json(nova);
    } catch (err) {
        console.error('Erro ao criar lista:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Listar listas do usuário
app.get('/lists', autenticacao, async (req, res) => {
    try {
        const usuario = req.usuario;
        const listas = await listsDb.find({ userId: usuario.id });
        res.json(listas);
    } catch (err) {
        console.error('Erro ao listar listas:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Buscar lista por id (verifica propriedade)
app.get('/lists/:id', autenticacao, async (req, res) => {
    try {
        const lista = await listsDb.findById(req.params.id);
        if (!lista) return res.status(404).json({ erro: 'Lista não encontrada' });
        if (lista.userId !== req.usuario.id) return res.status(403).json({ erro: 'Acesso negado' });
        res.json(lista);
    } catch (err) {
        console.error('Erro ao buscar lista:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Atualizar lista (nome / descrição)
app.put('/lists/:id', autenticacao, async (req, res) => {
    try {
        const lista = await listsDb.findById(req.params.id);
        if (!lista) return res.status(404).json({ erro: 'Lista não encontrada' });
        if (lista.userId !== req.usuario.id) return res.status(403).json({ erro: 'Acesso negado' });
        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        if (req.body.description) updates.description = req.body.description;
        const atualizado = await listsDb.update(req.params.id, updates);
        res.json(atualizado);
    } catch (err) {
        console.error('Erro ao atualizar lista:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Deletar lista
app.delete('/lists/:id', autenticacao, async (req, res) => {
    try {
        const lista = await listsDb.findById(req.params.id);
        if (!lista) return res.status(404).json({ erro: 'Lista não encontrada' });
        if (lista.userId !== req.usuario.id) return res.status(403).json({ erro: 'Acesso negado' });
        await listsDb.delete(req.params.id);
        res.status(204).send();
    } catch (err) {
        console.error('Erro ao deletar lista:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Adicionar item à lista - busca dados no Item Service via registry
app.post('/lists/:id/items', autenticacao, async (req, res) => {
    try {
        const lista = await listsDb.findById(req.params.id);
        if (!lista) return res.status(404).json({ erro: 'Lista não encontrada' });
        if (lista.userId !== req.usuario.id) return res.status(403).json({ erro: 'Acesso negado' });

        const { itemId, quantity, unit, notes } = req.body;
        if (!itemId || !quantity) return res.status(400).json({ erro: 'itemId e quantity são obrigatórios' });

        const itemService = registry.discover('item-service');
        const itemUrl = `${itemService.url}/items/${itemId}`;
        const resp = await axios.get(itemUrl, { timeout: 5000 });
        const itemData = resp.data;

        const added = {
            itemId: itemData.id,
            itemName: itemData.name,
            quantity,
            unit: unit || itemData.unit || 'un',
            estimatedPrice: (itemData.averagePrice || 0) * quantity,
            purchased: false,
            notes: notes || '',
            addedAt: new Date().toISOString()
        };

        lista.items.push(added);
        lista.summary.totalItems = lista.items.length;
        lista.summary.purchasedItems = lista.items.filter(i => i.purchased).length;
        lista.summary.estimatedTotal = lista.items.reduce((s, it) => s + (it.estimatedPrice || 0), 0);

        await listsDb.update(req.params.id, lista);
        res.status(201).json(added);
    } catch (err) {
        console.error('Erro ao adicionar item à lista:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Atualizar item na lista (quantidade, purchased, notes)
app.put('/lists/:id/items/:itemId', autenticacao, async (req, res) => {
    try {
        const lista = await listsDb.findById(req.params.id);
        if (!lista) return res.status(404).json({ erro: 'Lista não encontrada' });
        if (lista.userId !== req.usuario.id) return res.status(403).json({ erro: 'Acesso negado' });

        const item = lista.items.find(i => i.itemId === req.params.itemId);
        if (!item) return res.status(404).json({ erro: 'Item não encontrado na lista' });

        if (req.body.quantity !== undefined) {
            item.quantity = req.body.quantity;
            const maybePricePerUnit = item.estimatedPrice && item.quantity ? item.estimatedPrice / (item.quantity || 1) : null;
            if (maybePricePerUnit) item.estimatedPrice = maybePricePerUnit * item.quantity;
        }
        if (req.body.purchased !== undefined) item.purchased = !!req.body.purchased;
        if (req.body.notes !== undefined) item.notes = req.body.notes;

        lista.summary.totalItems = lista.items.length;
        lista.summary.purchasedItems = lista.items.filter(i => i.purchased).length;
        lista.summary.estimatedTotal = lista.items.reduce((s, it) => s + (it.estimatedPrice || 0), 0);

        await listsDb.update(req.params.id, lista);
        res.json(item);
    } catch (err) {
        console.error('Erro ao atualizar item da lista:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Remover item da lista
app.delete('/lists/:id/items/:itemId', autenticacao, async (req, res) => {
    try {
        const lista = await listsDb.findById(req.params.id);
        if (!lista) return res.status(404).json({ erro: 'Lista não encontrada' });
        if (lista.userId !== req.usuario.id) return res.status(403).json({ erro: 'Acesso negado' });

        const idx = lista.items.findIndex(i => i.itemId === req.params.itemId);
        if (idx === -1) return res.status(404).json({ erro: 'Item não encontrado na lista' });
        lista.items.splice(idx, 1);

        // atualizar summary
        lista.summary.totalItems = lista.items.length;
        lista.summary.purchasedItems = lista.items.filter(i => i.purchased).length;
        lista.summary.estimatedTotal = lista.items.reduce((s, it) => s + (it.estimatedPrice || 0), 0);

        await listsDb.update(req.params.id, lista);
        res.status(204).send();
    } catch (err) {
        console.error('Erro ao remover item da lista:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Resumo da lista
app.get('/lists/:id/summary', autenticacao, async (req, res) => {
    try {
        const lista = await listsDb.findById(req.params.id);
        if (!lista) return res.status(404).json({ erro: 'Lista não encontrada' });
        if (lista.userId !== req.usuario.id) return res.status(403).json({ erro: 'Acesso negado' });
        res.json(lista.summary || { totalItems: 0, purchasedItems: 0, estimatedTotal: 0 });
    } catch (err) {
        console.error('Erro ao obter resumo da lista:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

function registrarServico() {
    try {
        const url = `http://localhost:${PORT}`;
        registry.register('list-service', { url, port: PORT });
    } catch (err) {
        console.error('Falha ao registrar no registry:', err.message);
    }
}

if (require.main === module) {
    const servidor = app.listen(PORT, () => {
        console.log(`List Service escutando na porta ${PORT}`);
        registrarServico();
    });

    process.on('SIGINT', () => servidor.close(() => process.exit(0)));
}

module.exports = app;
