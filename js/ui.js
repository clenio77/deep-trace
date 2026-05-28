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

    const container = document.createElement('div');
    container.className = 'loading-container fade-in-up visible';
    container.style.cssText = 'max-width: 600px; margin: 0 auto; padding: 40px 24px; text-align: left;';
    container.innerHTML = `
      <div class="loading-header" style="text-align: center; margin-bottom: 24px;">
        <h3 style="font-size: 1.3rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Auditoria de Vídeo em Andamento</h3>
        <p class="loading-estimate" style="font-size: 0.85rem; color: var(--text-secondary);">
          Tempo estimado: ~30s | <span style="color: var(--accent-primary);">Decorridos: <span id="loading-timer">0</span>s</span>
        </p>
      </div>
      
      <div class="loading-progress-bar" style="background: rgba(255,255,255,0.05); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 32px;">
        <div class="loading-progress-fill" id="loading-progress-fill" style="width: 0%; height: 100%; background: var(--accent-gradient); transition: width 0.4s ease;"></div>
      </div>

      <div class="loading-steps" style="display: flex; flex-direction: column; gap: 20px;">
        <div class="loading-step active" id="step-metadata" style="display: flex; gap: 16px; align-items: flex-start; opacity: 0.5; transition: opacity 0.3s ease;">
          <div class="step-icon" style="font-size: 1.2rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 50%;">⏳</div>
          <div class="step-details">
            <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin: 0 0 2px;">1. Extraindo Metadados & Legendas</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Lendo informações do vídeo e buscando legendas oficiais/extensão...</p>
          </div>
        </div>
        <div class="loading-step" id="step-transcription" style="display: flex; gap: 16px; align-items: flex-start; opacity: 0.3; transition: opacity 0.3s ease;">
          <div class="step-icon" style="font-size: 1.2rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 50%;">⚪</div>
          <div class="step-details">
            <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin: 0 0 2px;">2. Transcrição Multimodal</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Processando áudio falado e organizando a linha temporal do texto...</p>
          </div>
        </div>
        <div class="loading-step" id="step-verification" style="display: flex; gap: 16px; align-items: flex-start; opacity: 0.3; transition: opacity 0.3s ease;">
          <div class="step-icon" style="font-size: 1.2rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 50%;">⚪</div>
          <div class="step-details">
            <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin: 0 0 2px;">3. Investigação Contextual & Fact-Checking</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Confrontando alegações com a Web em tempo real por meio de busca inteligente...</p>
          </div>
        </div>
        <div class="loading-step" id="step-report" style="display: flex; gap: 16px; align-items: flex-start; opacity: 0.3; transition: opacity 0.3s ease;">
          <div class="step-icon" style="font-size: 1.2rem; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 50%;">⚪</div>
          <div class="step-details">
            <h4 style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary); margin: 0 0 2px;">4. Compilando Relatório de Auditoria</h4>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">Montando scores gerais, vereditos de claims e links de referências...</p>
          </div>
        </div>
      </div>
    `;

    section.appendChild(container);

    // Ajusta opacity da primeira etapa ativa imediatamente
    document.getElementById('step-metadata').style.opacity = '1';

    let startTime = Date.now();
    let currentFillWidth = 0;

    const timerEl = document.getElementById('loading-timer');
    const fillEl = document.getElementById('loading-progress-fill');
    
    // Intervalo de cronômetro e simulador de progresso
    this._loadingTimerInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (timerEl) {
        timerEl.textContent = elapsed;
      }

      // Lógica de progressão das etapas e barra de progresso com base no tempo
      if (elapsed < 3) {
        // Etapa 1 ativa
        currentFillWidth = Math.min(15, elapsed * 5);
      } else if (elapsed === 3) {
        // Conclui Etapa 1, inicia Etapa 2
        this._setStepState('step-metadata', 'completed', '✅');
        this._setStepState('step-transcription', 'active', '⏳');
        currentFillWidth = 25;
      } else if (elapsed > 3 && elapsed < 12) {
        // Etapa 2 ativa (vai até 55%)
        currentFillWidth = 25 + Math.round(((elapsed - 3) / 9) * 30);
      } else if (elapsed === 12) {
        // Conclui Etapa 2, inicia Etapa 3
        this._setStepState('step-transcription', 'completed', '✅');
        this._setStepState('step-verification', 'active', '⏳');
        currentFillWidth = 60;
      } else if (elapsed > 12 && elapsed < 22) {
        // Etapa 3 ativa (vai até 85%)
        currentFillWidth = 60 + Math.round(((elapsed - 12) / 10) * 25);
      } else if (elapsed === 22) {
        // Conclui Etapa 3, inicia Etapa 4
        this._setStepState('step-verification', 'completed', '✅');
        this._setStepState('step-report', 'active', '⏳');
        currentFillWidth = 90;
      } else if (elapsed > 22 && elapsed < 35) {
        // Etapa 4 ativa (limita em 98%)
        currentFillWidth = 90 + Math.round(((elapsed - 22) / 13) * 8);
      } else if (elapsed >= 35) {
        currentFillWidth = 98;
      }

      if (fillEl) {
        fillEl.style.width = currentFillWidth + '%';
      }
    }, 1000);

    // Scroll suave até a seção
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Altera o estado visual de uma etapa do loading.
   * @private
   */
  _setStepState(stepId, state, icon) {
    const stepEl = document.getElementById(stepId);
    if (!stepEl) return;

    if (state === 'active') {
      stepEl.style.opacity = '1';
      const iconEl = stepEl.querySelector('.step-icon');
      if (iconEl) {
        iconEl.textContent = icon;
        iconEl.style.background = 'rgba(255, 255, 255, 0.05)';
        iconEl.style.color = 'var(--text-primary)';
      }
    } else if (state === 'completed') {
      stepEl.style.opacity = '0.7';
      const iconEl = stepEl.querySelector('.step-icon');
      if (iconEl) {
        iconEl.textContent = icon;
        iconEl.style.background = 'var(--success-soft)';
        iconEl.style.color = 'var(--success)';
      }
    }
  }

  /**
   * Remove o loading e limpa o intervalo.
   */
  hideLoading() {
    if (this._loadingTimerInterval) {
      clearInterval(this._loadingTimerInterval);
      this._loadingTimerInterval = null;
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

    // ── CAMADA 2: Linha do Tempo Contextual (Claims Ordenados) ──
    wrapper.appendChild(this._renderTimelineLayer(analysis.claims));

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
        <div class="history-empty glass-card" style="text-align: center; padding: 48px 24px; width: 100%; grid-column: 1 / -1;">
          <div class="empty-icon" style="font-size: 3rem; margin-bottom: 16px; opacity: 0.7;">📊</div>
          <p style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">Nenhuma análise encontrada</p>
          <p class="empty-subtext" style="font-size: 0.85rem; color: var(--text-muted); max-width: 320px; margin: 0 auto 24px; line-height: 1.5;">
            Cole um link de vídeo ou envie um arquivo acima para iniciar sua primeira auditoria de desinformação.
          </p>
          <a href="#analyze" class="btn-primary" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none; padding: 10px 20px; font-size: 0.85rem; border-radius: var(--radius-md); font-weight: 600; margin: 0 auto;">
            🔍 Analisar Novo Vídeo
          </a>
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
          <h3 class="history-card__title">${this._escapeHtml(analysis.title || 'Análise sem título')}</h3>
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

    // Botão limpar histórico
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'history-actions';
    actionsDiv.innerHTML = `
      <button class="btn-clear-history" id="btn-clear-history">🗑️ Limpar Histórico</button>
    `;
    grid.parentNode.appendChild(actionsDiv);
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
   * Renderiza contadores de métricas animados.
   * @param {Object} metrics — {total, fakeCount, avgScore}
   */
  renderMetrics(metrics) {
    const metricTotal = document.getElementById('metric-total');
    const metricFake = document.getElementById('metric-fake');
    const metricScore = document.getElementById('metric-score');

    if (metricTotal) {
      metricTotal.dataset.target = metrics.total;
      this._animateScoreCounter(metricTotal, metrics.total);
    }
    if (metricFake) {
      metricFake.dataset.target = metrics.fakeCount;
      this._animateScoreCounter(metricFake, metrics.fakeCount);
    }
    if (metricScore) {
      metricScore.dataset.target = metrics.avgScore;
      this._animateScoreCounter(metricScore, metrics.avgScore);
    }
  }

  /**
   * Inicializa o accordion da seção FAQ.
   */
  initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-question');
    faqItems.forEach((question) => {
      const answer = question.nextElementSibling;
      if (!answer) return;

      const toggle = () => {
        const expanded = question.getAttribute('aria-expanded') === 'true';
        question.setAttribute('aria-expanded', !expanded);

        if (!expanded) {
          answer.style.maxHeight = answer.scrollHeight + 'px';
          answer.style.paddingTop = '0';
        } else {
          answer.style.maxHeight = '0';
          answer.style.paddingTop = '0';
        }
      };

      question.addEventListener('click', toggle);
      question.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    });
  }

  /**
   * Exibe um modal de confirmação genérico.
   * @param {string} title — Título do modal
   * @param {string} message — Mensagem do modal
   * @returns {Promise<boolean>} — true se confirmou, false se cancelou
   */
  showConfirmModal(title, message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-modal-overlay';
      overlay.innerHTML = `
        <div class="confirm-modal">
          <h3>${this._escapeHtml(title)}</h3>
          <p>${this._escapeHtml(message)}</p>
          <div class="confirm-modal__actions">
            <button class="btn-secondary confirm-cancel">Cancelar</button>
            <button class="btn-primary confirm-ok" style="background: #ef4444;">Confirmar</button>
          </div>
        </div>
      `;

      overlay.querySelector('.confirm-cancel').addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });

      overlay.querySelector('.confirm-ok').addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });

      document.body.appendChild(overlay);
    });
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

    const isInconclusive = analysis.verdict === 'Inconclusivo';
    const hasNoClaims = !analysis.claims || analysis.claims.length === 0;

    let inconclusiveBanner = '';
    if (isInconclusive || hasNoClaims) {
      inconclusiveBanner = `
        <div class="inconclusive-banner" style="background: rgba(108, 92, 231, 0.08); border: 1px dashed rgba(108, 92, 231, 0.3); border-radius: var(--radius-md); padding: 16px; margin: 16px 0; text-align: left;">
          <h4 style="margin: 0 0 6px 0; color: #fff; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">💡 Dica para Análises mais precisas:</h4>
          <p style="margin: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.45;">
            Redes sociais como <strong>X (Twitter), Instagram e TikTok</strong> protegem seus conteúdos com telas de login e restrições de robôs, impedindo que IAs acessem e transcrevam o áudio diretamente pela URL.
          </p>
          <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.45;">
            <li><strong>Use nossa Extensão do Chrome</strong>: Ela captura a transcrição do vídeo diretamente da aba ativa no seu navegador.</li>
            <li><strong>Faça o upload do vídeo</strong>: Baixe o arquivo de vídeo no seu dispositivo e faça o upload dele no formulário acima. Isso permite que a IA analise o áudio e frames de forma direta por multimodalidade.</li>
          </ul>
        </div>
      `;
    }

    layer.innerHTML = `
      ${this._createScoreGauge(analysis.overallScore)}
      <div class="result-verdict" style="color: ${cor};">
        <span class="result-verdict__icon">${icone}</span>
        <h2 class="result-verdict__text">${this._escapeHtml(analysis.verdict || 'Análise concluída')}</h2>
      </div>
      <p class="result-summary">${this._escapeHtml(analysis.summary || '')}</p>

      ${inconclusiveBanner}

      <div class="score-legend-box">
        <p class="score-legend__title">💡 Como interpretar este score:</p>
        <p class="score-legend__text">
          Este termômetro indica a confiabilidade geral do vídeo analisado por IA. Ele avalia se as alegações feitas são baseadas em fatos reais e se o conteúdo foi apresentado no contexto correto:
        </p>
        <div class="score-ranges-bar">
          <div class="score-range range--low">
            <span class="range-indicator" style="background-color: var(--danger);"></span>
            <span class="range-label"><strong>0 a 30%</strong>: Falso ou Fora de Contexto</span>
          </div>
          <div class="score-range range--mid">
            <span class="range-indicator" style="background-color: var(--warning);"></span>
            <span class="range-label"><strong>31 a 60%</strong>: Impreciso ou Sem Contexto</span>
          </div>
          <div class="score-range range--high">
            <span class="range-indicator" style="background-color: var(--success);"></span>
            <span class="range-label"><strong>61 a 100%</strong>: Factual e Confiável</span>
          </div>
        </div>
      </div>
      <div class="result-actions" style="display: flex; gap: 12px; justify-content: center; margin-top: 16px; flex-wrap: wrap;">
        <button class="btn-reanalyze" id="btn-reanalyze" title="Forçar nova análise ignorando cache" style="margin-top: 0;">
          🔄 Re-analisar
        </button>
        <button class="btn-secondary" id="btn-share-report" title="Compartilhar relatório de auditoria" style="display: inline-flex; align-items: center; gap: 6px; padding: 10px 24px; border-radius: 10px; font-size: 0.9rem; font-weight: 500; cursor: pointer;">
          🔗 Compartilhar
        </button>
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
   * Renderiza a CAMADA 2 — Linha do Tempo Contextual com os claims ordenados cronologicamente.
   * 
   * @param {Array} claims — Lista de alegações
   * @returns {HTMLElement} — Elemento da camada
   */
  _renderTimelineLayer(claims) {
    const layer = document.createElement('div');
    layer.className = 'result-layer result-layer--timeline glass-card';

    const temClaims = claims && claims.length > 0;

    // Helper para converter timestamp MM:SS para segundos
    const parseTime = (ts) => {
      if (!ts || typeof ts !== 'string') return 0;
      const parts = ts.split(':').map(Number);
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return 0;
    };

    // Ordena os claims cronologicamente
    const sortedClaims = temClaims 
      ? [...claims].sort((a, b) => parseTime(a.timestamp) - parseTime(b.timestamp))
      : [];

    layer.innerHTML = `
      <div class="expandable-header" role="button" tabindex="0" aria-expanded="true">
        <h3 class="section-title">⏱️ Linha do Tempo de Investigação Contextual ${temClaims ? `(${claims.length})` : ''}</h3>
        <span class="expandable-chevron" style="transform: rotate(180deg);">▼</span>
      </div>
      <div class="expandable-content" aria-hidden="false" style="max-height: none; opacity: 1;">
        ${temClaims ? `
          <div class="timeline-help-box">
            <p class="timeline-help-text">
              📌 <strong>Entenda a Timeline:</strong> Abaixo estão as alegações (claims) extraídas do áudio e texto do vídeo ordenadas cronologicamente. Cada ponto na linha do tempo exibe o veredito contextual e as fontes coletadas na busca automática da IA.
            </p>
          </div>
          <div class="timeline-container">
            ${this._renderTimelineItems(sortedClaims)}
          </div>
        ` : '<p class="no-data">Nenhuma alegação ou ponto temporal identificado.</p>'}
      </div>
    `;

    this._setupExpandable(layer);
    return layer;
  }

  /**
   * Renderiza os itens individuais da linha do tempo.
   * 
   * @param {Array} claims — Lista ordenada de alegações
   * @returns {string} — HTML dos itens
   */
  _renderTimelineItems(claims) {
    return claims.map((claim, index) => {
      const confianca = claim.confidence != null ? claim.confidence : 50;
      const cor = this._getScoreColor(confianca);
      const veredito = (claim.verdict || '').toLowerCase();

      let badgeIcon = '🔍';
      let statusClasse = 'timeline-status--unknown';

      if (veredito.includes('verdadeir') || veredito === 'true') {
        badgeIcon = '✅';
        statusClasse = 'timeline-status--true';
      } else if (veredito.includes('fals') || veredito === 'false') {
        badgeIcon = '🚫';
        statusClasse = 'timeline-status--false';
      } else if (veredito.includes('parcial')) {
        badgeIcon = '⚠️';
        statusClasse = 'timeline-status--warning';
      }

      const timestamp = claim.timestamp || '00:00';
      const textoAlegacao = claim.claim || claim.text || 'Alegação não especificada';
      const raciocinio = claim.reasoning || '';
      const fontes = Array.isArray(claim.sources) ? claim.sources : (claim.source ? [claim.source] : []);

      // Formata fontes para links se forem URLs reais, senão exibe como texto
      const renderFontes = (fontesList) => {
        if (!fontesList || fontesList.length === 0) return '';
        return `
          <div class="timeline-item__sources">
            <strong>Evidências & Checagens:</strong>
            <div class="sources-links">
              ${fontesList.map(f => {
                const isUrl = f.startsWith('http://') || f.startsWith('https://');
                if (isUrl) {
                  try {
                    const hostname = new URL(f).hostname.replace('www.', '');
                    return `<a href="${f}" target="_blank" rel="noopener noreferrer" class="source-link-pill">🔗 ${hostname}</a>`;
                  } catch {
                    return `<a href="${f}" target="_blank" rel="noopener noreferrer" class="source-link-pill">🔗 Link</a>`;
                  }
                }
                return `<span class="source-text-pill">📄 ${this._escapeHtml(f)}</span>`;
              }).join('')}
            </div>
          </div>
        `;
      };

      return `
        <div class="timeline-item" style="animation-delay: ${index * 0.1}s;">
          <div class="timeline-item__marker" style="border-color: ${cor}; background-color: var(--bg-primary);">
            <div class="marker-dot" style="background-color: ${cor};"></div>
          </div>
          <div class="timeline-item__time-badge">${this._escapeHtml(timestamp)}</div>
          <div class="timeline-item__content glass-card">
            <div class="timeline-item__header">
              <span class="timeline-verdict-badge ${statusClasse}">
                ${badgeIcon} ${claim.verdict || 'Inconclusivo'}
              </span>
              <span class="timeline-confidence-badge" style="color: ${cor}; background: ${cor}12; border: 1px solid ${cor}28;">
                Confiabilidade: ${confianca}%
              </span>
            </div>
            <h4 class="timeline-item__title">${this._escapeHtml(textoAlegacao)}</h4>
            <p class="timeline-item__reasoning">${this._escapeHtml(raciocinio)}</p>
            ${renderFontes(fontes)}
          </div>
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

  /**
   * Exibe o modal premium de compartilhamento nas redes sociais.
   * 
   * @param {Object} analysis — Objeto de análise ativo
   * @param {string} link — Link de compartilhamento da análise
   * @param {string} text — Texto resumido formatado para compartilhamento
   */
  showShareModal(analysis, link, text) {
    // Remove modal existente, se houver
    const existente = document.querySelector('.share-modal-overlay');
    if (existente) existente.remove();

    const overlay = document.createElement('div');
    overlay.className = 'share-modal-overlay';

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;

    overlay.innerHTML = `
      <div class="share-modal">
        <h3 style="margin-top: 0; font-size: 1.25rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
          📢 Compartilhar Investigação
        </h3>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: var(--space-md); line-height: 1.5;">
          Gere e baixe o card de investigação em imagem para Instagram/TikTok ou compartilhe o link diretamente.
        </p>

        <div class="share-card-preview-container">
          <canvas id="share-card-canvas" width="600" height="600" class="share-card-canvas"></canvas>
          <button id="btn-download-card" class="btn-secondary" style="font-size: 0.8rem; padding: 8px 16px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #fff; cursor: pointer; margin-top: 10px; width: 100%; justify-content: center;">
            📥 Baixar Card PNG (Stories/Posts)
          </button>
        </div>

        <div class="share-buttons-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: var(--space-md);">
          <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="share-btn share-whatsapp">
            🟢 WhatsApp
          </a>
          <a href="${xUrl}" target="_blank" rel="noopener noreferrer" class="share-btn share-x">
            🐦 X / Twitter
          </a>
          <a href="${telegramUrl}" target="_blank" rel="noopener noreferrer" class="share-btn share-telegram">
            🔵 Telegram
          </a>
          <button id="btn-copy-share-link" class="share-btn share-copy">
            🔗 Copiar Link
          </button>
        </div>

        <div class="share-tips-panel" style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; font-size: 0.78rem; color: var(--text-muted); line-height: 1.45; margin-bottom: var(--space-md);">
          <strong style="color: #fff; display: block; margin-bottom: 4px;">📸 Redes Visuais (Instagram & TikTok):</strong>
          1. Baixe o <strong>Card PNG</strong> clicando no botão acima.<br>
          2. Crie sua postagem ou stories nestas plataformas.<br>
          3. Cole o link nos stories via sticker ou coloque no link da bio!
        </div>

        <div class="modal-actions" style="margin-top: 15px;">
          <button class="btn-secondary modal-close" style="width: 100%; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer;">Fechar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('#share-card-canvas');
    if (canvas) {
      this._renderShareCardCanvas(analysis, canvas, link);
    }

    // Eventos
    const btnClose = overlay.querySelector('.modal-close');
    const fechar = () => {
      overlay.style.opacity = '0';
      overlay.querySelector('.share-modal').style.transform = 'translateY(20px)';
      setTimeout(() => overlay.remove(), 200);
    };

    btnClose.addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fechar();
    });

    // Copiar Link
    const btnCopy = overlay.querySelector('#btn-copy-share-link');
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(link).then(() => {
        this.showToast('Link copiado com sucesso!', 'success');
      }).catch(() => {
        this.showToast('Erro ao copiar link.', 'error');
      });
    });

    // Baixar Card
    const btnDownload = overlay.querySelector('#btn-download-card');
    btnDownload.addEventListener('click', () => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const tempLink = document.createElement('a');
        tempLink.href = dataUrl;
        tempLink.download = `deeptrace-auditoria-${analysis.id || 'video'}.png`;
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        this.showToast('Card baixado com sucesso!', 'success');
      } catch (err) {
        console.error(err);
        this.showToast('Falha ao baixar imagem do card.', 'error');
      }
    });
  }

  /**
   * Renderiza a imagem do card de compartilhamento utilizando a API 2D de Canvas.
   * 
   * @param {Object} analysis — Objeto de análise ativo
   * @param {HTMLCanvasElement} canvas — O elemento Canvas
   * @param {string} link — Link de compartilhamento da análise
   * @private
   */
  _renderShareCardCanvas(analysis, canvas, link) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Fundo gradiente
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#090a0f');
    gradient.addColorStop(0.5, '#121424');
    gradient.addColorStop(1, '#07080b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Borda neon decorativa
    ctx.strokeStyle = 'rgba(108, 92, 231, 0.3)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, width - 6, height - 6);

    // Grade sutil decorativa
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let i = 30; i < width; i += 30) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Cabeçalho
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('🔍 DeepTrace', 30, 50);

    ctx.fillStyle = '#8f8fa3';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('INVESTIGAÇÃO CONTEXTUAL DE VÍDEOS', 30, 72);

    // Linha horizontal
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(30, 90);
    ctx.lineTo(width - 30, 90);
    ctx.stroke();

    // Vídeo URL ou origem
    ctx.fillStyle = '#e2e2e9';
    ctx.font = 'italic 13px sans-serif';
    let originalUrl = analysis.url || 'Arquivo de Vídeo local';
    if (originalUrl.length > 55) {
      originalUrl = originalUrl.substring(0, 52) + '...';
    }
    ctx.fillText(`Vídeo: ${originalUrl}`, 30, 120);

    // Veredito e Score
    const score = analysis.overallScore !== undefined ? analysis.overallScore : 0;
    const verdict = analysis.verdict || 'Não Verificado';
    
    let scoreColor = '#ff3838'; // vermelho (0-30%)
    let scoreText = 'Falso ou Manipulado';
    if (score > 60) {
      scoreColor = '#2ed573'; // verde (61-100%)
      scoreText = 'Verdadeiro e Seguro';
    } else if (score > 30) {
      scoreColor = '#ffa502'; // amarelo (31-60%)
      scoreText = 'Impreciso ou Misturado';
    }

    // Card do Veredito (Container em destaque)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.beginPath();
    ctx.roundRect(30, 150, width - 60, 110, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.stroke();

    // Label do Veredito
    ctx.fillStyle = '#8f8fa3';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('VEREDITO FINAL DA AUDITORIA', 45, 178);

    // Veredito
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    let displayVerdict = verdict;
    if (displayVerdict.length > 25) {
      displayVerdict = displayVerdict.substring(0, 22) + '...';
    }
    ctx.fillText(displayVerdict, 45, 212);
    
    // Status text
    ctx.fillStyle = scoreColor;
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`● ${scoreText.toUpperCase()}`, 45, 240);

    // Círculo de score à direita
    const circleX = width - 90;
    const circleY = 205;
    const radius = 35;

    // Fundo do círculo
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(circleX, circleY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Arco preenchido
    ctx.strokeStyle = scoreColor;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(circleX, circleY, radius, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * (score / 100)));
    ctx.stroke();

    // Score texto centralizado
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${score}%`, circleX, circleY - 2);
    
    ctx.fillStyle = '#8f8fa3';
    ctx.font = 'bold 8px sans-serif';
    ctx.fillText('CONFIANÇA', circleX, circleY + 12);
    
    // Restaurar propriedades de alinhamento
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Resumo
    ctx.fillStyle = '#8f8fa3';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('RESUMO DOS FATOS E CONTEXTO', 30, 295);

    ctx.fillStyle = '#e2e2e9';
    ctx.font = '14px sans-serif';
    
    const wrapText = (text, x, y, maxWidth, lineHeight, maxLines = 5) => {
      const words = text.split(' ');
      let line = '';
      let currentY = y;
      let lineCount = 0;

      for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = ctx.measureText(testLine);
        let testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, x, currentY);
          line = words[n] + ' ';
          currentY += lineHeight;
          lineCount++;
          if (lineCount >= maxLines - 1) {
            ctx.fillText(line.trim() + '...', x, currentY);
            return;
          }
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, currentY);
    };

    const summaryText = analysis.summary || 'Nenhum resumo da investigação disponível.';
    wrapText(summaryText, 30, 322, width - 60, 20, 5);

    // Divisória do rodapé
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, height - 70);
    ctx.lineTo(width - 30, height - 70);
    ctx.stroke();

    // Rodapé
    ctx.fillStyle = '#6c5ce7';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('deeptrace.investigations.ai', 30, height - 38);

    ctx.fillStyle = '#8f8fa3';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    const fakeId = analysis.id ? analysis.id.substring(0, 8) : Math.floor(100000 + Math.random() * 900000);
    ctx.fillText(`ID: DT-${fakeId}`, width - 30, height - 38);
    
    // Restaurar alinhamento de texto para evitar efeitos indesejados
    ctx.textAlign = 'left';
  }
};
