/**
 * DeepTrace — Motor de Análise de Vídeos com IA
 *
 * Classe responsável por enviar vídeos (via URL ou upload) à API Gemini,
 * solicitar análise de veracidade e retornar um relatório estruturado
 * com score de confiabilidade, veredito e alegações verificadas.
 *
 * @author DeepTrace Team
 */

window.DeepTraceAnalyzer = class DeepTraceAnalyzer {

  /** Endpoint da API Gemini (modelo flash) */
  static GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  /** Tempo máximo de espera pela resposta da API (ms) */
  static TIMEOUT_MS = 120_000;

  /**
   * Cria uma instância do analisador.
   * @param {string} apiKey — Chave de API do Google Gemini
   * @throws {Error} Se a chave não for fornecida
   */
  constructor(apiKey) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      throw new Error(
        'Chave de API inválida. Forneça uma chave válida do Google Gemini para utilizar o DeepTrace.'
      );
    }
    /** @private */
    this._apiKey = apiKey.trim();
  }

  // ───────────────────────────────────────────────
  // Métodos públicos
  // ───────────────────────────────────────────────

  /**
   * Analisa um vídeo a partir de sua URL pública.
   *
   * Para vídeos do YouTube a URL é enviada como contexto textual no prompt,
   * permitindo que o modelo analise o conteúdo com base no que conhece do vídeo.
   *
   * @param {string} url — URL do vídeo (YouTube, TikTok, Instagram, Twitter, etc.)
   * @returns {Promise<Object>} Relatório de análise padronizado
   */
  async analyzeVideoByUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('URL do vídeo é obrigatória.');
    }

    const platform = this._detectPlatform(url);
    const videoId = this._extractYouTubeId(url);
    const videoTitle = this._extractVideoTitle(url);

    // Recupera a transcrição injetada pela Extensão Chrome, se houver
    const transcriptInjected = window.deeptraceInjectedTranscript || null;

    // Monta contexto descritivo para o prompt
    const videoContext = [
      `URL do vídeo: ${url}`,
      `Plataforma detectada: ${platform}`,
      videoId ? `ID do vídeo YouTube: ${videoId}` : null,
      videoTitle ? `Título extraído: ${videoTitle}` : null,
      transcriptInjected 
        ? `Transcrição REAL do áudio do vídeo (extraída diretamente do player do YouTube):\n${transcriptInjected}` 
        : `Nota: Não há transcrição local fornecida. Avalie o link de acordo com o seu conhecimento prévio sobre o vídeo/assunto.`
    ].filter(Boolean).join('\n');

    const prompt = this._buildAnalysisPrompt(videoContext, false);

    // Corpo da requisição — somente texto (MVP por URL)
    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    };

    const raw = await this._callGeminiApi(requestBody);
    const result = this._parseGeminiResponse(raw, { url, platform, videoTitle });

    // Se usamos transcrição injetada e o modelo não gerou uma transcrição dele, garante que salvamos a real
    if (transcriptInjected && result.metadata) {
      if (!result.metadata.transcription || result.metadata.transcription === 'Transcrição não disponível.') {
        result.metadata.transcription = transcriptInjected;
      }
      // Adiciona uma flag para indicar na UI que usamos a extensão
      result._deepTrace.transcriptImported = true;
    }

    // Reseta a variável global para evitar vazamento em análises futuras na mesma sessão
    window.deeptraceInjectedTranscript = null;

    return result;
  }

  /**
   * Analisa um vídeo enviado por upload (objeto File).
   *
   * O arquivo é convertido para base64 e enviado como inline_data,
   * permitindo que o modelo processe diretamente o conteúdo audiovisual.
   *
   * @param {File} file — Arquivo de vídeo selecionado pelo usuário
   * @returns {Promise<Object>} Relatório de análise padronizado
   */
  async analyzeVideoByFile(file) {
    if (!file || !(file instanceof File)) {
      throw new Error('Arquivo de vídeo inválido. Selecione um arquivo válido para análise.');
    }

    // Validação básica de tipo MIME
    if (!file.type.startsWith('video/')) {
      throw new Error(
        `Tipo de arquivo não suportado: "${file.type}". Envie um arquivo de vídeo (mp4, webm, etc.).`
      );
    }

    const base64Data = await this._fileToBase64(file);

    const videoContext = [
      `Arquivo de vídeo enviado pelo usuário.`,
      `Nome do arquivo: ${file.name}`,
      `Tipo MIME: ${file.type}`,
      `Tamanho: ${(file.size / (1024 * 1024)).toFixed(2)} MB`,
    ].join('\n');

    const prompt = this._buildAnalysisPrompt(videoContext, true);

    // Corpo da requisição — vídeo inline + prompt textual
    const requestBody = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: file.type,
                data: base64Data,
              },
            },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
      },
    };

    const raw = await this._callGeminiApi(requestBody);
    return this._parseGeminiResponse(raw, {
      url: null,
      platform: 'upload',
      videoTitle: file.name,
    });
  }

  // ───────────────────────────────────────────────
  // Construção do prompt
  // ───────────────────────────────────────────────

  /**
   * Constrói o prompt detalhado de análise enviado ao Gemini.
   *
   * @param {string} videoContext — Informações contextuais sobre o vídeo
   * @returns {string} Prompt completo
   * @private
   */
  _buildAnalysisPrompt(videoContext, isFileUpload = false) {
    const deepfakeInstructions = isFileUpload
      ? `8. **Análise Forense de Deepfake / IA Generativa** (OBRIGATÓRIA para vídeos enviados):
   Analise CUIDADOSAMENTE os frames visuais e o áudio do vídeo enviado para detectar sinais de manipulação por IA (deepfake, face swap, voz sintética, lip sync artificial). Avalie os seguintes indicadores:
   - **Sincronia Labial (lipSync)**: Os movimentos labiais estão perfeitamente sincronizados com o áudio? Há atrasos, desalinhamentos ou movimentos mecânicos?
   - **Textura e Bordas Faciais (faceArtifacts)**: Existem artefatos visuais no rosto? Bordas borradas entre o rosto e o fundo? Textura de pele inconsistente? Distorções em dentes, olhos ou cabelo?
   - **Coerência de Iluminação (lightingCoherence)**: A iluminação no rosto é consistente com o ambiente ao redor? Há sombras impossíveis, reflexos faltando ou iluminação que muda abruptamente?
   - **Padrão de Piscadas (blinkingPattern)**: As piscadas são naturais? São muito raras, muito frequentes ou ausentes? Padrões regulares demais podem indicar IA.
   - Forneça um parecer técnico detalhado explicando sua conclusão e o nível de confiança.`
      : `8. **Análise Forense de Deepfake / IA Generativa** (análise limitada por URL):
   Com base no seu conhecimento prévio sobre este vídeo ou conteúdo similar, avalie se há indícios de que o vídeo possa conter:
   - Faces geradas ou manipuladas por IA (deepfake, face swap)
   - Áudio sintético ou clonado por IA
   - Manipulação visual evidente
   NOTA: Como você está recebendo apenas a URL (sem acesso direto ao vídeo), indique na confiança que a análise visual é limitada. Se não puder avaliar, defina detected como false e confidence como 0, e explique a limitação no campo details.`;

    const dataAtual = new Date();
    const dataFormatada = dataAtual.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    return `Você é o DeepTrace, um sistema avançado de verificação de fatos, detecção de desinformação e análise forense de deepfake em vídeos.

Analise o vídeo descrito/fornecido abaixo com rigor jornalístico e científico.

─── REFERÊNCIA TEMPORAL ───
Data e hora da análise (dia de hoje): ${dataFormatada}
Use esta data de hoje como referência absoluta de tempo para qualquer verificação temporal de fatos.
Se um fato ou relatório se refere a um ano anterior a ${dataAtual.getFullYear()} (como 2024 ou 2025), note que esse ano já passou e pertence ao passado.

─── CONTEXTO DO VÍDEO ───
${videoContext}

─── INSTRUÇÕES DE ANÁLISE ───

1. **Transcrição**: Transcreva integralmente todo o conteúdo falado no vídeo (áudio). Se o vídeo contiver texto na tela, inclua-o também.

2. **Identificação de alegações**: Liste TODAS as alegações factuais feitas no vídeo — afirmações que podem ser verificadas como verdadeiras ou falsas. Inclua alegações explícitas e implícitas.

3. **Verificação individual**: Para CADA alegação identificada, forneça:
   - O texto exato da alegação
   - Um veredito: "Verdadeiro", "Falso", "Parcialmente Verdadeiro" ou "Inconclusivo"
   - Um score de confiança de 0 a 100 (onde 0 = certeza de ser falso, 100 = certeza de ser verdadeiro)
   - Uma explicação detalhada do seu raciocínio
   - Fontes confiáveis que sustentam sua avaliação (quando disponíveis)

4. **Técnicas de manipulação**: Identifique quaisquer técnicas de manipulação ou persuasão usadas, incluindo mas não se limitando a:
   - Apelo emocional excessivo
   - Descontextualização de fatos
   - Dados falsos ou distorcidos
   - Edição tendenciosa (cortes seletivos, justaposição enganosa)
   - Uso de autoridade falsa ou enganosa
   - Teoria conspiratória
   - Generalização indevida
   - Falsa equivalência
   - Omissão deliberada de informações

5. **Score geral de confiabilidade**: Atribua um score de 0 a 100, onde:
   - 0–20: Conteúdo predominantemente falso / desinformação
   - 21–40: Maioria das alegações é falsa ou distorcida
   - 41–60: Mistura de informações verdadeiras e falsas
   - 61–80: Maioria das alegações é verdadeira com ressalvas
   - 81–100: Conteúdo predominantemente verdadeiro e confiável

6. **Veredito final**: Escolha entre: "Falso", "Parcialmente Verdadeiro", "Verdadeiro" ou "Inconclusivo".

7. **Resumo**: Forneça um resumo de 2 a 3 frases descrevendo a conclusão geral da análise.

${deepfakeInstructions}

─── FORMATO DE RESPOSTA ───

IMPORTANTE: Responda APENAS com um objeto JSON válido, sem texto adicional, sem markdown, sem blocos de código. Siga EXATAMENTE o schema abaixo:

{
  "overallScore": <número de 0 a 100>,
  "verdict": "<Falso | Parcialmente Verdadeiro | Verdadeiro | Inconclusivo>",
  "summary": "<Resumo em 2-3 frases>",
  "deepfakeAnalysis": {
    "detected": <true se há indícios de deepfake/IA, false caso contrário>,
    "confidence": <número de 0 a 100 indicando certeza do diagnóstico>,
    "lipSync": "<Descrição da análise de sincronia labial>",
    "faceArtifacts": "<Descrição de artefatos faciais encontrados>",
    "lightingCoherence": "<Descrição da coerência de iluminação>",
    "blinkingPattern": "<Descrição do padrão de piscadas>",
    "details": "<Parecer técnico detalhado sobre a autenticidade do vídeo>"
  },
  "claims": [
    {
      "claim": "<Texto da alegação>",
      "verdict": "<Verdadeiro | Falso | Parcialmente Verdadeiro | Inconclusivo>",
      "confidence": <número de 0 a 100>,
      "reasoning": "<Explicação detalhada>",
      "sources": ["<Fonte 1>", "<Fonte 2>"]
    }
  ],
  "manipulationTechniques": ["<Técnica 1>", "<Técnica 2>"],
  "metadata": {
    "language": "<idioma detectado, ex: pt-BR>",
    "duration": "<duração estimada do vídeo>",
    "transcription": "<Transcrição completa do conteúdo falado>",
    "videoTitle": "<Título do vídeo, se disponível>"
  }
}

Responda SOMENTE o JSON. Nenhum texto antes ou depois.`;
  }

  // ───────────────────────────────────────────────
  // Comunicação com a API
  // ───────────────────────────────────────────────

  /**
   * Envia a requisição à API Gemini com controle de timeout.
   *
   * @param {Object} body — Corpo JSON da requisição
   * @returns {Promise<Object>} Resposta bruta da API
   * @private
   */
  async _callGeminiApi(body, _retryCount = 0) {
    const MAX_RETRIES = 2;
    const url = `${DeepTraceAnalyzer.GEMINI_API_URL}?key=${this._apiKey}`;

    // Controlador de timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DeepTraceAnalyzer.TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Tratamento de erros HTTP
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const status = response.status;

        // Retry para erros de servidor transitórios
        if ([500, 502, 503].includes(status) && _retryCount < MAX_RETRIES) {
          const delay = Math.pow(2, _retryCount) * 1000; // 1s, 2s
          console.warn(`[DeepTrace] API retornou ${status}. Tentando novamente em ${delay}ms (tentativa ${_retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise(r => setTimeout(r, delay));
          return this._callGeminiApi(body, _retryCount + 1);
        }

        if (status === 401 || status === 403) {
          throw new Error(
            'Chave de API inválida ou sem permissão. Verifique sua chave do Google Gemini e tente novamente.'
          );
        }
        if (status === 429) {
          throw new Error(
            'Limite de requisições excedido. Aguarde alguns instantes e tente novamente.'
          );
        }
        if (status === 400) {
          const msg = errorData?.error?.message || 'Requisição inválida';
          throw new Error(`Erro na requisição: ${msg}`);
        }

        throw new Error(
          `Erro ao se comunicar com a API Gemini (HTTP ${status}). Tente novamente mais tarde.`
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(
          'A análise excedeu o tempo limite de 2 minutos. O vídeo pode ser muito longo ou a conexão está instável. Tente novamente.'
        );
      }

      // Re-lança erros já tratados
      throw error;
    }
  }

  // ───────────────────────────────────────────────
  // Parsing da resposta
  // ───────────────────────────────────────────────

  /**
   * Parseia a resposta bruta da API Gemini e retorna o objeto de análise padronizado.
   *
   * Tenta múltiplas estratégias de extração de JSON para lidar com
   * respostas que possam conter texto adicional ou formatação markdown.
   *
   * @param {Object} apiResponse — Resposta bruta da API
   * @param {Object} context — Contexto adicional (url, platform, videoTitle)
   * @returns {Object} Relatório de análise padronizado
   * @private
   */
  _parseGeminiResponse(apiResponse, context = {}) {
    // Extrai o texto da resposta do modelo
    const textContent = apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      // Verifica se houve bloqueio por segurança
      const blockReason = apiResponse?.candidates?.[0]?.finishReason;
      if (blockReason === 'SAFETY') {
        throw new Error(
          'O conteúdo do vídeo foi bloqueado pelos filtros de segurança do modelo. Não foi possível realizar a análise.'
        );
      }
      throw new Error(
        'A API não retornou conteúdo analisável. O vídeo pode não estar acessível ou o formato não é suportado.'
      );
    }

    // Tenta extrair JSON da resposta usando múltiplas estratégias
    const analysisData = this._extractJson(textContent);

    // Valida e complementa o objeto com valores padrão
    return this._normalizeAnalysis(analysisData, context);
  }

  /**
   * Tenta extrair um objeto JSON válido a partir de texto,
   * usando múltiplas estratégias de parsing.
   *
   * @param {string} text — Texto que pode conter JSON
   * @returns {Object} Objeto parseado
   * @private
   */
  _extractJson(text) {
    // Estratégia 1: Parse direto (resposta limpa)
    try {
      return JSON.parse(text.trim());
    } catch {
      // continua para próxima estratégia
    }

    // Estratégia 2: Extrair bloco de código JSON (```json ... ```)
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch {
        // continua
      }
    }

    // Estratégia 3: Encontrar o primeiro { e o último } no texto
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {
        // continua
      }
    }

    // Nenhuma estratégia funcionou
    throw new Error(
      'Não foi possível interpretar a resposta da análise. O modelo retornou um formato inesperado. Tente novamente.'
    );
  }

  /**
   * Normaliza e valida o objeto de análise, garantindo que todos os
   * campos obrigatórios estejam presentes com valores padrão quando ausentes.
   *
   * @param {Object} data — Dados brutos extraídos do JSON
   * @param {Object} context — Contexto adicional
   * @returns {Object} Análise normalizada
   * @private
   */
  _normalizeAnalysis(data, context) {
    return {
      overallScore: this._clampScore(data.overallScore),
      verdict: this._normalizeVerdict(data.verdict),
      summary: data.summary || 'Resumo não disponível.',
      deepfakeAnalysis: {
        detected: !!data.deepfakeAnalysis?.detected,
        confidence: this._clampScore(data.deepfakeAnalysis?.confidence != null ? data.deepfakeAnalysis.confidence : 0),
        lipSync: data.deepfakeAnalysis?.lipSync || 'Não avaliado.',
        faceArtifacts: data.deepfakeAnalysis?.faceArtifacts || 'Não avaliado.',
        lightingCoherence: data.deepfakeAnalysis?.lightingCoherence || 'Não avaliado.',
        blinkingPattern: data.deepfakeAnalysis?.blinkingPattern || 'Não avaliado.',
        details: data.deepfakeAnalysis?.details || 'Nenhum indício óbvio de manipulação visual por IA detectado.'
      },
      claims: Array.isArray(data.claims)
        ? data.claims.map((c) => ({
            claim: c.claim || 'Alegação não especificada',
            verdict: this._normalizeVerdict(c.verdict),
            confidence: this._clampScore(c.confidence),
            reasoning: c.reasoning || 'Sem explicação disponível.',
            sources: Array.isArray(c.sources) ? c.sources : [],
          }))
        : [],
      manipulationTechniques: Array.isArray(data.manipulationTechniques)
        ? data.manipulationTechniques
        : [],
      metadata: {
        language: data.metadata?.language || 'pt-BR',
        duration: data.metadata?.duration || 'Não estimada',
        transcription: data.metadata?.transcription || 'Transcrição não disponível.',
        videoTitle: data.metadata?.videoTitle || context.videoTitle || 'Título não disponível',
      },
      // Metadados internos do DeepTrace
      _deepTrace: {
        analyzedAt: new Date().toISOString(),
        platform: context.platform || 'unknown',
        sourceUrl: context.url || null,
        engineVersion: '1.1.0',
      },
    };
  }

  // ───────────────────────────────────────────────
  // Utilitários de detecção e extração
  // ───────────────────────────────────────────────

  /**
   * Detecta a plataforma de origem do vídeo com base na URL.
   *
   * @param {string} url — URL do vídeo
   * @returns {string} Nome da plataforma ('youtube' | 'tiktok' | 'instagram' | 'twitter' | 'other')
   */
  _detectPlatform(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();

      if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return 'youtube';
      if (hostname.includes('tiktok.com')) return 'tiktok';
      if (hostname.includes('instagram.com')) return 'instagram';
      if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';

      return 'other';
    } catch {
      return 'other';
    }
  }

  /**
   * Extrai o ID do vídeo do YouTube a partir da URL.
   * Suporta formatos:
   *   - youtube.com/watch?v=XXXXXXXXXXX
   *   - youtu.be/XXXXXXXXXXX
   *   - youtube.com/embed/XXXXXXXXXXX
   *   - youtube.com/shorts/XXXXXXXXXXX
   *
   * @param {string} url — URL do YouTube
   * @returns {string|null} ID do vídeo ou null se não for YouTube
   * @private
   */
  _extractYouTubeId(url) {
    if (!url) return null;

    const patterns = [
      // youtube.com/watch?v=ID
      /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
      // youtu.be/ID
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      // youtube.com/embed/ID
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      // youtube.com/shorts/ID
      /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Tenta extrair um título descritivo a partir da URL.
   * Usa o caminho da URL para gerar um nome legível.
   *
   * @param {string} url — URL do vídeo
   * @returns {string} Título extraído ou string padrão
   */
  _extractVideoTitle(url) {
    try {
      const parsed = new URL(url);

      // Para YouTube, usa parâmetros ou ID
      const videoId = this._extractYouTubeId(url);
      if (videoId) return `Vídeo YouTube (${videoId})`;

      // Para outras plataformas, tenta extrair do caminho
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        const lastPart = decodeURIComponent(pathParts[pathParts.length - 1]);
        // Remove extensões de arquivo e substitui hífens/underscores por espaços
        return lastPart
          .replace(/\.[^.]+$/, '')
          .replace(/[-_]/g, ' ')
          .trim() || `Vídeo de ${parsed.hostname}`;
      }

      return `Vídeo de ${parsed.hostname}`;
    } catch {
      return 'Vídeo (URL não reconhecida)';
    }
  }

  // ───────────────────────────────────────────────
  // Utilitários internos
  // ───────────────────────────────────────────────

  /**
   * Converte um objeto File para string base64 (sem o prefixo data URI).
   *
   * @param {File} file — Arquivo a ser convertido
   * @returns {Promise<string>} Conteúdo em base64
   * @private
   */
  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        // Remove o prefixo "data:video/mp4;base64," para enviar somente o payload
        const base64 = reader.result.split(',')[1];
        if (!base64) {
          reject(new Error('Falha ao converter o arquivo para base64.'));
          return;
        }
        resolve(base64);
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler o arquivo de vídeo. Verifique se o arquivo não está corrompido.'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * Garante que o score esteja entre 0 e 100.
   *
   * @param {*} score — Valor do score
   * @returns {number} Score normalizado entre 0 e 100
   * @private
   */
  _clampScore(score) {
    const num = Number(score);
    if (Number.isNaN(num)) return 50; // valor neutro como fallback
    return Math.max(0, Math.min(100, Math.round(num)));
  }

  /**
   * Normaliza o veredito para um dos valores aceitos.
   *
   * @param {string} verdict — Veredito bruto
   * @returns {string} Veredito normalizado
   * @private
   */
  _normalizeVerdict(verdict) {
    if (!verdict || typeof verdict !== 'string') return 'Inconclusivo';

    const normalized = verdict.trim().toLowerCase();
    const map = {
      'falso': 'Falso',
      'false': 'Falso',
      'verdadeiro': 'Verdadeiro',
      'true': 'Verdadeiro',
      'parcialmente verdadeiro': 'Parcialmente Verdadeiro',
      'partially true': 'Parcialmente Verdadeiro',
      'inconclusivo': 'Inconclusivo',
      'inconclusive': 'Inconclusivo',
    };

    return map[normalized] || 'Inconclusivo';
  }
};
