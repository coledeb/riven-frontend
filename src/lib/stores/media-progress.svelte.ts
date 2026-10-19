import { source } from "sveltekit-sse";
import { SvelteMap } from "svelte/reactivity";

// Live item states and running jobs from the backend's event streams.

type EventUpdateData = Record<string, number[]>; // {"Scraping": [1, 2], "Downloader": [3]}

type ItemUpdateData = {
    last_state: string;
    new_state: string;
    item_id: number;
};

// Backend service names → what the item is doing.
const SERVICE_LABELS: Record<string, string> = {
    Indexer: "Indexing",
    Scraping: "Scraping",
    Downloader: "Downloading",
    Filesystem: "Adding to library",
    Updater: "Updating media server",
    PostProcessing: "Post-processing"
};

class MediaProgressStore {
    itemStates = new SvelteMap<number, string>();
    activeServices = new SvelteMap<number, string[]>();
    #connections: ReturnType<typeof source>[] = [];
    #unsubscribers: (() => void)[] = [];
    #connected = false;

    getItemState(itemId: number): string | undefined {
        return this.itemStates.get(itemId);
    }

    getActivity(itemId: number): string[] {
        return (this.activeServices.get(itemId) ?? []).map(
            (service) => SERVICE_LABELS[service] ?? service
        );
    }

    #handleEventUpdate(data: EventUpdateData) {
        this.activeServices.clear();
        for (const [service, itemIds] of Object.entries(data)) {
            for (const itemId of itemIds) {
                this.activeServices.set(itemId, [
                    ...(this.activeServices.get(itemId) ?? []),
                    service
                ]);
            }
        }
    }

    #subscribe<T>(name: string, handle: (data: T) => void) {
        const connection = source(`/api/${name}`, {
            close: ({ connect }) => {
                setTimeout(() => {
                    if (this.#connected) connect();
                }, 1000);
            }
        });
        this.#connections.push(connection);
        this.#unsubscribers.push(
            connection
                .select(name)
                .json<T>(({ previous }) => previous)
                .subscribe((data) => {
                    if (data) handle(data);
                })
        );
    }

    connect() {
        if (this.#connected) return;
        this.#connected = true;

        this.#subscribe<EventUpdateData>("event_update", (data) => this.#handleEventUpdate(data));
        this.#subscribe<ItemUpdateData>("item_update", (data) =>
            this.itemStates.set(data.item_id, data.new_state)
        );
    }

    disconnect() {
        this.#connected = false;
        for (const unsubscribe of this.#unsubscribers) unsubscribe();
        for (const connection of this.#connections) connection.close();
        this.#unsubscribers = [];
        this.#connections = [];
    }
}

export const mediaProgressStore = new MediaProgressStore();
