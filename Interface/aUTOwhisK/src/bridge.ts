// WebView2 bridge — thay thế Tauri invoke cho môi trường WebView2/C#
export const invoke = async <T,>(cmd: string, args?: any): Promise<T> => {
    return new Promise((resolve, reject) => {
        const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const handler = (event: MessageEvent) => {
            try {
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
                if (data.callId === callId) {
                    window.removeEventListener('message', handler);
                    if (data.error) reject(new Error(data.error));
                    else resolve(data.result as T);
                }
            } catch { }
        };
        window.addEventListener('message', handler);

        // Timeout after 60s
        setTimeout(() => {
            window.removeEventListener('message', handler);
            reject(new Error(`Timeout: ${cmd}`));
        }, 60000);

        // Send to C# WebView2
        (window as any).chrome?.webview?.postMessage(JSON.stringify({ type: 'invoke', cmd, args, callId }));
    });
};
