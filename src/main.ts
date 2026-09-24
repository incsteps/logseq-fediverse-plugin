import '@logseq/libs';
import { settingsSchema } from './settings';
import { FediverseApi } from './api';

// Helper to strip HTML tags from status content
function htmlToPlainText(html: string): string {
    return html
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .trim();
}

function splitTextIntoChunks(text: string, maxChars: number): string[] {
    if (text.length <= maxChars) return [text];

    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const word of words) {
        // Check if adding this word exceeds the limit
        if ((currentChunk + ' ' + word).trim().length > maxChars) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }

            // If a single word is somehow larger than maxChars, force cut it
            if (word.length > maxChars) {
                let remainingWord = word;
                while (remainingWord.length > maxChars) {
                    chunks.push(remainingWord.slice(0, maxChars));
                    remainingWord = remainingWord.slice(maxChars);
                }
                currentChunk = remainingWord;
            } else {
                currentChunk = word;
            }
        } else {
            currentChunk = (currentChunk + ' ' + word).trim();
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

async function publishBlockContent(content: string, blockUuid: string) {
    const instanceUrl = logseq.settings?.instanceUrl as string;
    const token = logseq.settings?.accessToken as string;

    if (!instanceUrl || !token) {
        logseq.UI.showMsg('Please configure Instance URL and Access Token first', 'error');
        logseq.showSettingsUI();
        return;
    }

    const cleanedText = content.replace(/\/Fediverse: Publish/gi, '').trim();

    if (!cleanedText) {
        logseq.UI.showMsg('Cannot publish an empty block', 'warning');
        return;
    }

    try {
        logseq.UI.showMsg('Publishing to Fediverse...', 'info');
        const api = new FediverseApi(instanceUrl, token);
        const result = await api.postStatus(cleanedText);

        await logseq.Editor.upsertBlockProperty(blockUuid, 'fediverse-url', result.url);
        logseq.UI.showMsg('Status published successfully!', 'success');
    } catch (err: any) {
        console.error('Publish error:', err);
        logseq.UI.showMsg(`Error publishing: ${err.message}`, 'error');
    }
}

async function importStatusToGraph() {
    const instanceUrl = logseq.settings?.instanceUrl as string;
    const token = logseq.settings?.accessToken as string;

    if (!instanceUrl || !token) {
        logseq.UI.showMsg('Please configure Instance URL and Access Token first', 'error');
        logseq.showSettingsUI();
        return;
    }

    const currentBlock = await logseq.Editor.getCurrentBlock();
    if (!currentBlock) {
        logseq.UI.showMsg('No active block found', 'warning');
        return;
    }

    // Extract URL cleaning any slash command leftover
    const targetUrl = currentBlock.content.replace(/\/Fediverse: Import/gi, '').trim();

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        logseq.UI.showMsg('Please enter or paste a valid Toot URL in the block', 'warning');
        return;
    }

    try {
        logseq.UI.showMsg('Fetching status from Fediverse...', 'info');
        const api = new FediverseApi(instanceUrl, token);
        const status = await api.resolveStatusUrl(targetUrl);

        const cleanContent = htmlToPlainText(status.content);
        const formattedChildText = `**Toot by @${status.account.acct}**\n${cleanContent}`;

        // Clean current block content from slash command text if needed
        if (currentBlock.content !== targetUrl) {
            await logseq.Editor.updateBlock(currentBlock.uuid, targetUrl);
        }

        // Insert or replace child block with status content ({ sibling: false } creates a child block)
        await logseq.Editor.insertBlock(currentBlock.uuid, formattedChildText, {
            sibling: false,
        });

        logseq.UI.showMsg('Status imported successfully!', 'success');
    } catch (err: any) {
        console.error('Import error:', err);
        logseq.UI.showMsg(`Error importing status: ${err.message}`, 'error');
    }
}

interface TootPayload {
    text: string;
    imageUrls: string[];
}

