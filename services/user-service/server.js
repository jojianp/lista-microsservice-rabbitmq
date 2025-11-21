const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const JsonDatabase = require('../../shared/JsonDatabase');
const registry = require('../../shared/serviceRegistry');

// App Express
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Configurações
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'user-service-secret-key-puc-minas';

// Banco de dados (arquivo JSON)
const dbPath = path.join(__dirname, 'database');
const usuariosDb = new JsonDatabase(dbPath, 'users');

// Gera um token JWT simples com dados reduzidos do usuário
function gerarToken(usuario) {
    const payload = { id: usuario.id, email: usuario.email, username: usuario.username };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

// Middleware de autenticação (Bearer token)
function autenticacao(req, res, next) {
    const cabecalho = req.headers.authorization;
    if (!cabecalho) return res.status(401).json({ erro: 'Token não informado' });

    const partes = cabecalho.split(' ');
    if (partes.length !== 2) return res.status(401).json({ erro: 'Formato de token inválido' });

    const [esquema, token] = partes;
    if (!/^Bearer$/i.test(esquema)) return res.status(401).json({ erro: 'Tipo de token inválido' });

    jwt.verify(token, JWT_SECRET, (err, decodificado) => {
        if (err) return res.status(401).json({ erro: 'Token inválido ou expirado' });
        req.usuario = decodificado; // id, email, username
        next();
    });
}

app.get('/health', (req, res) => res.json({ status: 'ok', servico: 'user-service' }));

// Rota: cadastro de usuário
app.post('/auth/register', async (req, res) => {
    try {
        const { email, username, password, firstName, lastName, preferences } = req.body;
        if (!email || !username || !password) {
            return res.status(400).json({ erro: 'É preciso fornecer email, username e senha' });
        }

        // Verificar o tal email único
        const existente = await usuariosDb.findOne({ email });
        if (existente) return res.status(409).json({ erro: 'Email já cadastrado' });

        const senhaHash = await bcrypt.hash(password, 10);
        const usuario = await usuariosDb.create({
            email,
            username,
            password: senhaHash,
            firstName,
            lastName,
            preferences: preferences || {}
        });

        const token = gerarToken(usuario);
        // Remove o campo de senha antes de retornar
        const { password: _, ...usuarioSeguro } = usuario;
        res.status(201).json({ usuario: usuarioSeguro, token });
    } catch (err) {
        console.error('Erro ao cadastrar usuário:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Rota: login (por email ou username)
app.post('/auth/login', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        if ((!email && !username) || !password) return res.status(400).json({ erro: 'Forneça email ou username e a senha' });

        const filtro = email ? { email } : { username };
        const usuario = await usuariosDb.findOne(filtro);
        if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas' });

        const comparou = await bcrypt.compare(password, usuario.password);
        if (!comparou) return res.status(401).json({ erro: 'Credenciais inválidas' });

        const token = gerarToken(usuario);
        const { password: _, ...usuarioSeguro } = usuario;
        res.json({ usuario: usuarioSeguro, token });
    } catch (err) {
        console.error('Erro ao autenticar:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Rota: buscar dados do usuário (protegida)
app.get('/users/:id', autenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const usuario = await usuariosDb.findById(id);
        if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

        const { password: _, ...usuarioSeguro } = usuario;
        res.json(usuarioSeguro);
    } catch (err) {
        console.error('Erro ao buscar usuário:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Rota: atualizar perfil do usuário (só o próprio usuário pode alterar, requer token)
app.put('/users/:id', autenticacao, async (req, res) => {
    try {
        const { id } = req.params;
        const solicitante = req.usuario; // id, email, username
        if (solicitante.id !== id) return res.status(403).json({ erro: 'Acesso negado: só é possível editar seu próprio perfil' });

        const atualizacoes = { ...req.body };
        // Se trocar email, verificar se já não está em uso
        if (atualizacoes.email) {
            const outro = await usuariosDb.findOne({ email: atualizacoes.email });
            if (outro && outro.id !== id) return res.status(409).json({ erro: 'Email já em uso' });
        }

        // Se trouxer senha nova, hash
        if (atualizacoes.password) {
            atualizacoes.password = await bcrypt.hash(atualizacoes.password, 10);
        }

        const atualizado = await usuariosDb.update(id, atualizacoes);
        if (!atualizado) return res.status(404).json({ erro: 'Usuário não encontrado' });

        const { password: _, ...usuarioSeguro } = atualizado;
        res.json(usuarioSeguro);
    } catch (err) {
        console.error('Erro ao atualizar usuário:', err.message);
        res.status(500).json({ erro: 'erro_interno' });
    }
});

// Registra o serviço no registry (arquivo compartilhado)
function registrarServico() {
    try {
        const url = `http://localhost:${PORT}`;
        registry.register('user-service', { url, port: PORT });
    } catch (err) {
        console.error('Falha ao registrar no registry:', err.message);
    }
}

if (require.main === module) {
    const servidor = app.listen(PORT, () => {
        console.log(`Serviço de usuários escutando na porta ${PORT}`);
        registrarServico();
    });

    process.on('SIGINT', () => {
        servidor.close(() => {
            process.exit(0);
        });
    });
}

module.exports = app;
