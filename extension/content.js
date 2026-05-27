(function() {
    const webAppUrl = 'https://deep-trace-nine.vercel.app';
    let observer = null;

    /**
     * Injeta o botão "Analisar no DeepTrace" na interface do YouTube
     */
    function injectButton() {
        // Verifica se já estamos na página de vídeo do YouTube
        if (!window.location.pathname.includes('/watch')) return;

        // Evita injeções duplicadas
        if (document.getElementById('deeptrace-btn')) return;

        // Encontra o container alvo no YouTube
        // #top-row é o container principal que abriga o dono do canal e os botões de ações
        const targetContainer = document.querySelector('#top-row #actions');
        
        if (!targetContainer) {
            // Fallback: se o #actions ainda não carregou, tenta outros locais comuns
            const fallbackContainer = document.querySelector('#owner') || document.querySelector('#subscribe-button');
            if (fallbackContainer && fallbackContainer.parentNode) {
                requestAnimationFrame(() => insertButtonElement(fallbackContainer.parentNode, fallbackContainer.nextSibling));
            }
            return;
        }

        // Insere o botão como o primeiro elemento dentro do container de ações
        requestAnimationFrame(() => insertButtonElement(targetContainer, targetContainer.firstChild));
    }

    /**
     * Cria e insere o botão no DOM
     */
    function insertButtonElement(parent, beforeNode) {
        if (document.getElementById('deeptrace-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'deeptrace-btn';
        btn.innerHTML = '🔍 Analisar no DeepTrace';
        
        // Estilização do botão para combinar com a identidade do YouTube e o tema ciano do DeepTrace
        btn.style.background = 'rgba(0, 212, 255, 0.1)';
        btn.style.color = '#00d4ff';
        btn.style.border = '1px solid rgba(0, 212, 255, 0.25)';
        btn.style.padding = '0 16px';
        btn.style.height = '36px';
        btn.style.borderRadius = '18px';
        btn.style.fontFamily = 'Roboto, Arial, sans-serif';
        btn.style.fontSize = '14px';
        btn.style.fontWeight = '500';
        btn.style.cursor = 'pointer';
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.gap = '6px';
        btn.style.marginLeft = '12px';
        btn.style.transition = 'all 0.2s ease';
        btn.style.verticalAlign = 'middle';

        // Efeito de hover
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(0, 212, 255, 0.2)';
            btn.style.borderColor = 'rgba(0, 212, 255, 0.45)';
            btn.style.boxShadow = '0 0 8px rgba(0, 212, 255, 0.15)';
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(0, 212, 255, 0.1)';
            btn.style.borderColor = 'rgba(0, 212, 255, 0.25)';
            btn.style.boxShadow = 'none';
        });

        // Clique extrai legendas e abre a aba do app injetando os dados
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const videoUrl = window.location.href;
            const videoId = extractYouTubeId(videoUrl);

            // Indica loading no próprio botão
            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Obtendo transcrição...';
            btn.disabled = true;

            let transcript = null;
            try {
                const result = await extractTranscript();
                if (result && result.success) {
                    transcript = result.text;
                }
            } catch (err) {
                console.warn('[DeepTrace] Não foi possível extrair legendas:', err);
            }

            btn.innerHTML = originalText;
            btn.disabled = false;

            if (videoId && transcript) {
                // Salva no storage local antes de redirecionar
                chrome.storage.local.set({ [`deeptrace_transcript_${videoId}`]: transcript }, () => {
                    const targetUrl = `${webAppUrl}/?url=${encodeURIComponent(videoUrl)}&videoId=${videoId}#analyze`;
                    window.open(targetUrl, '_blank');
                });
            } else {
                // Fallback direto por URL se falhar
                const targetUrl = `${webAppUrl}/?url=${encodeURIComponent(videoUrl)}#analyze`;
                window.open(targetUrl, '_blank');
            }
        });

        // Insere de forma segura
        try {
            if (beforeNode) {
                parent.insertBefore(btn, beforeNode);
            } else {
                parent.appendChild(btn);
            }
            console.log('[DeepTrace Extension] Botão de análise injetado com sucesso.');
        } catch (err) {
            console.error('[DeepTrace Extension] Falha ao inserir botão no DOM:', err);
        }
    }

    /**
     * Extrai a legenda/transcrição oficial ou automática do player do YouTube
     */
    function extractTranscript() {
        return new Promise((resolve) => {
            const listenerName = 'deeptrace_transcript_extracted_' + Math.random().toString(36).substr(2, 9);
            
            // Listener temporário de resposta da página principal
            window.addEventListener(listenerName, (event) => {
                resolve(event.detail);
            }, { once: true });

            // Injeta script no contexto principal da página
            const script = document.createElement('script');
            script.textContent = `
                (async () => {
                    try {
                        const playerResponse = window.ytInitialPlayerResponse;
                        if (!playerResponse || !playerResponse.captions) {
                            throw new Error("Legendas não estão disponíveis neste vídeo.");
                        }

                        const captionTracks = playerResponse.captions.playerCaptionsTracklistRenderer?.captionTracks;
                        if (!captionTracks || captionTracks.length === 0) {
                            throw new Error("Nenhuma trilha de legendas encontrada.");
                        }

                        // Escolhe português, depois inglês ou o primeiro disponível
                        const track = captionTracks.find(t => t.languageCode === 'pt') 
                                   || captionTracks.find(t => t.languageCode === 'en')
                                   || captionTracks[0];

                        if (!track || !track.baseUrl) {
                            throw new Error("URL de legendas não encontrada.");
                        }

                        // Faz o fetch do formato JSON3 limpo do YouTube
                        const response = await fetch(track.baseUrl + '&fmt=json3');
                        if (!response.ok) throw new Error("Erro ao requisitar legendas.");
                        const data = await response.json();

                        // Concatena todos os segmentos de fala
                        let fullText = '';
                        if (data.events) {
                            fullText = data.events
                                .map(e => e.segs ? e.segs.map(s => s.utf8).join('') : '')
                                .join(' ')
                                .replace(/\\n/g, ' ')
                                .replace(/\\s+/g, ' ')
                                .trim();
                        }

                        window.dispatchEvent(new CustomEvent('${listenerName}', {
                            detail: { success: true, text: fullText }
                        }));
                    } catch (err) {
                        window.dispatchEvent(new CustomEvent('${listenerName}', {
                            detail: { success: false, error: err.message }
                        }));
                    }
                })();
            `;
            (document.head || document.documentElement).appendChild(script);
            script.remove();
        });
    }

    /**
     * Extrai o ID do vídeo do YouTube a partir da URL
     */
    function extractYouTubeId(url) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    /**
     * Listener de mensagens para comunicação com o popup.js da extensão
     */
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'extractTranscript') {
            extractTranscript().then((result) => {
                sendResponse(result);
            }).catch((err) => {
                sendResponse({ success: false, error: err.message });
            });
            return true; // Mantém o canal aberto para resposta assíncrona
        }
    });

    /**
     * Inicializa o MutationObserver para capturar transições SPA do YouTube
     */
    function init() {
        injectButton();

        // Monitora mudanças na página do YouTube
        if (observer) observer.disconnect();

        observer = new MutationObserver((mutations) => {
            // Filtra mutações para evitar loops gerados pelo nosso próprio botão
            let shouldUpdate = false;
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.id === 'deeptrace-btn') continue;
                        shouldUpdate = true;
                        break;
                    }
                }
                if (shouldUpdate) break;
            }

            if (shouldUpdate) {
                injectButton();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Inicializa
    init();
})();
