(async function() {
    try {
        // Detecta videoId nos parâmetros da URL
        const params = new URLSearchParams(window.location.search);
        const videoId = params.get('videoId');
        
        if (videoId) {
            const key = `deeptrace_transcript_${videoId}`;
            
            // Busca a transcrição no storage compartilhado da extensão
            const result = await chrome.storage.local.get(key);
            const transcriptText = result[key];
            
            if (transcriptText) {
                // Injeta a transcrição diretamente no escopo global da página
                const script = document.createElement('script');
                script.textContent = `
                    window.deeptraceInjectedTranscript = ${JSON.stringify(transcriptText)};
                    console.log('[DeepTrace Extension] Legendas importadas com sucesso da Extensão Chrome.');
                `;
                (document.head || document.documentElement).appendChild(script);
                script.remove();
                
                // Limpa o storage para evitar consumo de memória desnecessário
                chrome.storage.local.remove(key);
            }
        }
    } catch (err) {
        console.error('[DeepTrace Extension Bridge] Falha ao injetar legenda:', err);
    }
})();
