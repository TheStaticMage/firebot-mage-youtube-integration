import { logger } from "../main";

type SendChatMessage = (message: string) => Promise<boolean>;

type QueueItem = {
    message: string;
};

export class ChatMessageQueue {
    private sendChatMessage: SendChatMessage;
    private queue: QueueItem[] = [];
    private processing = false;
    private processTimer: NodeJS.Timeout | null = null;

    constructor(sendChatMessage: SendChatMessage) {
        this.sendChatMessage = sendChatMessage;
    }

    enqueue(message: string): void {
        this.queue.push({ message });
        this.startProcessing();
    }

    private startProcessing(): void {
        if (this.processing) {
            return;
        }
        this.processing = true;
        this.scheduleNext();
    }

    private scheduleNext(): void {
        this.processTimer = setTimeout(() => {
            void this.processNext();
        }, 0);
    }

    private async processNext(): Promise<void> {
        const next = this.queue.shift();
        if (!next) {
            this.processing = false;
            return;
        }

        try {
            const success = await this.sendChatMessage(next.message);
            if (!success) {
                logger.warn("Queued YouTube chat message send returned false");
            }
        } catch (error) {
            logger.error(`Error sending YouTube chat message from queue: ${error}`);
        }

        if (this.queue.length > 0) {
            this.scheduleNext();
            return;
        }

        this.processing = false;
        if (this.processTimer) {
            clearTimeout(this.processTimer);
            this.processTimer = null;
        }
    }
}