async function prepareThreadPayloads(
    rootBlockUuid: string,
    maxChars: number
): Promise<TootPayload[]> {
    const block = await logseq.Editor.getBlock(rootBlockUuid, { includeChildren: true });
    if (!block) return [];

    const rawNodes: { text: string; imageUrls: string[] }[] = [];

    async function processBlock(b: any) {
        let content = b.content || '';
        content = content.replace(/\/Fediverse: Publish Thread/gi, '').trim();

        if (content) {
            const imageRegex = /!\[.*?\]\((.*?)\)/g;
            const imageUrls: string[] = [];
            let match;

            while ((match = imageRegex.exec(content)) !== null) {
                imageUrls.push(match[1]);
            }

            const cleanText = content.replace(imageRegex, '').trim();

            if (cleanText || imageUrls.length > 0) {
                rawNodes.push({ text: cleanText, imageUrls });
            }
        }

        if (b.children && Array.isArray(b.children)) {
            for (const child of b.children) {
                await processBlock(child);
            }
        }
    }

    await processBlock(block);

    // Transform raw nodes into maxChars-compliant TootPayloads
    const finalPayloads: TootPayload[] = [];

    for (const node of rawNodes) {
        if (!node.text) {
            // Block only contained images
            finalPayloads.push({ text: '', imageUrls: node.imageUrls });
            continue;
        }

        const textChunks = splitTextIntoChunks(node.text, maxChars);

        textChunks.forEach((chunk, index) => {
            // Attach images to the FIRST chunk of this block
            const imagesForThisChunk = index === 0 ? node.imageUrls : [];
            finalPayloads.push({
                text: chunk,
                imageUrls: imagesForThisChunk,
            });
        });
    }

    return finalPayloads;
}

async function publishThread(rootBlockUuid: string) {
    const instanceUrl = logseq.settings?.instanceUrl as string;
    const token = logseq.settings?.accessToken as string;

    if (!instanceUrl || !token) {
        logseq.UI.showMsg('Please configure instance credentials first', 'error');
        return;
    }

    try {
        const api = new FediverseApi(instanceUrl, token);
        const maxChars = await api.getMaxCharacters();

        logseq.UI.showMsg(`Reading blocks and checking limits (${maxChars} chars max per toot)...`, 'info');

        const payloads = await prepareThreadPayloads(rootBlockUuid, maxChars);
        if (payloads.length === 0) {
            logseq.UI.showMsg('No content found to publish', 'warning');
            return;
        }

        let lastStatusId: string | undefined = undefined;
        let rootStatusUrl: string | undefined = undefined;

        for (let i = 0; i < payloads.length; i++) {
            const payload = payloads[i];
            logseq.UI.showMsg(`Publishing toot ${i + 1} of ${payloads.length}... ${payload.text}`, 'info');

            // Upload media attached to this specific chunk/block
            const mediaIds: string[] = [];
            for (const imgPath of payload.imageUrls) {
                try {
                    let blob: Blob;
                    if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
                        const res = await fetch(imgPath);
                        blob = await res.blob();
                    } else {
                        const graph = await logseq.App.getCurrentGraph();
                        const assetUrl = `${graph?.path}/${imgPath.replace(/^\.\.\//, '')}`;
                        const res = await fetch(assetUrl);
                        blob = await res.blob();
                    }
                    const uploadedMedia = await api.uploadMedia(blob, 'image.png');
                    mediaIds.push(uploadedMedia.id);
                } catch (err) {
                    console.error(`Failed to upload media ${imgPath}:`, err);
                }
            }

            // Post toot linked to previous status ID
            const result = await api.postStatusInThread(payload.text, lastStatusId, mediaIds);

            if (!lastStatusId) {
                rootStatusUrl = result.url;
            }
            lastStatusId = result.id;
        }

        if (rootStatusUrl) {
            await logseq.Editor.upsertBlockProperty(rootBlockUuid, 'fediverse-thread', rootStatusUrl);
        }

        logseq.UI.showMsg(`Thread of ${payloads.length} toots published successfully!`, 'success');
    } catch (err: any) {
        console.error('Thread error:', err);
        logseq.UI.showMsg(`Error publishing thread: ${err.message}`, 'error');
    }
}

function main() {
    logseq.useSettingsSchema(settingsSchema);

    // Commands
    logseq.Editor.registerSlashCommand('Fediverse: Settings', async () => {
        logseq.showSettingsUI();
    });

    logseq.Editor.registerSlashCommand('Fediverse: Publish', async () => {
        const block = await logseq.Editor.getCurrentBlock();
        if (block) {
            await publishBlockContent(block.content, block.uuid);
        }
    });

    logseq.Editor.registerSlashCommand('Fediverse: Import', async () => {
        await importStatusToGraph();
    });

    // Block context menu item
    logseq.Editor.registerBlockContextMenuItem('Publish to Fediverse', async (e) => {
        const block = await logseq.Editor.getBlock(e.uuid);
        if (block) {
            await publishBlockContent(block.content, block.uuid);
        }
    });

    logseq.Editor.registerSlashCommand('Fediverse: Publish Thread', async () => {
        const block = await logseq.Editor.getCurrentBlock();
        if (block) {
            await publishThread(block.uuid);
        }
    });
}

logseq.ready(main).catch(console.error);