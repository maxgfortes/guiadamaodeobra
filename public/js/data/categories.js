/**
 * Service taxonomy (static, versioned with the app).
 *
 *   Base Category → Groups → Specifications (niches)
 *
 * Specification ids are globally unique: they are what professionals store
 * in Firestore (`professionals.specs: string[]`) and what list queries use.
 * Keeping the tree in code makes navigation instant and costs zero reads.
 * To add a niche, append it here — never rename an existing id.
 */
export const CATEGORIES = [
  {
    id: 'reformas', name: 'Reformas e Construção', short: 'Reformas', icon: 'hammer', color: '#ff9500',
    groups: [
      { id: 'construcao', name: 'Construção', specs: [
        { id: 'pedreiro', name: 'Pedreiro' },
        { id: 'mestre-de-obras', name: 'Mestre de obras' },
        { id: 'azulejista', name: 'Azulejista' },
        { id: 'servente', name: 'Servente de obras' },
      ] },
      { id: 'acabamento', name: 'Acabamento', specs: [
        { id: 'pintor', name: 'Pintor' },
        { id: 'gesseiro', name: 'Gesseiro / Drywall' },
        { id: 'marceneiro', name: 'Marceneiro' },
        { id: 'vidraceiro', name: 'Vidraceiro' },
      ] },
      { id: 'telhados', name: 'Telhados e Estruturas', specs: [
        { id: 'telhadista', name: 'Telhadista' },
        { id: 'calhas', name: 'Calhas e rufos' },
        { id: 'serralheiro', name: 'Serralheiro' },
      ] },
    ],
  },
  {
    id: 'eletrica-hidraulica', name: 'Elétrica e Hidráulica', short: 'Elétrica', icon: 'bolt', color: '#ffcc00',
    groups: [
      { id: 'eletrica', name: 'Elétrica', specs: [
        { id: 'eletricista', name: 'Eletricista residencial' },
        { id: 'eletricista-predial', name: 'Eletricista predial' },
        { id: 'instalacao-chuveiro', name: 'Instalação de chuveiro' },
        { id: 'energia-solar', name: 'Energia solar' },
      ] },
      { id: 'hidraulica', name: 'Hidráulica', specs: [
        { id: 'encanador', name: 'Encanador' },
        { id: 'desentupidor', name: 'Desentupimento' },
        { id: 'caixa-dagua', name: 'Limpeza de caixa d’água' },
        { id: 'aquecedor', name: 'Aquecedor a gás' },
      ] },
      { id: 'climatizacao', name: 'Climatização', specs: [
        { id: 'ar-condicionado', name: 'Ar-condicionado' },
        { id: 'refrigeracao', name: 'Geladeira e freezer' },
      ] },
    ],
  },
  {
    id: 'casa', name: 'Limpeza e Casa', short: 'Casa', icon: 'broom', color: '#30b0c7',
    groups: [
      { id: 'limpeza', name: 'Limpeza', specs: [
        { id: 'diarista', name: 'Diarista' },
        { id: 'faxina-pos-obra', name: 'Faxina pós-obra' },
        { id: 'limpeza-estofados', name: 'Limpeza de estofados' },
        { id: 'passadeira', name: 'Passadeira' },
      ] },
      { id: 'manutencao', name: 'Manutenção', specs: [
        { id: 'marido-de-aluguel', name: 'Marido de aluguel' },
        { id: 'chaveiro', name: 'Chaveiro' },
        { id: 'dedetizacao', name: 'Dedetização' },
      ] },
      { id: 'cuidadores', name: 'Cuidadores', specs: [
        { id: 'baba', name: 'Babá' },
        { id: 'cuidador-idosos', name: 'Cuidador de idosos' },
        { id: 'cozinheira', name: 'Cozinheira' },
      ] },
    ],
  },
  {
    id: 'jardim', name: 'Jardim e Piscina', short: 'Jardim', icon: 'leaf', color: '#34c759',
    groups: [
      { id: 'jardinagem', name: 'Jardinagem', specs: [
        { id: 'jardineiro', name: 'Jardineiro' },
        { id: 'paisagista', name: 'Paisagista' },
        { id: 'poda', name: 'Poda de árvores' },
      ] },
      { id: 'piscina', name: 'Piscina', specs: [
        { id: 'piscineiro', name: 'Piscineiro' },
      ] },
    ],
  },
  {
    id: 'automotivo', name: 'Automotivo', short: 'Auto', icon: 'car', color: '#007aff',
    groups: [
      { id: 'mecanica', name: 'Mecânica', specs: [
        { id: 'mecanico', name: 'Mecânico' },
        { id: 'auto-eletrica', name: 'Auto elétrica' },
        { id: 'funilaria', name: 'Funilaria e pintura' },
      ] },
      { id: 'estetica-auto', name: 'Estética automotiva', specs: [
        { id: 'lavagem', name: 'Lavagem a domicílio' },
        { id: 'polimento', name: 'Polimento e vitrificação' },
      ] },
      { id: 'socorro', name: 'Socorro', specs: [
        { id: 'guincho', name: 'Guincho' },
        { id: 'borracheiro', name: 'Borracheiro' },
      ] },
    ],
  },
  {
    id: 'tecnologia', name: 'Tecnologia', short: 'Tecnologia', icon: 'laptop', color: '#5856d6',
    groups: [
      { id: 'informatica', name: 'Informática', specs: [
        { id: 'tecnico-informatica', name: 'Técnico de informática' },
        { id: 'redes', name: 'Redes e Wi-Fi' },
        { id: 'cftv', name: 'Câmeras e alarmes' },
      ] },
      { id: 'eletronicos', name: 'Eletrônicos', specs: [
        { id: 'conserto-celular', name: 'Conserto de celular' },
        { id: 'conserto-tv', name: 'Conserto de TV' },
      ] },
      { id: 'digital', name: 'Serviços digitais', specs: [
        { id: 'desenvolvedor', name: 'Sites e apps' },
        { id: 'designer', name: 'Design gráfico' },
        { id: 'social-media', name: 'Social media' },
      ] },
    ],
  },
  {
    id: 'beleza', name: 'Beleza e Bem-estar', short: 'Beleza', icon: 'scissors', color: '#ff2d55',
    groups: [
      { id: 'cabelo', name: 'Cabelo', specs: [
        { id: 'cabeleireiro', name: 'Cabeleireiro(a)' },
        { id: 'barbeiro', name: 'Barbeiro' },
        { id: 'trancas', name: 'Tranças' },
      ] },
      { id: 'estetica', name: 'Estética', specs: [
        { id: 'manicure', name: 'Manicure e pedicure' },
        { id: 'maquiadora', name: 'Maquiador(a)' },
        { id: 'depilacao', name: 'Depilação' },
        { id: 'designer-sobrancelha', name: 'Design de sobrancelha' },
      ] },
      { id: 'saude', name: 'Saúde e corpo', specs: [
        { id: 'massoterapeuta', name: 'Massoterapeuta' },
        { id: 'personal-trainer', name: 'Personal trainer' },
        { id: 'nutricionista', name: 'Nutricionista' },
      ] },
    ],
  },
  {
    id: 'aulas', name: 'Aulas', short: 'Aulas', icon: 'book', color: '#af52de',
    groups: [
      { id: 'escolar', name: 'Escolar', specs: [
        { id: 'reforco-escolar', name: 'Reforço escolar' },
        { id: 'matematica', name: 'Matemática' },
        { id: 'redacao', name: 'Redação' },
      ] },
      { id: 'idiomas', name: 'Idiomas', specs: [
        { id: 'ingles', name: 'Inglês' },
        { id: 'espanhol', name: 'Espanhol' },
      ] },
      { id: 'musica', name: 'Música', specs: [
        { id: 'violao', name: 'Violão e guitarra' },
        { id: 'canto', name: 'Canto' },
        { id: 'piano', name: 'Piano e teclado' },
      ] },
    ],
  },
  {
    id: 'eventos', name: 'Eventos', short: 'Eventos', icon: 'party', color: '#ff3b30',
    groups: [
      { id: 'registro', name: 'Foto e vídeo', specs: [
        { id: 'fotografo', name: 'Fotógrafo' },
        { id: 'videomaker', name: 'Videomaker' },
      ] },
      { id: 'festa', name: 'Festas', specs: [
        { id: 'buffet', name: 'Buffet' },
        { id: 'confeiteira', name: 'Bolos e doces' },
        { id: 'dj', name: 'DJ' },
        { id: 'decoracao', name: 'Decoração' },
        { id: 'garcom', name: 'Garçom' },
      ] },
    ],
  },
  {
    id: 'mudancas', name: 'Mudanças e Fretes', short: 'Fretes', icon: 'truck', color: '#a2845e',
    groups: [
      { id: 'transporte', name: 'Transporte', specs: [
        { id: 'frete', name: 'Frete e carreto' },
        { id: 'mudanca', name: 'Mudança residencial' },
        { id: 'motoboy', name: 'Motoboy' },
      ] },
      { id: 'montagem', name: 'Montagem', specs: [
        { id: 'montador-moveis', name: 'Montador de móveis' },
        { id: 'instalador', name: 'Instalação de TV e suportes' },
      ] },
    ],
  },
  {
    id: 'pets', name: 'Pets', short: 'Pets', icon: 'paw', color: '#ff9f0a',
    groups: [
      { id: 'cuidados-pet', name: 'Cuidados', specs: [
        { id: 'dog-walker', name: 'Dog walker' },
        { id: 'pet-sitter', name: 'Pet sitter' },
      ] },
      { id: 'estetica-pet', name: 'Estética e treino', specs: [
        { id: 'banho-tosa', name: 'Banho e tosa' },
        { id: 'adestrador', name: 'Adestrador' },
      ] },
    ],
  },
];

