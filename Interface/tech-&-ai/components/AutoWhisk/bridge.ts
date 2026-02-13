import { invoke as tauriInvoke } from '@tauri-apps/api/core';

const pendingControllers = new Map<string, AbortController>();

export const invoke = async <T,>(cmd: string, args?: any, signal?: AbortSignal): Promise<T> => {
    if (signal?.aborted) {
        throw new Error('Aborted');
    }

    const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();
    pendingControllers.set(callId, controller);

    if (signal) {
        signal.addEventListener('abort', () => {
            controller.abort();
            pendingControllers.delete(callId);
        }, { once: true });
    }

    try {
        const result = await tauriInvoke<T>(cmd, args);
        return result;
    } catch (error: any) {
        if (controller.signal.aborted) {
            throw new Error('Aborted');
        }
        throw error;
    } finally {
        pendingControllers.delete(callId);
    }
};

export const abortAllPending = () => {
    for (const [, controller] of pendingControllers) {
        controller.abort();
    }
    pendingControllers.clear();
};
