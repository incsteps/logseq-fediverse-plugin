export interface StatusResponse {
    id: string;
    url: string;
    content: string;
    created_at: string;
    account: {
        acct: string;
        display_name: string;
        url: string;
    };
}

export interface InstanceMediaResponse {
    id: string;
    type: string;
    url: string;
    preview_url: string;
}

export class FediverseApi {
    private instanceUrl: string;
    private token: string;

    constructor(instanceUrl: string, token: string) {
        this.instanceUrl = instanceUrl.replace(/\/$/, '');
        this.token = token;
    }

    private get headers() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
        };
    }

    // POST /api/v1/statuses
    async postStatus(statusText: string): Promise<StatusResponse> {
        const response = await fetch(`${this.instanceUrl}/api/v1/statuses`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ status: statusText }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return response.json();
    }

    // GET /api/v2/search?q={url}&type=statuses&resolve=true
    async resolveStatusUrl(statusUrl: string): Promise<StatusResponse> {
        const endpoint = `${this.instanceUrl}/api/v2/search?q=${encodeURIComponent(statusUrl)}&type=statuses&resolve=true`;

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: this.headers,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        if (!data.statuses || data.statuses.length === 0) {
            throw new Error('Status not found or could not be resolved');
        }

        return data.statuses[0];
    }

    async getMaxCharacters(): Promise<number> {
        try {
            const response = await fetch(`${this.instanceUrl}/api/v1/instance`);
            if (!response.ok) return 500; // Fallback seguro
            const data = await response.json();
            return data.configuration?.statuses?.max_characters ?? 500;
        } catch {
            return 500;
        }
    }

    async uploadMedia(fileBlob: Blob, filename: string): Promise<InstanceMediaResponse> {
        const formData = new FormData();
        formData.append('file', fileBlob, filename);

        const response = await fetch(`${this.instanceUrl}/api/v1/media`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error uploading image: ${response.status} ${errorText}`);
        }

        return response.json();
    }

    async postStatusInThread(
        statusText: string,
        replyToId?: string,
        mediaIds: string[] = []
    ): Promise<StatusResponse> {
        const body: Record<string, any> = {
            status: statusText,
        };

        if (replyToId) body.in_reply_to_id = replyToId;
        if (mediaIds.length > 0) body.media_ids = mediaIds;

        const response = await fetch(`${this.instanceUrl}/api/v1/statuses`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return response.json();
    }
}