/* ---------- Indexes (built once) ---------- */

const catById = new Map();
const groupByKey = new Map();
/** specId → { spec, group, category } */
const specIndex = new Map();

for (const cat of CATEGORIES) {
  catById.set(cat.id, cat);
  for (const group of cat.groups) {
    groupByKey.set(`${cat.id}/${group.id}`, group);
    for (const spec of group.specs) {
      if (specIndex.has(spec.id)) console.warn(`Duplicate spec id: ${spec.id}`);
      specIndex.set(spec.id, { spec, group, category: cat });
    }
  }
}

export const getCategory = (id) => catById.get(id) || null;
export const getGroup = (catId, groupId) => groupByKey.get(`${catId}/${groupId}`) || null;
export const getSpec = (specId) => specIndex.get(specId) || null;
export const allSpecs = () => [...specIndex.values()];
export const specName = (specId) => specIndex.get(specId)?.spec.name || specId;

export const specCount = (cat) => cat.groups.reduce((n, g) => n + g.specs.length, 0);

/** Category ids for a list of spec ids (used to denormalize on save). */
export function categoriesForSpecs(specIds = []) {
  return [...new Set(specIds.map((id) => specIndex.get(id)?.category.id).filter(Boolean))];
}

/** Popular niches surfaced on the home screen. */
export const POPULAR_SPECS = [
  'eletricista', 'encanador', 'diarista', 'pedreiro', 'pintor',
  'ar-condicionado', 'montador-moveis', 'manicure', 'frete', 'mecanico',
];
