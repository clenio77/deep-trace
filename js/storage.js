/**
 * DeepTrace — Módulo de Gerenciamento de LocalStorage
 * 
 * Responsável por persistir análises de vídeos, controlar
 * rate limiting e armazenar a API key do Gemini.
 * 
 * Padrão: classe global (window.DeepTraceStorage)
 */

window.DeepTraceStorage = class DeepTraceStorage {

    /** Limite máximo de análises armazenadas */
    static MAX_HISTORY = 50;

    /** Limite de análises permitidas por hora */
    static RATE_LIMIT_MAX = 10;

    /** Janela de tempo do rate limiting em milissegundos (1 hora) */
    static RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

    /**
     * Inicializa o storage.
     * Carrega dados existentes do localStorage ou popula com dados de demonstração.
     */
    constructor() {
        /** @type {string} Chave principal do histórico no localStorage */
        this.storageKey = 'deeptrace_history';

        /** @type {string} Chave da API key no localStorage */
        this.apiKeyKey = 'deeptrace_api_key';

        /** @type {string} Chave do controle de rate limiting no localStorage */
        this.rateLimitKey = 'deeptrace_rate_limit';

        /** @type {string} Chave de versão para limpeza de cache obsoleto */
        this.versionKey = 'deeptrace_storage_version';
        
        /** @type {string} Versão atual do storage (força atualização ao mudar) */
        this.currentVersion = '2.0';

        // Executa a migração/limpeza se o usuário vier de uma versão antiga
        this._migrateStorage();

        /** @type {Array<Object>} Histórico de análises em memória */
        this.history = this._loadFromStorage();
    }

    /**
     * Limpa o histórico obsoleto contendo referências de deepfake se a versão mudou.
     * @private
     */
    _migrateStorage() {
        try {
            const storedVersion = localStorage.getItem(this.versionKey);
            if (storedVersion !== this.currentVersion) {
                localStorage.removeItem(this.storageKey);
                localStorage.setItem(this.versionKey, this.currentVersion);
            }
        } catch (e) {
            console.warn('[DeepTrace Storage] Falha ao executar migração de dados:', e);
        }
    }

    // ─────────────────────────────────────────────
    //  Métodos de Histórico de Análises
    // ─────────────────────────────────────────────

    /**
     * Salva uma análise no histórico.
     * Gera ID e timestamp automaticamente se não fornecidos.
     * Respeita o limite FIFO de MAX_HISTORY registros.
     * 
     * @param {Object} analysis - Objeto da análise
     * @param {string} analysis.url - URL do vídeo analisado
     * @param {string} analysis.platform - Plataforma de origem (youtube, tiktok, etc.)
     * @param {string} analysis.title - Título do vídeo
     * @param {number} analysis.overallScore - Pontuação geral de credibilidade (0-100)
     * @param {string} analysis.verdict - Veredito final (Falso, Verdadeiro, etc.)
     * @param {string} analysis.summary - Resumo descritivo da análise
     * @param {Array<Object>} analysis.claims - Lista de alegações identificadas
     * @param {Array<string>} analysis.manipulationTechniques - Técnicas de manipulação detectadas
     * @param {Object} analysis.metadata - Metadados do vídeo (idioma, duração, transcrição)
     * @returns {Object} A análise salva com id e timestamp preenchidos
     */
    saveAnalysis(analysis) {
        const record = {
            id: analysis.id || this._generateId(),
            url: analysis.url,
            platform: analysis.platform || 'unknown',
            title: analysis.title || analysis.metadata?.videoTitle || 'Sem título',
            overallScore: analysis.overallScore,
            verdict: analysis.verdict,
            summary: analysis.summary || '',
            claims: analysis.claims || [],
            manipulationTechniques: analysis.manipulationTechniques || [],
            metadata: analysis.metadata || {},
            timestamp: analysis.timestamp || new Date().toISOString()
        };

        // Insere no início para manter ordenação por data (mais recente primeiro)
        this.history.unshift(record);

        // Aplica limite FIFO — remove as análises mais antigas excedentes
        if (this.history.length > DeepTraceStorage.MAX_HISTORY) {
            this.history = this.history.slice(0, DeepTraceStorage.MAX_HISTORY);
        }

        this._saveToStorage();
        return record;
    }

    /**
     * Retorna o histórico completo de análises ordenado por data (mais recente primeiro).
     * @returns {Array<Object>} Lista de análises
     */
    getHistory() {
        return [...this.history].sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );
    }

    /**
     * Busca uma análise em cache pela URL do vídeo.
     * @param {string} url - URL do vídeo
     * @returns {Object|null} A análise encontrada ou null
     */
    getByUrl(url) {
        if (!url) return null;

        const normalizedUrl = url.trim().toLowerCase();
        const found = this.history.find(
            (item) => item.url && item.url.trim().toLowerCase() === normalizedUrl
        );

        return found || null;
    }

    /**
     * Busca uma análise pelo seu identificador único.
     * @param {string} id - ID da análise
     * @returns {Object|null} A análise encontrada ou null
     */
    getAnalysisById(id) {
        if (!id) return null;
        return this.history.find((item) => item.id === id) || null;
    }

    /**
     * Limpa todo o histórico de análises.
     */
    clearHistory() {
        this.history = [];
        this._saveToStorage();
    }

    // ─────────────────────────────────────────────
    //  Gerenciamento de API Key
    // ─────────────────────────────────────────────

    /**
     * Salva a API key do Gemini.
     * @param {string} key - A chave de API
     * @param {boolean} remember - Se true, salva ofuscada no localStorage. Se false, apenas na sessão.
     */
    saveApiKey(key, remember = false) {
        if (!key || typeof key !== 'string') return;
        const trimmed = key.trim();

        if (remember) {
            // Ofusca antes de salvar permanentemente no LocalStorage
            const obfuscated = this._obfuscate(trimmed);
            localStorage.setItem(this.apiKeyKey, obfuscated);
            localStorage.setItem(this.apiKeyKey + '_remember', 'true');
            sessionStorage.removeItem(this.apiKeyKey);
        } else {
            // Salva apenas na sessão ativa (limpo ao fechar a aba)
            sessionStorage.setItem(this.apiKeyKey, trimmed);
            localStorage.removeItem(this.apiKeyKey);
            localStorage.removeItem(this.apiKeyKey + '_remember');
        }
    }

    /**
     * Recupera a API key do Gemini armazenada.
     * @returns {string|null} A chave de API ou null se não configurada
     */
    getApiKey() {
        // 1. Tenta recuperar da sessão primeiro (mais seguro)
        const sessionKey = sessionStorage.getItem(this.apiKeyKey);
        if (sessionKey) return sessionKey;

        // 2. Tenta recuperar e desofuscar do localStorage permanente
        const localObfuscated = localStorage.getItem(this.apiKeyKey);
        if (localObfuscated) {
            try {
                return this._deobfuscate(localObfuscated);
            } catch (e) {
                console.error('[DeepTrace Storage] Falha ao descriptografar chave local:', e);
                return null;
            }
        }
        return null;
    }

    /**
     * Verifica se a chave está configurada para ser lembrada no dispositivo.
     * @returns {boolean}
     */
    isApiKeyRemembered() {
        return localStorage.getItem(this.apiKeyKey + '_remember') === 'true';
    }

    /**
     * Ofusca um texto plano usando cifra XOR baseada em hash dinâmico do navegador.
     * @private
     */
    _obfuscate(text) {
        if (!text) return '';
        const salt = (navigator.userAgent || '') + 'deeptrace_salt_2026';
        let hash = 0;
        for (let i = 0; i < salt.length; i++) {
            hash = (hash << 5) - hash + salt.charCodeAt(i);
            hash |= 0;
        }
        const key = Math.abs(hash) % 255 || 42;

        let result = '';
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ key;
            result += charCode.toString(16).padStart(2, '0');
        }
        return result;
    }

    /**
     * Desofusca uma string hexadecimal armazenada.
     * @private
     */
    _deobfuscate(hex) {
        if (!hex) return '';
        const salt = (navigator.userAgent || '') + 'deeptrace_salt_2026';
        let hash = 0;
        for (let i = 0; i < salt.length; i++) {
            hash = (hash << 5) - hash + salt.charCodeAt(i);
            hash |= 0;
        }
        const key = Math.abs(hash) % 255 || 42;

        let result = '';
        for (let i = 0; i < hex.length; i += 2) {
            const charCode = parseInt(hex.substring(i, i + 2), 16) ^ key;
            result += String.fromCharCode(charCode);
        }
        return result;
    }

    /**
     * Calcula métricas agregadas do histórico de análises.
     * @returns {Object} Métricas: total, fakeCount, avgScore
     */
    getMetrics() {
        const analyses = this.history.filter(item => !item.id?.startsWith('demo_'));
        const total = analyses.length;
        
        if (total === 0) {
            return { total: 0, fakeCount: 0, avgScore: 0 };
        }

        const fakeCount = analyses.filter(item => {
            const v = (item.verdict || '').toLowerCase();
            return v.includes('fals') || v === 'false';
        }).length;

        const avgScore = Math.round(
            analyses.reduce((sum, item) => sum + (item.overallScore || 0), 0) / total
        );

        return { total, fakeCount, avgScore };
    }

    // ─────────────────────────────────────────────
    //  Controle de Rate Limiting
    // ─────────────────────────────────────────────

    /**
     * Retorna informações sobre o estado atual do rate limiting.
     * Remove registros expirados (fora da janela de 1 hora) antes de calcular.
     * 
     * @returns {Object} Informações do rate limit
     * @returns {number} return.used - Quantidade de análises realizadas na janela atual
     * @returns {number} return.remaining - Análises restantes permitidas
     * @returns {number} return.limit - Limite máximo por hora
     * @returns {boolean} return.exceeded - Se o limite foi excedido
     * @returns {number|null} return.resetsAt - Timestamp (ms) de quando o registro mais antigo expira
     */
    getRateLimitInfo() {
        const data = this._loadRateLimitData();
        const now = Date.now();

        // Filtra apenas os registros dentro da janela de tempo
        const activeTimestamps = data.timestamps.filter(
            (ts) => now - ts < DeepTraceStorage.RATE_LIMIT_WINDOW_MS
        );

        // Atualiza o storage se houve limpeza de registros expirados
        if (activeTimestamps.length !== data.timestamps.length) {
            this._saveRateLimitData({ timestamps: activeTimestamps });
        }

        const used = activeTimestamps.length;
        const remaining = Math.max(0, DeepTraceStorage.RATE_LIMIT_MAX - used);
        const exceeded = used >= DeepTraceStorage.RATE_LIMIT_MAX;

        // Calcula quando o registro mais antigo vai expirar
        let resetsAt = null;
        if (activeTimestamps.length > 0) {
            const oldest = Math.min(...activeTimestamps);
            resetsAt = oldest + DeepTraceStorage.RATE_LIMIT_WINDOW_MS;
        }

        return { used, remaining, limit: DeepTraceStorage.RATE_LIMIT_MAX, exceeded, resetsAt };
    }

    /**
     * Registra uma nova utilização no controle de rate limiting.
     * @returns {boolean} true se a operação foi registrada, false se o limite foi excedido
     */
    incrementRateLimit() {
        const info = this.getRateLimitInfo();

        if (info.exceeded) {
            return false;
        }

        const data = this._loadRateLimitData();
        const now = Date.now();

        // Mantém apenas registros válidos e adiciona o novo
        data.timestamps = data.timestamps.filter(
            (ts) => now - ts < DeepTraceStorage.RATE_LIMIT_WINDOW_MS
        );
        data.timestamps.push(now);

        this._saveRateLimitData(data);
        return true;
    }

    // ─────────────────────────────────────────────
    //  Métodos Privados
    // ─────────────────────────────────────────────

    /**
     * Carrega o histórico do localStorage.
     * Se não existir dados salvos, inicializa com dados de demonstração.
     * @returns {Array<Object>} Lista de análises
     * @private
     */
    _loadFromStorage() {
        try {
            const raw = localStorage.getItem(this.storageKey);

            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }

            // Nenhum dado salvo — inicializa com demonstração
            const demoData = this._loadDemoData();
            localStorage.setItem(this.storageKey, JSON.stringify(demoData));
            return demoData;

        } catch (erro) {
            console.warn('[DeepTrace Storage] Erro ao carregar dados do localStorage:', erro);
            const demoData = this._loadDemoData();
            localStorage.setItem(this.storageKey, JSON.stringify(demoData));
            return demoData;
        }
    }

    /**
     * Persiste o histórico atual no localStorage.
     * @private
     */
    _saveToStorage() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.history));
        } catch (erro) {
            console.error('[DeepTrace Storage] Erro ao salvar dados no localStorage:', erro);
        }
    }

    /**
     * Carrega os dados de rate limiting do localStorage.
     * @returns {Object} Dados de rate limiting com array de timestamps
     * @private
     */
    _loadRateLimitData() {
        try {
            const raw = localStorage.getItem(this.rateLimitKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.timestamps)) {
                    return parsed;
                }
            }
        } catch (erro) {
            console.warn('[DeepTrace Storage] Erro ao carregar dados de rate limit:', erro);
        }
        return { timestamps: [] };
    }

    /**
     * Salva os dados de rate limiting no localStorage.
     * @param {Object} data - Dados de rate limiting
     * @private
     */
    _saveRateLimitData(data) {
        try {
            localStorage.setItem(this.rateLimitKey, JSON.stringify(data));
        } catch (erro) {
            console.error('[DeepTrace Storage] Erro ao salvar dados de rate limit:', erro);
        }
    }

    /**
     * Gera um identificador único para uma análise.
     * Combina timestamp com componente aleatório para evitar colisões.
     * @returns {string} ID único no formato 'dt_<timestamp>_<random>'
     * @private
     */
    _generateId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `dt_${timestamp}_${random}`;
    }

    /**
     * Retorna um array com 4 análises fictícias para demonstração.
     * Exibidas quando o usuário abre o app pela primeira vez.
     * @returns {Array<Object>} Lista de análises de demonstração
     * @private
     */
    _loadDemoData() {
        const agora = new Date();

        return [
            {
                id: 'demo_001',
                url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                platform: 'youtube',
                title: 'Candidato faz declaração absurda sobre economia em entrevista',
                overallScore: 28,
                verdict: 'Falso',
                summary: 'O vídeo apresenta um trecho editado de forma enganosa, onde falas de diferentes momentos foram concatenadas e recontextualizadas para fazer parecer que o candidato pretendia extinguir o salário mínimo e que dados antigos eram de 2026.',
                claims: [
                    {
                        timestamp: '00:12',
                        claim: 'O candidato afirmou que pretende acabar com o salário mínimo no país',
                        verdict: 'Falso',
                        confidence: 10,
                        reasoning: 'A verificação cruzada com a entrevista original completa revela que a fala foi recortada de forma seletiva. O candidato dizia: "Eu nunca pretenderia acabar com o salário mínimo". O trecho cortado removeu a negação.',
                        sources: ['Entrevista original - TV Democracia', 'Checagem de Fatos - Aos Fatos']
                    },
                    {
                        timestamp: '00:45',
                        claim: 'O teto de gastos reduziu investimentos públicos em 50% neste ano',
                        verdict: 'Parcialmente Verdadeiro',
                        confidence: 45,
                        reasoning: 'O teto reduziu investimentos reais em alguns setores, mas o índice geral de queda foi de 18% segundo o Tesouro Nacional, e não de 50%. A alegação infla o número artificialmente.',
                        sources: ['Relatório de Investimentos - Tesouro Nacional']
                    },
                    {
                        timestamp: '01:15',
                        claim: 'Dados da inflação mostram piora absoluta e recorde histórico',
                        verdict: 'Falso',
                        confidence: 15,
                        reasoning: 'O vídeo cita índices inflacionários elevados como se fossem atuais (2026), mas na realidade reutiliza dados antigos e desatualizados do ano de 2021 (pico da pandemia).',
                        sources: ['Série Histórica do IPCA - IBGE']
                    }
                ],
                manipulationTechniques: [
                    'Corte manipulativo (omissão de negação)',
                    'Descontextualização temporal (dados de 2021)',
                    'Estatística inflada / distorcida'
                ],
                metadata: {
                    language: 'pt-BR',
                    duration: '2:34',
                    transcription: 'Trecho analisado: "Eu pretendo... acabar com o salário mínimo... e os dados da inflação mostram uma piora absoluta..."'
                },
                timestamp: new Date(agora.getTime() - 2 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'demo_002',
                url: 'https://www.youtube.com/watch?v=abc123real',
                platform: 'youtube',
                title: 'Pronunciamento oficial sobre investimentos em ferrovias',
                overallScore: 92,
                verdict: 'Verdadeiro',
                summary: 'O vídeo contém o anúncio real feito pelo Ministério dos Transportes sobre o plano de infraestrutura de ferrovias. As alegações batem perfeitamente com os diários oficiais e editais publicados pelo governo.',
                claims: [
                    {
                        timestamp: '00:20',
                        claim: 'O plano prevê investimento de R$ 2 bilhões na malha ferroviária federal',
                        verdict: 'Verdadeiro',
                        confidence: 95,
                        reasoning: 'O Diário Oficial da União e o portal da transparência confirmam o contingenciamento e aprovação de R$ 2,1 bilhões específicos para o Plano Nacional de Ferrovias.',
                        sources: ['Diário Oficial da União - Edição Extra', 'Portal da Transparência']
                    },
                    {
                        timestamp: '01:45',
                        claim: 'O projeto gerará mais de 50 mil novos empregos diretos',
                        verdict: 'Verdadeiro',
                        confidence: 88,
                        reasoning: 'Estimativa técnica baseada nas licitações e contratos das concessionárias ferroviárias ratifica a criação de aproximadamente 52.300 postos de trabalho diretos na fase de implantação.',
                        sources: ['Estudo de Impacto Socioeconômico - Ministério do Trabalho']
                    }
                ],
                manipulationTechniques: [],
                metadata: {
                    language: 'pt-BR',
                    duration: '5:45',
                    transcription: '"Nosso plano de transportes prevê o repasse de dois bilhões de reais nas ferrovias e a criação de cinquenta mil postos..."'
                },
                timestamp: new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'demo_003',
                url: 'https://www.youtube.com/watch?v=stats_mixed',
                platform: 'youtube',
                title: 'Influenciador de finanças discute taxas de juros e PIB',
                overallScore: 52,
                verdict: 'Parcialmente Verdadeiro',
                summary: 'O vídeo traz alguns dados econômicos corretos, porém selecionados de forma parcial (cherry-picking) para corroborar um cenário de crise generalizada que diverge dos dados macroeconômicos oficiais completos.',
                claims: [
                    {
                        timestamp: '00:15',
                        claim: 'A taxa básica de juros atingiu o seu maior patamar histórico',
                        verdict: 'Falso',
                        confidence: 20,
                        reasoning: 'A taxa atual está elevada, porém bem abaixo dos picos históricos brasileiros das décadas de 1990 (quando passou de 40%) ou mesmo de 2016 (quando bateu 14,25%).',
                        sources: ['Série Histórica da Taxa Selic - Banco Central do Brasil']
                    },
                    {
                        timestamp: '00:52',
                        claim: 'A inflação oficial acumulada nos últimos 12 meses está em 4,5%',
                        verdict: 'Verdadeiro',
                        confidence: 94,
                        reasoning: 'O dado apresentado é verdadeiro e condiz exatamente com o último boletim divulgado pelo IBGE sobre o IPCA acumulado.',
                        sources: ['Boletim do IPCA - IBGE']
                    },
                    {
                        timestamp: '01:30',
                        claim: 'O PIB brasileiro apresentou retração no último trimestre fiscal',
                        verdict: 'Inconclusivo',
                        confidence: 50,
                        reasoning: 'O PIB apresentou crescimento nulo (0,0%) no último relatório prévio, o que aponta para estagnação, mas não caracteriza retração/recessão técnica formalizada até o momento.',
                        sources: ['Relatório Trimestral do PIB - IBGE']
                    }
                ],
                manipulationTechniques: [
                    'Cherry-picking (seleção tendenciosa de dados)',
                    'Narrativa alarmista ou desproporcional'
                ],
                metadata: {
                    language: 'pt-BR',
                    duration: '3:10',
                    transcription: '"A Selic está no topo histórico e o PIB está caindo, embora a inflação esteja controlada em quatro e meio..."'
                },
                timestamp: new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'demo_004',
                url: 'https://www.youtube.com/watch?v=deepfake_pol',
                platform: 'youtube',
                title: 'Vídeo viral mostra suposta enchente devastadora recente',
                overallScore: 10,
                verdict: 'Falso',
                summary: 'O vídeo viralizado nas redes como sendo um desastre climático recente é, na verdade, um caso clássico de reciclagem de conteúdo. O vídeo original retrata uma tempestade ocorrida em 2022, usada fora de contexto temporal.',
                claims: [
                    {
                        timestamp: '00:05',
                        claim: 'Imagens aéreas mostram a enchente devastadora de ontem no Sul do país',
                        verdict: 'Falso',
                        confidence: 5,
                        reasoning: 'Busca reversa de imagens e checagem cruzada confirmam que as filmagens são do desastre ocorrido no inverno de 2022. O vídeo foi republicado sem alteração visual, mas alegando ser atual.',
                        sources: ['Matéria original do G1 de julho de 2022', 'Desmentido - Agência Lupa']
                    },
                    {
                        timestamp: '00:37',
                        claim: 'O governo local não enviou ajuda financeira para a Defesa Civil da região',
                        verdict: 'Falso',
                        confidence: 8,
                        reasoning: 'O portal de transparência do estado registra o repasse emergencial de R$ 15 milhões em recursos específicos para a Defesa Civil do município nos últimos dois meses de 2026.',
                        sources: ['Portal da Transparência Estadual - Repasses Defesa Civil']
                    },
                    {
                        timestamp: '01:02',
                        claim: 'O desastre climático deixou mais de 10 mil desabrigados na cidade',
                        verdict: 'Falso',
                        confidence: 12,
                        reasoning: 'Mesmo nas enchentes severas de 2022, o número de desabrigados no município em questão foi de 450 pessoas. O número de 10 mil foi inventado para gerar engajamento emocional.',
                        sources: ['Boletim Oficial de Desastres - Defesa Civil']
                    }
                ],
                manipulationTechniques: [
                    'Reciclagem de vídeo antigo (descontextualização temporal)',
                    'Estatística inventada / inflada',
                    'Falsa alegação de omissão governamental'
                ],
                metadata: {
                    language: 'pt-BR',
                    duration: '1:45',
                    transcription: '"Vejam a destruição das águas ontem... Nenhuma ajuda chegou e já são dez mil pessoas nas ruas..."'
                },
                timestamp: new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }
};
