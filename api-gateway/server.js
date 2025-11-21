const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const axios = require('axios');
const registry = require('../shared/serviceRegistry');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Log opcional em arquivo: defina LOG_TO_FILE=1 para ativar
if (process.env.LOG_TO_FILE === '1') {
  try {
    const ARQUIVO_LOG = process.env.GATEWAY_LOG_FILE || path.join(__dirname, 'gateway.log');
    const fluxo = fs.createWriteStream(ARQUIVO_LOG, { flags: 'a' });

    const escrever = (nivel, argumentos) => {
      try {
        const mensagem = `[${new Date().toISOString()}] ${nivel} ${argumentos.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
        fluxo.write(mensagem);
      } catch (e) { /* ignorar */ }
    };

    const _log = console.log.bind(console);
    const _err = console.error.bind(console);
    const _warn = console.warn.bind(console);

    console.log = (...argumentos) => { _log(...argumentos); escrever('INFO', argumentos); };
    console.error = (...argumentos) => { _err(...argumentos); escrever('ERROR', argumentos); };
    console.warn = (...argumentos) => { _warn(...argumentos); escrever('WARN', argumentos); };

    process.on('uncaughtException', (erro) => {
      console.error('excecao_nao_tratada', erro && erro.stack ? erro.stack : erro);
    });

    process.on('unhandledRejection', (motivo) => {
      console.error('rejeicao_nao_tratada', motivo);
    });
  } catch (e) {
    console.error('Falha ao inicializar logger de arquivo:', e && e.message ? e.message : e);
  }
}

const PORTA = process.env.PORT || 3000;
const TIMEOUT_AXIOS = parseInt(process.env.PROXY_TIMEOUT || '15000', 10);

const circuito = {};
const LIMIAR_CB = parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '3', 10);
const TIMEOUT_CB = parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT || '30000', 10);

function registrarFalha(nomeServico) {
  const agora = Date.now();
  if (!circuito[nomeServico]) circuito[nomeServico] = { falhas: 0, abertoEm: null };
  circuito[nomeServico].falhas += 1;

  if (circuito[nomeServico].falhas >= LIMIAR_CB) {
    circuito[nomeServico].abertoEm = agora;
    console.warn(`Circuito aberto para ${nomeServico}`);
  }
}

function registrarSucesso(nomeServico) {
  if (!circuito[nomeServico]) circuito[nomeServico] = { falhas: 0, abertoEm: null };
  circuito[nomeServico].falhas = 0;
  circuito[nomeServico].abertoEm = null;
}

function estaAberto(nomeServico) {
  const servico = circuito[nomeServico];
  if (!servico || !servico.abertoEm) return false;

  if (Date.now() - servico.abertoEm > TIMEOUT_CB) {
    servico.abertoEm = null;
    servico.falhas = 0;
    return false;
  }
  return true;
}

async function proxyRequisicao(nomeServico, requisicao, resposta) {
  try {
    if (estaAberto(nomeServico)) {
      return resposta.status(503).json({ erro: 'Serviço temporariamente indisponível (circuito aberto)' });
    }

    let servico;
    try {
      servico = registry.discover(nomeServico);
    } catch (erroDescoberta) {
      console.error('Erro de descoberta:', erroDescoberta.message);
      registrarFalha(nomeServico);
      return resposta.status(503).json({ erro: 'Serviço indisponível', detalhe: erroDescoberta.message });
    }

    const pathDoServico = requisicao.originalUrl.replace(/^\/api/, '');
    const urlFinal = `${servico.url}${pathDoServico}`;

    console.log('🔗 URL final:', urlFinal);

    const headersEncaminhados = { ...requisicao.headers };

    const headersParaRemover = [
      'host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding',
      'postman-token', 'cache-control', 'accept', 'user-agent', 'sec-fetch-mode',
      'sec-fetch-site', 'sec-fetch-dest', 'sec-ch-ua', 'sec-ch-ua-mobile', 
      'sec-ch-ua-platform', 'upgrade-insecure-requests', 'origin', 'referer'
    ];

    headersParaRemover.forEach(header => {
      delete headersEncaminhados[header];
    });

    headersEncaminhados['Accept'] = 'application/json';
    headersEncaminhados['Content-Type'] = 'application/json';

    const configuracaoAxios = {
      method: requisicao.method,
      url: urlFinal,
      headers: headersEncaminhados,
      data: requisicao.body,
      timeout: TIMEOUT_AXIOS,
      responseType: 'json',
    };

    console.debug(`Encaminhando ${requisicao.method} ${urlFinal} -> ${nomeServico}`);
    console.debug('Headers encaminhados:', Object.keys(headersEncaminhados));

    if (requisicao.body && Object.keys(requisicao.body).length < 20) {
      console.debug('Corpo encaminhado:', requisicao.body);
    }

    const respostaServico = await axios(configuracaoAxios);
    registrarSucesso(nomeServico);

    console.debug(`Resposta de ${nomeServico}: Status ${respostaServico.status}, Tamanho: ${JSON.stringify(respostaServico.data).length} bytes`);

    resposta.status(respostaServico.status)
      .set(respostaServico.headers)
      .send(respostaServico.data);

  } catch (erro) {
    console.error('Erro no proxy:', erro && erro.message ? erro.message : erro);

    if (erro && erro.stack) console.error(erro.stack);

    try {
      if (erro && typeof erro.toJSON === 'function') {
        console.error('Erro Axios JSON:', JSON.stringify(erro.toJSON()));
      }
    } catch (e) {
      console.error('Erro ao serializar erro.toJSON():', e && e.message);
    }

    if (erro && erro.code) console.error('Código do erro:', erro.code);

    if (erro && erro.response) {
      try { 
        console.error('Status da resposta de erro:', erro.response.status);
        console.error('Headers da resposta de erro:', erro.response.headers);
      } catch (_) { }
      try { 
        console.error('Dados da resposta de erro:', JSON.stringify(erro.response.data));
      } catch (_) {
        console.error('Dados da resposta de erro não serializáveis');
      }
    }

    registrarFalha(nomeServico);

    if (erro.code === 'ECONNRESET') {
      console.error('Conexão resetada pelo host remoto (ECONNRESET) ao comunicar com', nomeServico);
      return resposta.status(502).json({ erro: 'bad_gateway', detalhe: 'Conexão resetada pelo serviço remoto' });
    }

    if (erro.response) {
      return resposta.status(erro.response.status).json(erro.response.data);
    }

    return resposta.status(502).json({ erro: 'bad_gateway', detalhe: erro.message });
  }
}

// Caminhos proxy para os serviços
app.use('/api/auth', (requisicao, resposta) => proxyRequisicao('user-service', requisicao, resposta));
app.use('/api/users', (requisicao, resposta) => proxyRequisicao('user-service', requisicao, resposta));
app.use('/api/items', (requisicao, resposta) => proxyRequisicao('item-service', requisicao, resposta));
app.use('/api/lists', (requisicao, resposta) => proxyRequisicao('list-service', requisicao, resposta));
app.use('/api/categories', (requisicao, resposta) => proxyRequisicao('item-service', requisicao, resposta));

app.get('/api/dashboard', async (requisicao, resposta) => {
  try {
    const servicos = registry.listServices();
    const estatisticas = registry.getStats();

    const dadosDashboard = {
      servicos: servicos,
      estatisticas: estatisticas,
      timestamp: new Date().toISOString(),
      mensagem: "Dashboard do Sistema de Listas de Compras"
    };

    resposta.json(dadosDashboard);
  } catch (erro) {
    resposta.status(500).json({ erro: 'erro_interno' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const consulta = (req.query.q || '').toLowerCase();

    const servicoItens = registry.discover('item-service');
    const respostaItens = await axios.get(`${servicoItens.url}/search`, {
      params: { q: consulta },
      timeout: 5000
    });
    const itensEncontrados = respostaItens.data;

    let listasEncontradas = [];
    try {
      const servicoListas = registry.discover('list-service');
      const respostaListas = await axios.get(`${servicoListas.url}/lists`, {
        timeout: 5000,
        headers: req.headers 
      });
      listasEncontradas = respostaListas.data || [];
    } catch {
      listasEncontradas = [];
    }

    const listasFiltradas = listasEncontradas
      .map(list => {
        const matchNome = list.name.toLowerCase().includes(consulta);

        const itensFiltrados = (list.items || []).filter(item =>
          item.itemName.toLowerCase().includes(consulta)
        );

        if (matchNome || itensFiltrados.length > 0) {
          return {
            ...list,
            items: itensFiltrados
          };
        }
        return null;
      })
      .filter(l => l !== null);

    res.json({
      items: itensEncontrados,
      lists: listasFiltradas
    });

  } catch (erro) {
    console.error('❌ Erro no /api/search:', erro.message);
    res.status(500).json({ erro: 'erro_interno', detalhe: erro.message });
  }
});



app.get('/health', async (requisicao, resposta) => {
  try {
    const servicos = registry.listServices();
    resposta.json({ status: 'ok', gateway: true, servicos });
  } catch (erro) {
    resposta.status(500).json({ erro: 'erro_interno' });
  }
});

app.get('/api/health', async (requisicao, resposta) => {
  try {
    const servicos = registry.listServices();
    resposta.json({ status: 'ok', gateway: true, servicos });
  } catch (erro) {
    resposta.status(500).json({ erro: 'erro_interno' });
  }
});

app.get('/registry', (requisicao, resposta) => {
  try {
    resposta.json(registry.readRegistry ? registry.readRegistry() : registry.listServices());
  } catch (erro) {
    resposta.status(500).json({ erro: 'erro_interno' });
  }
});

app.get('/api/registry', (requisicao, resposta) => {
  try {
    resposta.json(registry.readRegistry ? registry.readRegistry() : registry.listServices());
  } catch (erro) {
    resposta.status(500).json({ erro: 'erro_interno' });
  }
});

if (registry.performHealthChecks) {
  const intervalo = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10);
  setInterval(() => {
    registry.performHealthChecks().catch(erro =>
      console.error('Verificações de saúde falharam:', erro.message)
    );
  }, intervalo);
}

if (require.main === module) {
  app.listen(PORTA, () => console.log(`API Gateway escutando na porta ${PORTA}`));
}

module.exports = app;