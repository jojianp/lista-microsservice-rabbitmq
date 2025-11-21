const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// diretório e arquivos do banco (JSON)
const dbDir = path.join(__dirname, 'database');
const itemsFile = path.join(dbDir, 'items.json');
const indexFile = path.join(dbDir, 'items_index.json');

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// Categorias utilizadas
const categories = ['Alimentos', 'Limpeza', 'Higiene', 'Bebidas', 'Padaria'];

// Itens iniciais (serão gerados 20 no arquivo aqui)
const sample = [
  // Alimentos
  { name: 'Arroz Integral Orgânico 1kg', category: 'Alimentos', brand: 'VerdeVida', unit: '1kg', averagePrice: 9.5, barcode: '123456000001', description: 'Arroz integral, orgânico, alto rendimento', active: true },
  { name: 'Quinoa Real 500g', category: 'Alimentos', brand: 'NutriQuinoa', unit: '500g', averagePrice: 15.0, barcode: '123456000002', description: 'Quinoa premium, fonte de proteína', active: true },
  { name: 'Lentilha Vermelha 500g', category: 'Alimentos', brand: 'Saudável', unit: '500g', averagePrice: 7.0, barcode: '123456000003', description: 'Lentilha para sopas e saladas', active: true },
  { name: 'Biscoito Integral Aveia & Mel', category: 'Alimentos', brand: 'FitSnack', unit: '200g', averagePrice: 6.5, barcode: '123456000004', description: 'Biscoito crocante, saudável', active: true },

  // Limpeza
  { name: 'Detergente Ecológico 500ml', category: 'Limpeza', brand: 'EcoClean', unit: '500ml', averagePrice: 4.5, barcode: '123456000005', description: 'Detergente biodegradável', active: true },
  { name: 'Multiuso Concentrado 1L', category: 'Limpeza', brand: 'SuperClean', unit: '1L', averagePrice: 10.0, barcode: '123456000006', description: 'Limpeza geral de superfícies', active: true },
  { name: 'Esponja de Limpeza Antibacteriana', category: 'Limpeza', brand: 'Higienize', unit: 'un', averagePrice: 2.5, barcode: '123456000007', description: 'Esponja durável e antibacteriana', active: true },
  { name: 'Lustra Móveis Natural 300ml', category: 'Limpeza', brand: 'BrilhoPuro', unit: '300ml', averagePrice: 8.0, barcode: '123456000008', description: 'Cera natural para madeira', active: true },

  // Higiene
  { name: 'Sabonete Líquido Aloe Vera 250ml', category: 'Higiene', brand: 'SuaveBio', unit: '250ml', averagePrice: 7.0, barcode: '123456000009', description: 'Hidrata e protege a pele', active: true },
  { name: 'Creme Dental Clareador 90g', category: 'Higiene', brand: 'SorrisoBranco', unit: '90g', averagePrice: 5.5, barcode: '123456000010', description: 'Protege dentes e gengivas', active: true },
  { name: 'Escova Dental Infantil', category: 'Higiene', brand: 'MiniSorriso', unit: 'un', averagePrice: 6.0, barcode: '123456000011', description: 'Escova macia para crianças', active: true },
  { name: 'Desodorante Roll-on 50ml', category: 'Higiene', brand: 'Frescor+', unit: '50ml', averagePrice: 9.5, barcode: '123456000012', description: 'Proteção 24h', active: true },
  
  // Bebidas
  { name: 'Chá Verde Orgânico 20 sachês', category: 'Bebidas', brand: 'VerdeVida', unit: '20un', averagePrice: 12.0, barcode: '123456000013', description: 'Chá antioxidante, folhas selecionadas', active: true },
  { name: 'Suco de Uva Integral 1L', category: 'Bebidas', brand: 'Frutal', unit: '1L', averagePrice: 7.5, barcode: '123456000014', description: 'Sem adição de açúcar', active: true },
  { name: 'Água Mineral com Gás 500ml', category: 'Bebidas', brand: 'Crystal', unit: '500ml', averagePrice: 2.0, barcode: '123456000015', description: 'Água gasosa natural', active: true },
  { name: 'Café Torrado em Grãos 250g', category: 'Bebidas', brand: 'Café Premium', unit: '250g', averagePrice: 15.0, barcode: '123456000016', description: 'Grãos selecionados, sabor intenso', active: true },

  // Padaria
  { name: 'Pão Integral de Linhaça 1un', category: 'Padaria', brand: 'Panito', unit: 'un', averagePrice: 4.5, barcode: '123456000017', description: 'Pão saudável, rico em fibras', active: true },
  { name: 'Croissant de Chocolate', category: 'Padaria', brand: 'Boulanger', unit: 'un', averagePrice: 3.8, barcode: '123456000018', description: 'Massa amanteigada recheada', active: true },
  { name: 'Baguete Francesa 300g', category: 'Padaria', brand: 'Pães & Cia', unit: '300g', averagePrice: 5.0, barcode: '123456000019', description: 'Pão crocante tradicional', active: true },
  { name: 'Torrada Integral 200g', category: 'Padaria', brand: 'FitSnack', unit: '200g', averagePrice: 6.0, barcode: '123456000020', description: 'Torrada crocante integral', active: true }
];

const items = sample.map(s => ({
  id: uuidv4(),
  ...s,
  createdAt: new Date().toISOString()
}));

fs.writeFileSync(itemsFile, JSON.stringify(items, null, 2), 'utf8');

const index = items.reduce((acc, it) => {
  acc[it.id] = { id: it.id };
  return acc;
}, {});
fs.writeFileSync(indexFile, JSON.stringify(index, null, 2), 'utf8');

console.log('Seed de items criada:', itemsFile);
