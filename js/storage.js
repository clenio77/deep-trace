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

        /** @type {Array<Object>} Histórico de análises em memória */
        this.history = this._loadFromStorage();
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
            title: analysis.title || 'Sem título',
            overallScore: analysis.overallScore,
            verdict: analysis.verdict,
            summary: analysis.summary || '',
            claims: analysis.claims || [],
            manipulationTechniques: analysis.manipulationTechniques || [],
            deepfakeAnalysis: analysis.deepfakeAnalysis || null,
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
                overallScore: 15,
                verdict: 'Falso',
                summary: 'O vídeo apresenta um trecho editado de forma enganosa, onde falas de diferentes momentos foram concatenadas para criar uma declaração inexistente. A análise de áudio revelou cortes abruptos e inconsistências na entonação.',
                deepfakeAnalysis: {
                    detected: false,
                    confidence: 90,
                    lipSync: 'Natural (movimentação labial perfeitamente sincronizada com a voz)',
                    faceArtifacts: 'Natural (sem distorções nas bordas ou contornos faciais)',
                    lightingCoherence: 'Coerente (padrões de luz e sombra correspondem ao cenário real)',
                    blinkingPattern: 'Natural (frequência de piscadas normal)',
                    details: 'O vídeo não apresenta indícios de manipulação visual por IA ou deepfake. A falsidade constatada provém de edição e cortes seletivos de áudio (recontextualização).'
                },
                claims: [
                    {
                        claim: 'O candidato afirmou que pretende acabar com o salário mínimo',
                        verdict: 'Falso',
                        confidence: 10,
                        reasoning: 'Verificação cruzada com a entrevista original completa revelou que a fala foi editada seletivamente, removendo contexto.',
                        sources: ['Entrevista original no canal oficial do candidato']
                    },
                    {
                        claim: 'A declaração foi feita durante debate ao vivo',
                        verdict: 'Falso',
                        confidence: 5,
                        reasoning: 'Não há registro nos canais oficiais do debate. O cenário do vídeo é de um estúdio diferente.',
                        sources: ['Registro oficial do debate — TSE']
                    },
                    {
                        claim: 'O vídeo foi gravado em 2024',
                        verdict: 'Falso',
                        confidence: 12,
                        reasoning: 'Metadados indicam edição recente com material de 2022, recontextualizado para parecer atual.',
                        sources: ['Análise de metadados EXIF']
                    }
                ],
                manipulationTechniques: [
                    'Edição seletiva de áudio',
                    'Descontextualização',
                    'Concatenação de falas distintas'
                ],
                metadata: {
                    language: 'pt-BR',
                    duration: '2:34',
                    transcription: 'Trecho manipulado: "Eu pretendo... acabar com o salário... mínimo neste país..."'
                },
                timestamp: new Date(agora.getTime() - 2 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'demo_002',
                url: 'https://www.youtube.com/watch?v=abc123real',
                platform: 'youtube',
                title: 'Discurso completo do governador no comício de São Paulo',
                overallScore: 82,
                verdict: 'Verdadeiro',
                summary: 'O vídeo contém o discurso real proferido pelo governador durante comício oficial. As falas foram confirmadas por múltiplas fontes jornalísticas e correspondem ao registro oficial do evento.',
                deepfakeAnalysis: {
                    detected: false,
                    confidence: 95,
                    lipSync: 'Natural (sincronismo labial exato com o áudio gravado)',
                    faceArtifacts: 'Natural (texturas de pele e transições faciais fluidas)',
                    lightingCoherence: 'Coerente (coerência exata de iluminação com o fundo)',
                    blinkingPattern: 'Natural (expressões faciais e piscadas orgânicas)',
                    details: 'Nenhum indício de manipulação facial ou de voz por IA foi detectado. O vídeo é um registro autêntico e íntegro do evento.'
                },
                claims: [
                    {
                        claim: 'O governador prometeu investimento de R$ 2 bilhões em saúde',
                        verdict: 'Verdadeiro',
                        confidence: 90,
                        reasoning: 'Confirmado pelo portal oficial do governo estadual e cobertura jornalística.',
                        sources: ['Portal oficial do governo estadual', 'Folha de S. Paulo']
                    },
                    {
                        claim: 'O evento ocorreu no dia 15 de maio de 2026',
                        verdict: 'Verdadeiro',
                        confidence: 95,
                        reasoning: 'Registros fotográficos e cobertura da imprensa local confirmam data e local.',
                        sources: ['Agência Brasil', 'G1 São Paulo']
                    }
                ],
                manipulationTechniques: [],
                metadata: {
                    language: 'pt-BR',
                    duration: '18:45',
                    transcription: '"Nosso compromisso é investir dois bilhões de reais na saúde pública do estado..."'
                },
                timestamp: new Date(agora.getTime() - 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'demo_003',
                url: 'https://www.youtube.com/watch?v=stats_mixed',
                platform: 'youtube',
                title: 'Influenciador apresenta dados sobre criminalidade no Brasil',
                overallScore: 45,
                verdict: 'Parcialmente Verdadeiro',
                summary: 'O vídeo mistura dados estatísticos reais com interpretações distorcidas. Alguns números citados são precisos segundo fontes oficiais, mas a narrativa ignora contexto temporal e metodológico, induzindo conclusões equivocadas.',
                deepfakeAnalysis: {
                    detected: false,
                    confidence: 88,
                    lipSync: 'Natural (movimentos orais condizentes com a fala do influenciador)',
                    faceArtifacts: 'Natural (contornos de rosto limpos e definidos)',
                    lightingCoherence: 'Coerente (distribuição de luz realista no rosto e cenário)',
                    blinkingPattern: 'Natural (piscar de olhos e expressões naturais)',
                    details: 'O vídeo apresenta apenas manipulação retórica (cherry-picking de dados), mas o conteúdo de imagem e voz é real e autêntico.'
                },
                claims: [
                    {
                        claim: 'A taxa de homicídios caiu 20% em 2025',
                        verdict: 'Verdadeiro',
                        confidence: 85,
                        reasoning: 'Dados do Fórum Brasileiro de Segurança Pública confirmam a tendência de queda.',
                        sources: ['Fórum Brasileiro de Segurança Pública — Relatório 2025']
                    },
                    {
                        claim: 'O Brasil é o país mais violento do mundo',
                        verdict: 'Falso',
                        confidence: 15,
                        reasoning: 'Ranking da ONU coloca o Brasil em 12º lugar, não em 1º como afirmado.',
                        sources: ['UNODC Global Study on Homicide 2025']
                    },
                    {
                        claim: 'Investimentos em segurança dobraram nos últimos 5 anos',
                        verdict: 'Falso',
                        confidence: 20,
                        reasoning: 'Dados do Tesouro Nacional mostram aumento de apenas 34%, não 100%.',
                        sources: ['Tesouro Nacional — Portal da Transparência']
                    }
                ],
                manipulationTechniques: [
                    'Cherry-picking de dados estatísticos',
                    'Omissão de contexto temporal'
                ],
                metadata: {
                    language: 'pt-BR',
                    duration: '12:08',
                    transcription: '"Os números não mentem: a criminalidade caiu 20%, mas o Brasil continua sendo o país mais violento..."'
                },
                timestamp: new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
                id: 'demo_004',
                url: 'https://www.youtube.com/watch?v=deepfake_pol',
                platform: 'youtube',
                title: 'Suposto pronunciamento de senador sobre renúncia',
                overallScore: 8,
                verdict: 'Falso',
                summary: 'Análise técnica identificou o vídeo como deepfake gerado por inteligência artificial. Há inconsistências visíveis nos movimentos labiais, artefatos visuais ao redor do rosto e a voz apresenta padrões sintéticos detectáveis.',
                deepfakeAnalysis: {
                    detected: true,
                    confidence: 92,
                    lipSync: 'Inconsistente (há pequenos atrasos e desalinhamentos entre a fala e a movimentação orquestrada da boca)',
                    faceArtifacts: 'Artefatos detectados (leve desfoque ou perda de nitidez na linha da mandíbula durante rotações de cabeça)',
                    lightingCoherence: 'Inconsistente (a iluminação do rosto do senador não corresponde à luz difusa do cenário do fundo)',
                    blinkingPattern: 'Suspeito (piscar de olhos extremamente reduzido e movimentos oculares artificiais)',
                    details: 'Análise técnica detectou forte probabilidade de manipulação por inteligência artificial. O vídeo exibe traços característicos de substituição facial (face swap) e síntese vocal computadorizada.'
                },
                claims: [
                    {
                        claim: 'O senador anunciou sua renúncia ao cargo',
                        verdict: 'Falso',
                        confidence: 3,
                        reasoning: 'Gabinete do senador negou qualquer pronunciamento e confirmou que o vídeo é falso.',
                        sources: ['Assessoria de imprensa do gabinete do senador']
                    },
                    {
                        claim: 'O vídeo foi gravado no Senado Federal',
                        verdict: 'Falso',
                        confidence: 5,
                        reasoning: 'O cenário foi gerado artificialmente — iluminação e perspectiva são inconsistentes com o plenário real.',
                        sources: ['Comparação visual com imagens oficiais do Senado']
                    }
                ],
                manipulationTechniques: [
                    'Deepfake facial',
                    'Síntese de voz por IA',
                    'Cenário gerado artificialmente'
                ],
                metadata: {
                    language: 'pt-BR',
                    duration: '1:52',
                    transcription: '"Venho a público comunicar minha decisão irrevogável de deixar o cargo de senador..."'
                },
                timestamp: new Date(agora.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString()
            }
        ];
    }
};
