document.addEventListener('DOMContentLoaded', async () => {
    const webAppUrl = 'https://deep-trace-nine.vercel.app';
    
    // Expressões regulares de plataformas suportadas
    const supportedPatterns = {
        youtube: /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)/i,
        tiktok: /tiktok\.com/i,
        instagram: /instagram\.com/i,
        twitter: /(?:twitter\.com|x\.com)/i
    };

    // Referências do DOM
    const videoDetectedState = document.getElementById('video-detected-state');
    const noVideoState = document.getElementById('no-video-state');
    const detectedStatusMsg = document.getElementById('detected-status-msg');
    const analyzeCurrentBtn = document.getElementById('analyze-current-btn');
    const manualUrlInput = document.getElementById('manual-url');
    const analyzeManualBtn = document.getElementById('analyze-manual-btn');

    let currentTabUrl = '';

    try {
        // Obtém a aba ativa
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && tab.url) {
            currentTabUrl = tab.url;
            
            // Detecta se a URL da aba atual é compatível com alguma plataforma
            let detectado = false;
            let nomePlataforma = '';

            for (const [platform, pattern] of Object.entries(supportedPatterns)) {
                if (pattern.test(currentTabUrl)) {
                    detectado = true;
                    nomePlataforma = platform.charAt(0).toUpperCase() + platform.slice(1);
                    break;
                }
            }

            if (detectado) {
                // Estado A: Vídeo compatível detectado
                detectedStatusMsg.innerHTML = `Vídeo do <strong>${nomePlataforma}</strong> detectado na aba atual!`;
                videoDetectedState.classList.remove('hidden');
                noVideoState.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('[DeepTrace Extension] Erro ao inspecionar aba ativa:', error);
    }

    // Evento de clique para analisar vídeo da aba ativa
    analyzeCurrentBtn.addEventListener('click', async () => {
        if (!currentTabUrl) return;

        const videoId = extractYouTubeId(currentTabUrl);
        const originalText = analyzeCurrentBtn.innerHTML;
        analyzeCurrentBtn.innerHTML = '⏳ Obtendo transcrição...';
        analyzeCurrentBtn.disabled = true;

        try {
            // Obtém a aba ativa
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && tab.id && videoId) {
                // Solicita a extração ao content.js ativo
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractTranscript' }).catch(() => null);
                
                if (response && response.success && response.text) {
                    // Salva no storage local da extensão
                    await chrome.storage.local.set({ [`deeptrace_transcript_${videoId}`]: response.text });
                    
                    const targetUrl = `${webAppUrl}/?url=${encodeURIComponent(currentTabUrl)}&videoId=${videoId}#analyze`;
                    chrome.tabs.create({ url: targetUrl });
                    
                    analyzeCurrentBtn.innerHTML = originalText;
                    analyzeCurrentBtn.disabled = false;
                    return;
                }
            }
        } catch (error) {
            console.warn('[DeepTrace Popup] Falha ao extrair legenda:', error);
        }

        // Fallback por URL direta se a extração falhar ou não for YouTube
        const targetUrl = `${webAppUrl}/?url=${encodeURIComponent(currentTabUrl)}#analyze`;
        chrome.tabs.create({ url: targetUrl });
        analyzeCurrentBtn.innerHTML = originalText;
        analyzeCurrentBtn.disabled = false;
    });

    // Evento de clique para analisar vídeo inserido manualmente
    analyzeManualBtn.addEventListener('click', () => {
        const inputUrl = manualUrlInput.value.trim();
        if (!inputUrl) {
            alert('Por favor, cole um link de vídeo.');
            return;
        }

        // Validação básica de URL
        try {
            new URL(inputUrl);
        } catch {
            alert('Insira uma URL válida.');
            return;
        }

        const targetUrl = `${webAppUrl}/?url=${encodeURIComponent(inputUrl)}#analyze`;
        chrome.tabs.create({ url: targetUrl });
    });

    // Permitir Enter no campo de input manual
    manualUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            analyzeManualBtn.click();
        }
    });

    /**
     * Auxiliar para extrair ID do YouTube
     */
    function extractYouTubeId(url) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
});
