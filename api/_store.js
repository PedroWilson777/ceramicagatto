/**
 * api/_store.js
 * ─────────────────────────────────────────────────────────────────
 * Store compartilhado em memória entre os handlers serverless.
 *
 * ⚠️  Memória de serverless é efêmera (reinicia com cold starts).
 *     Para persistência real, substitua por Upstash Redis ou Vercel KV:
 *     https://vercel.com/docs/storage/vercel-kv
 *
 * Os SEED_PRODUCTS inicializam o catálogo no backend também —
 * edições feitas no painel frontend (index.html) não chegam aqui,
 * pois o painel é puramente frontend.
 * ─────────────────────────────────────────────────────────────────
 */

// Inicializa uma vez por processo serverless
const store = global.__gattoStore || (global.__gattoStore = {
  conversations: [],  // { id, phone, name, status, unread, messages[], createdAt, updatedAt }
  products: [
    { id:'p1', name:'Telha Copeira',           category:'Telhas',  pricePerThousand:1850, stock:18,
      specs:[['Peso por peça','1.800 kg ±'],['Cobertura/milheiro','~14 m²'],['Peças/m²','72 ±']] },
    { id:'p2', name:'Duplan Portuguesa',        category:'Telhas',  pricePerThousand:1980, stock:22,
      specs:[['Peso por peça','2.100 kg ±'],['Cobertura/milheiro','~13 m²'],['Peças/m²','77 ±']] },
    { id:'p3', name:'Colonial',                 category:'Telhas',  pricePerThousand:1750, stock:35,
      specs:[['Peso por peça','1.600 kg ±'],['Cobertura/milheiro','~16 m²'],['Peças/m²','63 ±']] },
    { id:'p4', name:'Plan Gatto',               category:'Telhas',  pricePerThousand:2100, stock:12,
      specs:[['Peso por peça','2.400 kg ±'],['Cobertura/milheiro','~11 m²']] },
    { id:'p5', name:'Lajota 19x19x09',          category:'Lajotas', pricePerThousand:1200, stock:8,
      specs:[['Dimensões','19 × 19 × 9 cm'],['Peças/m²','28 ±'],['Peso/peça','1.200 kg ±']] },
    { id:'p6', name:'Lajota 29x19x09',          category:'Lajotas', pricePerThousand:1450, stock:4,
      specs:[['Dimensões','29 × 19 × 9 cm'],['Peças/m²','18 ±'],['Peso/peça','1.900 kg ±']] },
    { id:'p7', name:'Lajota 29x19x11,5',        category:'Lajotas', pricePerThousand:1780, stock:3,
      specs:[['Dimensões','29 × 19 × 11,5 cm'],['Peças/m²','18 ±'],['Peso/peça','2.200 kg ±']] },
    { id:'p8', name:'Lajota para Laje',          category:'Lajotas', pricePerThousand:980,  stock:45,
      specs:[['Uso','Enchimento de laje'],['Peças/m²','Variável conforme cálculo estrutural']] },
    { id:'p9', name:'Cobogó',                   category:'Cobogós', pricePerThousand:2400, stock:6,
      specs:[['Dimensões','19 × 19 × 9 cm'],['Acabamento','Liso'],['Uso','Ventilação e decoração']] },
  ],
});

module.exports = { store };
