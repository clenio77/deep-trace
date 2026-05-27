/**
 * DeepTrace — Módulo Orquestrador Principal
 * 
 * Coordena todos os módulos da aplicação de detecção de fake news:
 * - DeepTraceStorage: persistência em localStorage
 * - DeepTraceAnalyzer: motor de análise via Gemini API
 * - DeepTraceUI: interface visual e feedback ao usuário
 * 
 * Não usa import/export — classes são atribuídas ao objeto window.
 */

window.DeepTraceApp = class DeepTraceApp {

    /** Tamanho máximo de arquivo para upload (50MB) */
    static MAX_FILE_SIZE = 50 * 1024 * 1024;

    /** Intervalo mínimo entre análises em milissegundos (3 segundos) */
    static RATE_LIMIT_INTERVAL = 3000;

    /** Extensões de vídeo aceitas para validação de URL */
    static VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];

    /** Plataformas suportadas e seus padrões de URL */
    static SUPPORTED_PLATFORMS = {
        youtube: /(?:youtube\.com|youtu\.be)/i,
        tiktok: /tiktok\.com/i,
        instagram: /instagram\.com/i,
        twitter: /(?:twitter\.com|x\.com)/i
    };

    constructor() {
        /** @type {DeepTraceStorage} Módulo de persistência */
        this.storage = new window.DeepTraceStorage();

        /** @type {DeepTraceUI} Módulo de interface */
        this.ui = new window.DeepTraceUI();

        /** @type {DeepTraceAnalyzer|null} Motor de análise — instanciado quando API key estiver disponível */
        this.analyzer = null;

        /** Timestamp da última análise para controle de rate limit */
        this._lastAnalysisTime = 0;

        /** Cache de referências aos elementos DOM */
        this.elements = {};

        // Inicializa a aplicação
        this.init();
    }

    /**
     * Inicializa a aplicação.
     * Aguarda DOMContentLoaded caso o DOM ainda não esteja pronto.
     */
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this._bootstrap());
        } else {
            this._bootstrap();
        }
    }

    /**
     * Executa toda a sequência de inicialização:
     * referências DOM, listeners, histórico, API key e animações.
     * @private
     */
    _bootstrap() {
        this._cacheElements();
        this._registerEventListeners();
        this.loadHistory();
        this._checkSavedApiKey();
        this.ui.initScrollAnimations();
        this._enableSmoothScroll();
        this._checkQueryParamAnalysis();
        
        // Lógica temporária de teste para simular cliques de demos por query param
        try {
            const params = new URLSearchParams(window.location.search);
            const testDemoId = params.get('testDemoId');
            if (testDemoId) {
                const analysis = this.storage.getAnalysisById(testDemoId);
                if (analysis) {
                    setTimeout(() => {
                        this.handleHistoryClick(analysis);
                    }, 500);
                }
            }
        } catch (e) {
            console.error('Erro no teste temporário:', e);
        }
    }

    /**
     * Busca e cacheia referências aos elementos DOM principais.
     * @private
     */
    _cacheElements() {
        this.elements = {
            analyzeInput: document.querySelector('#analyze-input'),
            analyzeBtn: document.querySelector('#analyze-btn'),
            uploadInput: document.querySelector('#upload-input'),
            uploadArea: document.querySelector('#upload-area'),
            resultSection: document.querySelector('#result-section'),
            historyGrid: document.querySelector('#history-grid'),
            settingsBtn: document.querySelector('#settings-btn'),
            ctaBtn: document.querySelector('#cta-btn')
        };
    }

    /**
     * Registra todos os event listeners da aplicação.
     * @private
     */
    _registerEventListeners() {
        const { analyzeInput, analyzeBtn, uploadInput, uploadArea, settingsBtn, ctaBtn } = this.elements;

        // a) Botão analisar
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.handleAnalyze());
        }

        // b) Enter no campo de input
        if (analyzeInput) {
            analyzeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleAnalyze();
                }
            });
        }

        // c) Drag & drop na área de upload
        if (uploadArea) {
            // Prevenir comportamento padrão em todos os eventos de drag
            ['dragover', 'dragenter', 'dragleave', 'drop'].forEach((eventName) => {
                uploadArea.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            // Feedback visual ao arrastar sobre a área
            uploadArea.addEventListener('dragenter', () => {
                uploadArea.classList.add('drag-over');
            });

            uploadArea.addEventListener('dragover', () => {
                uploadArea.classList.add('drag-over');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('drag-over');
            });

            // Processar arquivos soltos
            uploadArea.addEventListener('drop', (e) => {
                uploadArea.classList.remove('drag-over');
                this.handleFileDrop(e);
            });

            // d) Click na área de upload abre o seletor de arquivo
            uploadArea.addEventListener('click', () => {
                if (uploadInput) uploadInput.click();
            });
        }

        // e) Mudança no input de arquivo
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => this.handleFileUpload(e));
        }

        // f) Botão de configurações
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.handleSettings());
        }

        // g) Botão CTA do hero — scroll suave para a seção de análise
        if (ctaBtn) {
            ctaBtn.addEventListener('click', () => {
                const analyzeSection = document.querySelector('#analyze');
                if (analyzeSection) {
                    analyzeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        }

        // h) Callback para clique em card do histórico
        this.ui.onHistoryCardClick = (analysis) => this.handleHistoryClick(analysis);
    }

    /**
     * Verifica se já existe uma API key salva e instancia o analyzer.
     * @private
     */
    _checkSavedApiKey() {
        const apiKey = this.storage.getApiKey();
        if (apiKey) {
            this.analyzer = new window.DeepTraceAnalyzer(apiKey);
        }
    }

    /**
     * Ativa smooth scroll globalmente via CSS no elemento html.
     * @private
     */
    _enableSmoothScroll() {
        document.documentElement.style.scrollBehavior = 'smooth';

        // Intercepta cliques em links internos para scroll suave
        document.querySelectorAll('a[href^="#"]').forEach((link) => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href');
                if (targetId && targetId.length > 1) {
                    const targetEl = document.querySelector(targetId);
                    if (targetEl) {
                        e.preventDefault();
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        });
    }

    /**
     * Verifica se há um parâmetro "url" nos Query Params da página.
     * Caso exista, preenche o input e executa a análise automaticamente.
     * @private
     */
    async _checkQueryParamAnalysis() {
        try {
            const params = new URLSearchParams(window.location.search);
            const videoUrl = params.get('url');

            if (videoUrl && this.validateUrl(videoUrl)) {
                // Preenche o campo de entrada
                if (this.elements.analyzeInput) {
                    this.elements.analyzeInput.value = videoUrl;
                }

                // Remove o parâmetro "url" da barra de endereços para não repetir ao recarregar a página
                const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.hash;
                window.history.replaceState({ path: cleanUrl }, '', cleanUrl);

                // Executa a análise automática com um pequeno atraso de 500ms
                setTimeout(() => {
                    this.handleAnalyze();
                }, 500);
            }
        } catch (error) {
            console.error('[DeepTrace] Erro ao ler query params de inicialização:', error);
        }
    }

    // ──────────────────────────────────────────────
    //  Métodos de Análise
    // ──────────────────────────────────────────────

    /**
     * Trata a ação de analisar uma URL de vídeo.
     * Valida a URL, verifica rate limit e API key, consulta cache,
     * e em caso de miss realiza a análise via Gemini API.
     */
    async handleAnalyze() {
        const url = this.elements.analyzeInput?.value?.trim();

        // Validação da URL
        if (!this.validateUrl(url)) {
            this.ui.showToast('Por favor, insira uma URL de vídeo válida.', 'error');
            return;
        }

        // Controle de rate limit
        if (!this.checkRateLimit()) return;

        // Verificação de API key
        if (!this.analyzer) {
            await this.handleSettings();
            if (!this.analyzer) return;
        }

        // Verificação de cache — evita reprocessar a mesma URL
        const cached = this.storage.getByUrl(url);
        if (cached) {
            this.ui.showToast('Resultado carregado do cache.', 'info');
            this.ui.showResult(cached);
            this._scrollToResult();
            return;
        }

        // Executa a análise
        this.ui.showLoading();

        try {
            const result = await this.analyzer.analyzeVideoByUrl(url);

            // Enriquece o resultado com metadados
            result.platform = this._detectPlatform(url);
            result.url = url;
            result.analyzedAt = new Date().toISOString();

            // Persiste e exibe
            this.storage.saveAnalysis(result);
            this.ui.showResult(result);
            this.loadHistory();
            this._scrollToResult();
        } catch (error) {
            console.error('[DeepTrace] Erro na análise:', error);
            this.ui.showError(this._getFriendlyError(error));
        } finally {
            this.ui.hideLoading();
        }
    }

    /**
     * Trata o upload de arquivo via input file.
     * @param {Event} e — Evento change do input file
     */
    async handleFileUpload(e) {
        const file = e.target?.files?.[0];
        if (!file) return;

        await this._processFile(file);

        // Reseta o input para permitir re-upload do mesmo arquivo
        if (e.target) e.target.value = '';
    }

    /**
     * Trata o drop de arquivo na área de upload.
     * @param {DragEvent} e — Evento drop
     */
    async handleFileDrop(e) {
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;

        await this._processFile(file);
    }

    /**
     * Fluxo compartilhado de processamento de arquivo (upload e drop).
     * Valida tipo e tamanho, verifica rate limit e API key, e executa a análise.
     * @param {File} file — Arquivo de vídeo a ser analisado
     * @private
     */
    async _processFile(file) {
        // Validação de tipo — aceita apenas vídeos
        if (!file.type.startsWith('video/')) {
            this.ui.showToast('Formato inválido. Envie um arquivo de vídeo.', 'error');
            return;
        }

        // Validação de tamanho
        if (file.size > DeepTraceApp.MAX_FILE_SIZE) {
            const maxMB = Math.round(DeepTraceApp.MAX_FILE_SIZE / (1024 * 1024));
            this.ui.showToast(`Arquivo muito grande. O limite é de ${maxMB}MB.`, 'error');
            return;
        }

        // Controle de rate limit
        if (!this.checkRateLimit()) return;

        // Verificação de API key
        if (!this.analyzer) {
            await this.handleSettings();
            if (!this.analyzer) return;
        }

        // Executa a análise
        this.ui.showLoading();

        try {
            const result = await this.analyzer.analyzeVideoByFile(file);

            // Enriquece o resultado
            result.platform = 'upload';
            result.url = null;
            result.fileName = file.name;
            result.analyzedAt = new Date().toISOString();

            // Persiste e exibe
            this.storage.saveAnalysis(result);
            this.ui.showResult(result);
            this.loadHistory();
            this._scrollToResult();
        } catch (error) {
            console.error('[DeepTrace] Erro na análise de arquivo:', error);
            this.ui.showError(this._getFriendlyError(error));
        } finally {
            this.ui.hideLoading();
        }
    }

    // ──────────────────────────────────────────────
    //  Validação e Utilitários
    // ──────────────────────────────────────────────

    /**
     * Valida se a string é uma URL de vídeo suportada.
     * Aceita URLs de plataformas conhecidas (YouTube, TikTok, Instagram, Twitter/X)
     * ou URLs com extensão de vídeo reconhecida.
     * @param {string} url — URL a ser validada
     * @returns {boolean} true se a URL for válida
     */
    validateUrl(url) {
        if (!url || typeof url !== 'string' || url.trim() === '') {
            return false;
        }

        try {
            const parsed = new URL(url.trim());

            // Verifica se é uma plataforma suportada
            const isPlatformSupported = Object.values(DeepTraceApp.SUPPORTED_PLATFORMS)
                .some((pattern) => pattern.test(parsed.hostname + parsed.pathname));

            if (isPlatformSupported) return true;

            // Verifica se a URL aponta para um arquivo de vídeo
            const pathname = parsed.pathname.toLowerCase();
            const hasVideoExtension = DeepTraceApp.VIDEO_EXTENSIONS
                .some((ext) => pathname.endsWith(ext));

            return hasVideoExtension;
        } catch {
            // URL malformada
            return false;
        }
    }

    /**
     * Verifica o rate limit de análises.
     * Impede requisições muito frequentes para proteger a API.
     * @returns {boolean} true se a análise pode prosseguir
     */
    checkRateLimit() {
        const agora = Date.now();
        const tempoDesdeUltima = agora - this._lastAnalysisTime;

        if (this._lastAnalysisTime > 0 && tempoDesdeUltima < DeepTraceApp.RATE_LIMIT_INTERVAL) {
            const restante = Math.ceil((DeepTraceApp.RATE_LIMIT_INTERVAL - tempoDesdeUltima) / 1000);
            this.ui.showToast(
                `Aguarde ${restante} segundo(s) antes de analisar novamente.`,
                'error'
            );
            return false;
        }

        this._lastAnalysisTime = agora;
        return true;
    }

    /**
     * Detecta a plataforma a partir da URL.
     * @param {string} url — URL do vídeo
     * @returns {string} Nome da plataforma ou 'other'
     * @private
     */
    _detectPlatform(url) {
        try {
            const parsed = new URL(url);
            const fullHost = parsed.hostname + parsed.pathname;

            for (const [platform, pattern] of Object.entries(DeepTraceApp.SUPPORTED_PLATFORMS)) {
                if (pattern.test(fullHost)) return platform;
            }
        } catch {
            // Ignora erros de parsing
        }
        return 'other';
    }

    /**
     * Converte erros técnicos em mensagens amigáveis para o usuário.
     * @param {Error} error — Erro original
     * @returns {string} Mensagem amigável
     * @private
     */
    _getFriendlyError(error) {
        const mensagem = error?.message?.toLowerCase() || '';

        if (mensagem.includes('network') || mensagem.includes('fetch')) {
            return 'Erro de conexão. Verifique sua internet e tente novamente.';
        }
        if (mensagem.includes('api key') || mensagem.includes('401') || mensagem.includes('403') || mensagem.includes('chave de api') || mensagem.includes('api_key')) {
            return 'Chave de API inválida ou expirada. Atualize nas configurações.';
        }
        if (mensagem.includes('rate') || mensagem.includes('429')) {
            return 'Limite de requisições atingido. Aguarde um momento e tente novamente.';
        }
        if (mensagem.includes('timeout')) {
            return 'A análise demorou demais. Tente novamente com um vídeo mais curto.';
        }

        // Se for um erro amigável lançado intencionalmente em português, exibe-o diretamente
        if (error?.message && !mensagem.includes('typeerror') && !mensagem.includes('referenceerror') && !mensagem.includes('syntaxerror') && !mensagem.includes('failed to fetch')) {
            return error.message;
        }

        return 'Ocorreu um erro inesperado. Tente novamente mais tarde.';
    }

    // ──────────────────────────────────────────────
    //  Configurações
    // ──────────────────────────────────────────────

    /**
     * Abre o modal de configurações (API key).
     * Ao salvar, persiste a chave e instancia um novo analyzer.
     */
    async handleSettings() {
        try {
            const existingKey = this.storage.getApiKey();
            const isRemembered = this.storage.isApiKeyRemembered();

            const result = await this.ui.showApiKeyModal(existingKey, isRemembered);

            if (result && result.key && result.key.trim()) {
                this.storage.saveApiKey(result.key.trim(), result.remember);
                this.analyzer = new window.DeepTraceAnalyzer(result.key.trim());
                this.ui.showToast('Chave de API salva com sucesso!', 'success');
            }
        } catch (error) {
            // Usuário cancelou o modal — sem ação necessária
            console.info('[DeepTrace] Modal de API key cancelado.');
        }
    }

    // ──────────────────────────────────────────────
    //  Histórico
    // ──────────────────────────────────────────────

    /**
     * Carrega o histórico de análises do storage e renderiza os cards.
     */
    loadHistory() {
        const historico = this.storage.getHistory();
        this.ui.renderHistoryCards(historico);
    }

    /**
     * Trata o clique em um card do histórico.
     * Exibe o resultado da análise e faz scroll suave até a seção de resultado.
     * @param {Object} analysis — Dados da análise selecionada
     */
    handleHistoryClick(analysis) {
        this.ui.showResult(analysis);
        this._scrollToResult();
    }

    /**
     * Faz scroll suave até a seção de resultado.
     * @private
     */
    _scrollToResult() {
        if (this.elements.resultSection) {
            this.elements.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
};

// ──────────────────────────────────────────────
//  Auto-inicialização
// ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    window.app = new DeepTraceApp();
});
