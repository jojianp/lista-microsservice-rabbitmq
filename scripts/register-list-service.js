const registry = require('../shared/serviceRegistry');

try {
  const url = 'http://localhost:3002';
  registry.register('list-service', { url, port: 3002 });
  console.log('Script: list-service registrado com sucesso');
} catch (err) {
  console.error('Script: falha ao registrar list-service', err.message);
  process.exit(1);
}
