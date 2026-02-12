export interface VideoOperation {
    operation_name: string;
    scene_id: string;
    status: string;
    media_url?: string;
}

export interface Task {
    id: string;
    order: number;
    selected: boolean;
    prompt: string;
    type: 'text-to-video' | 'image-to-video';
    ratio: '16:9' | '9:16';
    count: number;
    startImage?: string;
    endImage?: string;
    status: 'pending' | 'queued' | 'getting-token' | 'uploading' | 'generating' | 'polling' | 'done' | 'error';
    statusText?: string;
    results: string[];
    operations?: VideoOperation[];
    error?: string;
    accountId?: string;
}

export interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'step';
}

export interface SelectedAccount {
    id: string;
    threads: number;
}
