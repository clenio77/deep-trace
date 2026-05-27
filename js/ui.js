/**
 * DeepTrace UI — Módulo de Interface Visual
 * 
 * Responsável por toda a renderização da interface do DeepTrace,
 * incluindo loading progressivo, resultados em camadas com gauge SVG,
 * histórico de análises, modais, toasts e animações de scroll.
 * 
 * Tema: dark premium com acentos azul/ciano.
 * 
 * @author DeepTrace Team
 */

window.DeepTraceUI = class DeepTraceUI {

  constructor() {
    /** Callback disparado ao clicar em um card do histórico */
    this.onHistoryCardClick = null;

    /** Callback disparado quando a API key é salva */
    this.onApiKeySaved = null;

    /** Referência do intervalo de mensagens progressivas do loading */
    this._loadingInterval = null;

    /** Referência do timeout de auto-remoção do toast */
    this._toastTimeouts = [];
  }

  // ─────────────────────────────────────────────
  // MÉTODOS PÚBLICOS DE RENDERIZAÇÃO
  // ─────────────────────────────────────────────

  /**
   * Exibe estado de loading com animação shimmer e mensagens progressivas.
   * Faz scroll suave até a seção de resultado.
   */
  showLoading() {
    const section = document.getElementById('result-section');
    if (!section) return;

    // Limpa qualquer conteúdo anterior
    section.innerHTML = '';

    const mensagens = [
      'Recebendo vídeo...',
      'Transcrevendo áudio...',
      'Analisando alegações...',
      'Verificando fatos...',
      'Preparando relatório...'
    ];

    let indiceMensagem = 0;

    const container = document.createElement('div');
    container.className = 'loading-container fade-in-up visible';
    container.innerHTML = `
      <div class="loading-spinner"></div>
      <p class="loading-text">${mensagens[0]}</p>
      <div class="loading-shimmer">
        <div class="shimmer-line"></div>
        <div class="shimmer-line shimmer-line--short"></div>
        <div class="shimmer-line shimmer-line--medium"></div>
      </div>
    `;

    section.appendChild(container);

    // Mensagens progressivas a cada 3 segundos
    this._loadingInterval = setInterval(() => {
      indiceMensagem = (indiceMensagem + 1) % mensagens.length;
      const textoEl = container.querySelector('.loading-text');
      if (textoEl) {
        textoEl.style.opacity = '0';
        setTimeout(() => {
          textoEl.textContent = mensagens[indiceMensagem];
          textoEl.style.opacity = '1';
        }, 300);
      }
    }, 3000);

    // Scroll suave até a seção
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Remove o loading e limpa o intervalo de mensagens.
   */
  hideLoading() {
    if (this._loadingInterval) {
      clearInterval(this._loadingInterval);
      this._loadingInterval = null;
    }

    const section = document.getElementById('result-section');
    if (!section) return;

    const container = section.querySelector('.loading-container');
    if (container) {
      container.style.opacity = '0';
      container.style.transform = 'translateY(-10px)';
      setTimeout(() => container.remove(), 300);
    }
  }

  /**
   * Renderiza o resultado completo da análise em 4 camadas.
   * 
   * @param {Object} analysis — Objeto com os dados da análise
   * @param {number} analysis.overallScore — Score geral (0-100)
   * @param {string} analysis.verdict — Veredito textual
   * @param {string} analysis.summary — Resumo da análise
   * @param {Array}  analysis.claims — Alegações verificadas
   * @param {Array}  analysis.manipulationTechniques — Técnicas de manipulação
   * @param {Object} analysis.metadata — Metadados (transcrição, idioma, etc.)
   */
  showResult(analysis) {
    const section = document.getElementById('result-section');
    if (!section) return;

    section.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'result-wrapper fade-in-up visible';

    // ── CAMADA 1: Score ──
    wrapper.appendChild(this._renderScoreLayer(analysis));

    // ── CAMADA FORENSE: Laudo de Deepfake ──
    wrapper.appendChild(this._renderDeepfakeAnalysisLayer(analysis.deepfakeAnalysis, analysis.platform));

    // ── CAMADA 2: Alegações ──
    wrapper.appendChild(this._renderClaimsLayer(analysis.claims));

    // ── CAMADA 3: Manipulação ──
    wrapper.appendChild(this._renderManipulationLayer(analysis.manipulationTechniques));

    // ── CAMADA 4: Transcrição ──
    wrapper.appendChild(this._renderTranscriptionLayer(analysis.metadata, analysis._deepTrace?.transcriptImported));

    section.appendChild(wrapper);

    // Scroll suave até o resultado
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Exibe mensagem de erro estilizada com ícone de alerta.
   * 
   * @param {string} message — Mensagem de erro para exibir
   */
  showError(message) {
    const section = document.getElementById('result-section');
    if (!section) return;

    section.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'error-container glass-card fade-in-up visible';
    container.innerHTML = `
      <div class="error-icon">⚠️</div>
      <h3 class="error-title">Ocorreu um erro</h3>
      <p class="error-message">${this._escapeHtml(message)}</p>
      <button class="btn-secondary error-retry-btn" onclick="this.closest('.error-container').remove()">
        Fechar
      </button>
    `;

    section.appendChild(container);
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Renderiza cards do histórico de análises no grid.
   * 
   * @param {Array} analyses — Lista de análises anteriores
   */
  renderHistoryCards(analyses) {
    const grid = document.getElementById('history-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!analyses || analyses.length === 0) {
      grid.innerHTML = `
        <div class="history-empty glass-card">
          <p>Nenhuma análise anterior encontrada.</p>
        </div>
      `;
      return;
    }

    analyses.forEach((analysis, index) => {
      const card = document.createElement('div');
      card.className = 'history-card glass-card fade-in-up';
      card.style.animationDelay = `${index * 0.1}s`;

      const cor = this._getScoreColor(analysis.overallScore);

      card.innerHTML = `
        <div class="history-card__gradient" style="background: linear-gradient(135deg, ${cor}22, ${cor}08);">
          <div class="history-card__header">
            <span class="history-card__platform badge">${this._escapeHtml(analysis.platform || 'Vídeo')}</span>
            <span class="history-card__score badge" style="background: ${cor}; color: #fff;">
              ${analysis.overallScore}%
            </span>
          </div>
          <h4 class="history-card__title">${this._escapeHtml(analysis.title || 'Análise sem título')}</h4>
          <p class="history-card__date">${this._formatDate(analysis.timestamp)}</p>
          <div class="history-card__verdict">${this._getVerdictIcon(analysis.verdict)} ${this._escapeHtml(analysis.verdict || '')}</div>
        </div>
      `;

      // Evento de clique no card
      card.addEventListener('click', () => {
        if (typeof this.onHistoryCardClick === 'function') {
          this.onHistoryCardClick(analysis);
        }
      });

      grid.appendChild(card);
    });
  }

  /**
   * Limpa a seção de resultado.
   */
  clearResult() {
    const section = document.getElementById('result-section');
    if (section) {
      section.innerHTML = '';
    }
  }

  /**
   * Abre modal de configuração de API key com glassmorphism.
   * 
   * @param {string} existingKey — Chave existente (se houver)
   * @param {boolean} isRemembered — Se a chave deve ser lembrada no dispositivo
   * @returns {Promise<{key: string, remember: boolean}>} — Resolve com a chave e a opção de persistência
   */
  showApiKeyModal(existingKey = '', isRemembered = false) {
    return new Promise((resolve) => {
      // Remove modal existente, se houver
      const existente = document.querySelector('.modal-overlay');
      if (existente) existente.remove();

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';

      const keyVal = existingKey ? existingKey.trim() : '';

      overlay.innerHTML = `
        <div class="modal-content glass-card-accent">
          <h2 class="modal-title">🔑 Configurar API Key</h2>
          <p class="modal-description">
            Insira sua chave da API Gemini para usar o DeepTrace.
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" class="modal-link">
              Obter chave →
            </a>
          </p>
          <div class="modal-input-group">
            <input
              type="password"
              class="modal-input"
              placeholder="Cole sua API key aqui..."
              value="${this._escapeHtml(keyVal)}"
              autocomplete="off"
              spellcheck="false"
            />
            <button class="modal-toggle-visibility" type="button" title="Mostrar/ocultar chave">
              👁️
            </button>
          </div>
          <div class="modal-checkbox-group" style="margin-top: 15px; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-muted);">
            <input 
              type="checkbox" 
              id="modal-remember-key" 
              style="cursor: pointer; width: auto; height: auto;" 
              ${isRemembered ? 'checked' : ''} 
            />
            <label for="modal-remember-key" style="cursor: pointer; user-select: none;">
              Lembrar chave neste dispositivo (armazenamento criptografado)
            </label>
          </div>
          <div class="modal-actions" style="margin-top: 20px;">
            <button class="btn-secondary modal-cancel">Cancelar</button>
            <button class="btn-primary modal-save" ${keyVal ? '' : 'disabled'}>Salvar</button>
          </div>
        </div>
      `;

      const input = overlay.querySelector('.modal-input');
      const checkbox = overlay.querySelector('#modal-remember-key');
      const btnSalvar = overlay.querySelector('.modal-save');
      const btnCancelar = overlay.querySelector('.modal-cancel');
      const btnToggle = overlay.querySelector('.modal-toggle-visibility');

      // Alternar visibilidade da chave
      btnToggle.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
      });

      // Habilitar botão salvar quando há conteúdo
      input.addEventListener('input', () => {
        btnSalvar.disabled = input.value.trim().length === 0;
      });

      // Salvar chave
      const salvar = () => {
        const chave = input.value.trim();
        if (!chave) return;

        overlay.remove();
        const rememberVal = checkbox.checked;
        
        if (typeof this.onApiKeySaved === 'function') {
          this.onApiKeySaved(chave);
        }
        resolve({ key: chave, remember: rememberVal });
      };

      btnSalvar.addEventListener('click', salvar);

      // Enter para salvar
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') salvar();
        if (e.key === 'Escape') fechar();
      });

      // Fechar modal
      const fechar = () => {
        overlay.remove();
        resolve(null);
      };

      btnCancelar.addEventListener('click', fechar);

      // Fechar ao clicar no overlay (fora do modal)
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) fechar();
      });

      document.body.appendChild(overlay);

      // Foco automático no campo
      setTimeout(() => input.focus(), 100);
    });
  }

  /**
   * Exibe uma notificação toast no canto superior direito.
   * 
   * @param {string} message — Texto da notificação
   * @param {'success'|'error'|'info'} type — Tipo da notificação
   */
  showToast(message, type = 'info') {
    // Cria container de toasts se não existir
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }

    const icones = {
      success: '✅',
      error: '❌',
      info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type} fade-in-up`;
    toast.innerHTML = `
      <span class="toast__icon">${icones[type] || icones.info}</span>
      <span class="toast__message">${this._escapeHtml(message)}</span>
      <button class="toast__close" aria-label="Fechar notificação">&times;</button>
    `;

    // Fechar manualmente
    toast.querySelector('.toast__close').addEventListener('click', () => {
      this._removeToast(toast);
    });

    toastContainer.appendChild(toast);

    // Auto-remoção após 4 segundos
    const timeoutId = setTimeout(() => {
      this._removeToast(toast);
    }, 4000);

    this._toastTimeouts.push(timeoutId);
  }

  /**
   * Configura Intersection Observer para animar seções ao entrarem na viewport.
   * Adiciona a classe 'visible' quando o elemento entra na tela.
   */
  initScrollAnimations() {
    const opcoes = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Para de observar após a primeira animação
          observer.unobserve(entry.target);
        }
      });
    }, opcoes);

    // Observa todas as seções e elementos animáveis
    const alvos = document.querySelectorAll(
      'section, .fade-in-up, .glass-card, .glass-card-accent'
    );

    alvos.forEach((alvo) => observer.observe(alvo));
  }

  // ─────────────────────────────────────────────
  // MÉTODOS AUXILIARES PRIVADOS
  // ─────────────────────────────────────────────

  /**
   * Cria o SVG do gauge circular de score.
   * 
   * @param {number} score — Valor do score (0-100)
   * @returns {string} — HTML do gauge SVG
   */
  _createScoreGauge(score) {
    const cor = this._getScoreColor(score);
    const raio = 70;
    const circunferencia = 2 * Math.PI * raio;
    const progresso = circunferencia - (score / 100) * circunferencia;

    return `
      <div class="score-gauge" role="img" aria-label="Score de confiabilidade: ${score}%">
        <svg viewBox="0 0 180 180" class="score-gauge__svg">
          <!-- Trilha de fundo -->
          <circle
            cx="90" cy="90" r="${raio}"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            stroke-width="10"
          />
          <!-- Arco de progresso -->
          <circle
            cx="90" cy="90" r="${raio}"
            fill="none"
            stroke="${cor}"
            stroke-width="10"
            stroke-linecap="round"
            stroke-dasharray="${circunferencia}"
            stroke-dashoffset="${circunferencia}"
            data-target-offset="${progresso}"
            class="score-gauge__progress"
            transform="rotate(-90 90 90)"
          />
          <!-- Brilho do arco -->
          <circle
            cx="90" cy="90" r="${raio}"
            fill="none"
            stroke="${cor}"
            stroke-width="10"
            stroke-linecap="round"
            stroke-dasharray="${circunferencia}"
            stroke-dashoffset="${circunferencia}"
            data-target-offset="${progresso}"
            class="score-gauge__glow"
            transform="rotate(-90 90 90)"
            filter="url(#gaugeGlow)"
            opacity="0.4"
          />
          <!-- Filtro de brilho -->
          <defs>
            <filter id="gaugeGlow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>
        <div class="score-gauge__value" style="color: ${cor};">
          <span class="score-gauge__number" data-target="${score}">0</span>
          <span class="score-gauge__percent">%</span>
        </div>
      </div>
    `;
  }

  /**
   * Retorna a cor CSS baseada no score.
   * 
   * @param {number} score — Valor do score (0-100)
   * @returns {string} — Cor hexadecimal
   */
  _getScoreColor(score) {
    if (score <= 30) return '#ef4444';  // Vermelho — pouco confiável
    if (score <= 60) return '#f59e0b';  // Amarelo — parcialmente confiável
    return '#10b981';                    // Verde — confiável
  }

  /**
   * Retorna emoji/ícone baseado no veredito.
   * 
   * @param {string} verdict — Texto do veredito
   * @returns {string} — Emoji correspondente
   */
  _getVerdictIcon(verdict) {
    if (!verdict) return '❓';

    const v = verdict.toLowerCase();
    if (v.includes('verdadeir') || v.includes('confiável') || v.includes('verificad')) return '✅';
    if (v.includes('fals') || v.includes('enganoso') || v.includes('fake')) return '🚫';
    if (v.includes('parcial') || v.includes('mist') || v.includes('duvidoso')) return '⚠️';
    return '🔍';
  }

  /**
   * Formata timestamp para data legível em pt-BR.
   * 
   * @param {number|string|Date} timestamp — Data para formatar
   * @returns {string} — Data formatada
   */
  _formatDate(timestamp) {
    if (!timestamp) return 'Data indisponível';

    try {
      const data = new Date(timestamp);
      return data.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Data inválida';
    }
  }

  /**
   * Anima a contagem do score de 0 ao valor final.
   * 
   * @param {HTMLElement} element — Elemento que contém o número
   * @param {number} targetScore — Score final para animar até
   */
  _animateScoreCounter(element, targetScore) {
    const duracao = 1500; // ms
    const inicio = performance.now();

    const animar = (agora) => {
      const progresso = Math.min((agora - inicio) / duracao, 1);
      // Easing: desaceleração suave (ease-out cubic)
      const eased = 1 - Math.pow(1 - progresso, 3);
      const valorAtual = Math.round(eased * targetScore);

      element.textContent = valorAtual;

      if (progresso < 1) {
        requestAnimationFrame(animar);
      }
    };

    requestAnimationFrame(animar);
  }

  /**
   * Anima o arco do gauge SVG do valor inicial até o offset alvo.
   * 
   * @param {HTMLElement} container — Container do gauge
   */
  _animateGaugeArc(container) {
    const arcos = container.querySelectorAll('[data-target-offset]');
    const duracao = 1500;
    const inicio = performance.now();

    arcos.forEach((arco) => {
      const circunferencia = parseFloat(arco.getAttribute('stroke-dasharray'));
      const offsetAlvo = parseFloat(arco.dataset.targetOffset);

      const animar = (agora) => {
        const progresso = Math.min((agora - inicio) / duracao, 1);
        const eased = 1 - Math.pow(1 - progresso, 3);
        const offsetAtual = circunferencia - eased * (circunferencia - offsetAlvo);

        arco.setAttribute('stroke-dashoffset', offsetAtual);

        if (progresso < 1) {
          requestAnimationFrame(animar);
        }
      };

      requestAnimationFrame(animar);
    });
  }

  // ─────────────────────────────────────────────
  // MÉTODOS DE RENDERIZAÇÃO DE CAMADAS (PRIVADOS)
  // ─────────────────────────────────────────────

  /**
   * Renderiza a CAMADA 1 — Score, veredito e resumo.
   * 
   * @param {Object} analysis — Dados da análise
   * @returns {HTMLElement} — Elemento da camada
   */
  _renderScoreLayer(analysis) {
    const layer = document.createElement('div');
    layer.className = 'result-layer result-layer--score glass-card-accent';

    const cor = this._getScoreColor(analysis.overallScore);
    const icone = this._getVerdictIcon(analysis.verdict);

    layer.innerHTML = `
      ${this._createScoreGauge(analysis.overallScore)}
      <div class="result-verdict" style="color: ${cor};">
        <span class="result-verdict__icon">${icone}</span>
        <h2 class="result-verdict__text">${this._escapeHtml(analysis.verdict || 'Análise concluída')}</h2>
      </div>
      <p class="result-summary">${this._escapeHtml(analysis.summary || '')}</p>

      <div class="score-legend-box">
        <p class="score-legend__title">💡 Como interpretar este score:</p>
        <p class="score-legend__text">
          Este termômetro indica a confiabilidade geral do vídeo analisado por IA. Ele avalia se as falas são verdadeiras e se há manipulações de áudio/imagem:
        </p>
        <div class="score-ranges-bar">
          <div class="score-range range--low">
            <span class="range-indicator" style="background-color: var(--danger);"></span>
            <span class="range-label"><strong>0 a 30%</strong>: Falso ou Manipulado</span>
          </div>
          <div class="score-range range--mid">
            <span class="range-indicator" style="background-color: var(--warning);"></span>
            <span class="range-label"><strong>31 a 60%</strong>: Impreciso ou Misturado</span>
          </div>
          <div class="score-range range--high">
            <span class="range-indicator" style="background-color: var(--success);"></span>
            <span class="range-label"><strong>61 a 100%</strong>: Verdadeiro e Seguro</span>
          </div>
        </div>
      </div>
    `;

    // Inicia animações após inserção no DOM
    requestAnimationFrame(() => {
      // Anima o contador de score
      const numEl = layer.querySelector('.score-gauge__number');
      if (numEl) {
        this._animateScoreCounter(numEl, analysis.overallScore);
      }

      // Anima o arco do gauge
      this._animateGaugeArc(layer);
    });

    return layer;
  }

  /**
   * Renderiza a camada forense de análise de deepfake / geração por IA.
   * 
   * @param {Object} deepfakeData — Dados de análise de deepfake
   * @param {string} platform — Origem do vídeo ('upload', 'youtube', etc.)
   * @returns {HTMLElement} — Elemento da camada
   */
  _renderDeepfakeAnalysisLayer(deepfakeData, platform = '') {
    const layer = document.createElement('div');
    layer.className = 'result-layer result-layer--forensic glass-card';

    // Valores padrão se ausentes
    const data = deepfakeData || {
      detected: false,
      confidence: 0,
      lipSync: 'Não avaliado',
      faceArtifacts: 'Não avaliado',
      lightingCoherence: 'Não avaliado',
      blinkingPattern: 'Não avaliado',
      details: 'Não foi possível processar a análise forense de deepfake.'
    };

    const detectado = !!data.detected;
    const corDetecao = detectado ? 'var(--danger)' : 'var(--success)';
    const badgeTexto = detectado ? '⚠️ ALTO RISCO DE DEEPFAKE / IA' : '✅ BAIXO RISCO / SEM INDÍCIOS DE IA';
    const badgeClasse = detectado ? 'forensic-status--danger' : 'forensic-status--success';

    // Determina a cor dos badges dos indicadores
    const getIndicatorClass = (text) => {
        const t = (text || '').toLowerCase();
        if (t.includes('inconsistente') || t.includes('ruim') || t.includes('anormal')) return 'status-badge--danger';
        if (t.includes('suspeito') || t.includes('parcial') || t.includes('atraso')) return 'status-badge--warning';
        return 'status-badge--success';
    };

    // Extrai a primeira palavra do status para o badge
    const getFirstWord = (text) => {
        return (text || '').split(' ')[0].replace(/[^a-zA-ZáéíóúâêôãõçÀÉÍÓÚÂÊÔÃÕÇ]/g, '');
    };

    layer.innerHTML = `
      <div class="expandable-header" role="button" tabindex="0" aria-expanded="false">
        <h3 class="section-title">🔬 Laudo Forense de Inteligência Artificial (Deepfake)</h3>
        <span class="expandable-chevron">▼</span>
      </div>
      <div class="expandable-content" aria-hidden="true">
        ${platform !== 'upload' ? `
        <div class="forensic-notice-box" style="margin-bottom: 20px; padding: 12px 16px; border-radius: 8px; background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.2); display: flex; align-items: flex-start; gap: 12px;">
          <span style="font-size: 1.25rem; line-height: 1;">ℹ️</span>
          <p style="margin: 0; font-size: 0.85rem; color: #a5f3fc; line-height: 1.45; text-align: left;">
            <strong>Análise Forense Visual Limitada</strong>: Como a verificação foi iniciada por link (URL), o modelo de IA não tem acesso direto aos frames do vídeo para analisar elementos visuais (movimentos faciais, compressão, piscadas). Para obter um laudo completo desses indicadores, faça o <strong>upload direto do arquivo do vídeo (.mp4, .webm)</strong>.
          </p>
        </div>
        ` : ''}
        <div class="forensic-summary-box">
          <div class="forensic-badge ${badgeClasse}">
            ${badgeTexto}
          </div>
          
          <div class="forensic-confidence">
            <div class="confidence-info">
              <span>Certeza do diagnóstico de IA:</span>
              <strong style="color: ${corDetecao};">${data.confidence}%</strong>
            </div>
            <div class="forensic-progress-bar">
              <div class="forensic-progress-fill" style="width: ${data.confidence}%; background-color: ${corDetecao};"></div>
            </div>
          </div>
        </div>

        <div class="forensic-indicators-grid">
          <div class="indicator-card">
            <div class="indicator-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="indicator-icon">👄</span>
                <span class="indicator-name">Sincronia Labial</span>
              </div>
              <span class="indicator-status-badge ${getIndicatorClass(data.lipSync)}">
                ${getFirstWord(data.lipSync)}
              </span>
            </div>
            <p class="indicator-desc">${this._escapeHtml(data.lipSync)}</p>
          </div>

          <div class="indicator-card">
            <div class="indicator-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="indicator-icon">👤</span>
                <span class="indicator-name">Textura e Bordas Faciais</span>
              </div>
              <span class="indicator-status-badge ${getIndicatorClass(data.faceArtifacts)}">
                ${getFirstWord(data.faceArtifacts)}
              </span>
            </div>
            <p class="indicator-desc">${this._escapeHtml(data.faceArtifacts)}</p>
          </div>

          <div class="indicator-card">
            <div class="indicator-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="indicator-icon">☀️</span>
                <span class="indicator-name">Coerência de Luz</span>
              </div>
              <span class="indicator-status-badge ${getIndicatorClass(data.lightingCoherence)}">
                ${getFirstWord(data.lightingCoherence)}
              </span>
            </div>
            <p class="indicator-desc">${this._escapeHtml(data.lightingCoherence)}</p>
          </div>

          <div class="indicator-card">
            <div class="indicator-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="indicator-icon">👁️</span>
                <span class="indicator-name">Padrão de Piscadas</span>
              </div>
              <span class="indicator-status-badge ${getIndicatorClass(data.blinkingPattern)}">
                ${getFirstWord(data.blinkingPattern)}
              </span>
            </div>
            <p class="indicator-desc">${this._escapeHtml(data.blinkingPattern)}</p>
          </div>
        </div>

        <div class="forensic-details-box">
          <p class="forensic-details-title">Parecer Técnico Detalhado:</p>
          <p class="forensic-details-text">${this._escapeHtml(data.details)}</p>
        </div>
      </div>
    `;

    this._setupExpandable(layer);
    return layer;
  }

  /**
   * Renderiza a CAMADA 2 — Alegações verificadas.
   * 
   * @param {Array} claims — Lista de alegações
   * @returns {HTMLElement} — Elemento da camada
   */
  _renderClaimsLayer(claims) {
    const layer = document.createElement('div');
    layer.className = 'result-layer result-layer--claims glass-card';

    const temClaims = claims && claims.length > 0;

    layer.innerHTML = `
      <div class="expandable-header" role="button" tabindex="0" aria-expanded="false">
        <h3 class="section-title">📋 Alegações Verificadas ${temClaims ? `(${claims.length})` : ''}</h3>
        <span class="expandable-chevron">▼</span>
      </div>
      <div class="expandable-content" aria-hidden="true">
        ${temClaims ? `
          <div class="claims-help-box">
            <p class="claims-help-text">
              📌 <strong>Como ler esta seção:</strong> Nossa IA analisou o vídeo e separou as principais afirmações feitas. O percentual (%) indica a <strong>certeza da IA</strong> (de 0 a 100%) sobre a veracidade de cada alegação específica com base em fatos e fontes jornalísticas conhecidas.
            </p>
          </div>
          ${this._renderClaimCards(claims)}
        ` : '<p class="no-data">Nenhuma alegação identificada.</p>'}
      </div>
    `;

    this._setupExpandable(layer);
    return layer;
  }

  /**
   * Renderiza os cards individuais de alegações.
   * 
   * @param {Array} claims — Lista de alegações
   * @returns {string} — HTML dos cards
   */
  _renderClaimCards(claims) {
    return claims.map((claim, index) => {
      const confianca = claim.confidence != null ? claim.confidence : 50;
      const cor = this._getScoreColor(confianca);
      const veredito = (claim.verdict || '').toLowerCase();

      let icone = '❓';
      let iconeClasse = 'claim-icon--unknown';

      if (veredito.includes('verdadeir') || veredito === 'true') {
        icone = '✓';
        iconeClasse = 'claim-icon--true';
      } else if (veredito.includes('fals') || veredito === 'false') {
        icone = '✗';
        iconeClasse = 'claim-icon--false';
      } else if (veredito.includes('parcial')) {
        icone = '⚠';
        iconeClasse = 'claim-icon--warning';
      }

      const textoAlegacao = claim.claim || claim.text || 'Alegação não especificada';
      const raciocinio = claim.reasoning || '';
      const fontes = Array.isArray(claim.sources) ? claim.sources : (claim.source ? [claim.source] : []);

      return `
        <div class="claim-card" style="animation-delay: ${index * 0.1}s;">
          <div class="claim-card__header">
            <span class="claim-card__icon ${iconeClasse}">${icone}</span>
            <span class="claim-card__text">${this._escapeHtml(textoAlegacao)}</span>
            <span class="claim-card__score badge" style="background: ${cor}22; color: ${cor}; border: 1px solid ${cor}44;">
              ${confianca}%
            </span>
          </div>
          ${raciocinio ? `
            <div class="claim-card__reasoning">
              <div class="expandable-header expandable-header--mini" role="button" tabindex="0" aria-expanded="false">
                <span>Ver raciocínio</span>
                <span class="expandable-chevron expandable-chevron--mini">▼</span>
              </div>
              <div class="expandable-content expandable-content--mini" aria-hidden="true">
                <p>${this._escapeHtml(raciocinio)}</p>
                ${fontes.length > 0 ? `
                  <div class="claim-sources" style="margin-top: 8px;">
                    <strong style="font-size: 0.8rem; color: var(--text-muted);">Fontes:</strong>
                    ${fontes.map(f => `<span class="badge badge-info" style="margin-left: 4px; font-size: 0.75rem;">${this._escapeHtml(f)}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Renderiza a CAMADA 3 — Técnicas de manipulação detectadas.
   * 
   * @param {Array} techniques — Lista de técnicas
   * @returns {HTMLElement} — Elemento da camada
   */
  _renderManipulationLayer(techniques) {
    const layer = document.createElement('div');
    layer.className = 'result-layer result-layer--manipulation glass-card';

    const temTecnicas = techniques && techniques.length > 0;

    // Cores variadas para os badges de técnicas
    const coresBadges = [
      '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899',
      '#f97316', '#06b6d4', '#84cc16', '#6366f1'
    ];

    const badgesHtml = temTecnicas
      ? techniques.map((tecnica, i) => {
          const corBadge = coresBadges[i % coresBadges.length];
          const nome = typeof tecnica === 'string' ? tecnica : tecnica.name || tecnica.technique || '';
          return `<span class="badge badge--technique" style="background: ${corBadge}22; color: ${corBadge}; border: 1px solid ${corBadge}44;">
            ${this._escapeHtml(nome)}
          </span>`;
        }).join('')
      : '';

    layer.innerHTML = `
      <div class="expandable-header" role="button" tabindex="0" aria-expanded="false">
        <h3 class="section-title">🎭 Técnicas de Manipulação Detectadas</h3>
        <span class="expandable-chevron">▼</span>
      </div>
      <div class="expandable-content" aria-hidden="true">
        ${temTecnicas
          ? `
            <div class="techniques-help-box">
              <p class="techniques-help-text">
                📌 <strong>Entenda as técnicas:</strong> Estas etiquetas mostram truques de persuasão ou edições de áudio/vídeo usadas no vídeo para tentar influenciar a opinião pública de forma enganosa ou apelar excessivamente às emoções.
              </p>
            </div>
            <div class="techniques-grid">${badgesHtml}</div>
          `
          : '<p class="no-data">✅ Nenhuma técnica de manipulação óbvia detectada.</p>'
        }
      </div>
    `;

    this._setupExpandable(layer);
    return layer;
  }

  /**
   * Renderiza a CAMADA 4 — Transcrição completa com metadados.
   * 
   * @param {Object} metadata — Metadados da análise
   * @param {boolean} transcriptImported — Indica se a transcrição veio da extensão
   * @returns {HTMLElement} — Elemento da camada
   */
  _renderTranscriptionLayer(metadata, transcriptImported = false) {
    const layer = document.createElement('div');
    layer.className = 'result-layer result-layer--transcription glass-card';

    const transcricao = metadata?.transcription || metadata?.transcript || '';
    const idioma = metadata?.language || 'Não identificado';
    const duracao = metadata?.duration || metadata?.estimatedDuration || 'N/A';

    layer.innerHTML = `
      <div class="expandable-header" role="button" tabindex="0" aria-expanded="false">
        <h3 class="section-title">📝 Transcrição Completa</h3>
        <span class="expandable-chevron">▼</span>
      </div>
      <div class="expandable-content" aria-hidden="true">
        <div class="transcription-meta">
          <span class="badge">🌐 ${this._escapeHtml(idioma)}</span>
          <span class="badge">⏱️ ${this._escapeHtml(String(duracao))}</span>
          ${transcriptImported ? `
            <span class="badge" style="background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25);">
              🔌 Legenda da Extensão
            </span>
          ` : ''}
        </div>
        <div class="transcription-text">
          ${transcricao
            ? `<p>${this._escapeHtml(transcricao)}</p>`
            : '<p class="no-data">Transcrição não disponível.</p>'
          }
        </div>
      </div>
    `;

    this._setupExpandable(layer);
    return layer;
  }

  // ─────────────────────────────────────────────
  // UTILITÁRIOS INTERNOS
  // ─────────────────────────────────────────────

  /**
   * Configura o comportamento de expandir/colapsar em uma camada.
   * 
   * @param {HTMLElement} layer — Elemento contendo expandable-header e expandable-content
   */
  _setupExpandable(layer) {
    const headers = layer.querySelectorAll('.expandable-header');

    headers.forEach((header) => {
      const content = header.nextElementSibling;
      if (!content || !content.classList.contains('expandable-content')) return;

      const alternar = () => {
        const expandido = header.getAttribute('aria-expanded') === 'true';
        header.setAttribute('aria-expanded', !expandido);
        content.setAttribute('aria-hidden', expandido);

        if (!expandido) {
          content.style.maxHeight = content.scrollHeight + 'px';
          content.style.opacity = '1';
          header.querySelector('.expandable-chevron').style.transform = 'rotate(180deg)';
        } else {
          content.style.maxHeight = '0';
          content.style.opacity = '0';
          header.querySelector('.expandable-chevron').style.transform = 'rotate(0deg)';
        }
      };

      header.addEventListener('click', alternar);

      // Acessibilidade: permitir ativação via teclado
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          alternar();
        }
      });
    });
  }

  /**
   * Remove um toast com animação de fade out.
   * 
   * @param {HTMLElement} toast — Elemento do toast a remover
   */
  _removeToast(toast) {
    if (!toast || !toast.parentNode) return;

    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  /**
   * Escapa caracteres HTML para evitar XSS.
   * 
   * @param {string} text — Texto a ser escapado
   * @returns {string} — Texto seguro para inserção em HTML
   */
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
