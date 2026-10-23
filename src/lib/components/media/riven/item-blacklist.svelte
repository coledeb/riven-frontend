<script lang="ts">
    import providers from "$lib/providers";
    import { toast } from "svelte-sonner";
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import { createScopedLogger } from "$lib/logger";
    import type { components } from "$lib/providers/riven";
    import { type Snippet } from "svelte";
    import { blacklistExpiry, blacklistReason, formatBlacklistTime } from "$lib/blacklist";

    const logger = createScopedLogger("item-blacklist");

    type Entry = components["schemas"]["BlacklistEntry"];

    interface Props {
        title: string | null | undefined;
        itemId: number | string | null | undefined;
        variant?:
            | "ghost"
            | "default"
            | "link"
            | "destructive"
            | "outline"
            | "secondary"
            | undefined;
        size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg" | undefined;
        class?: string;
        children?: Snippet;
    }
    let { title, itemId, variant = "ghost", size = "sm", children, ...restProps }: Props = $props();

    let open = $state(false);
    let loading = $state(false);
    let entries = $state<Entry[]>([]);
    let busy = $state<string | null>(null);

    async function load() {
        if (itemId == null) return;
        loading = true;
        const response = await providers.riven.GET("/api/v1/items/{item_id}/blacklist", {
            params: { path: { item_id: Number(itemId) } }
        });
        loading = false;

        if (response.data) {
            entries = response.data.entries;
        } else {
            logger.error("Error response:", response.error);
            toast.error("Failed to load the blacklist.");
        }
    }

    async function unblacklist(entry: Entry) {
        const key = `${entry.item_id}-${entry.stream_id}`;
        busy = key;
        const response = await providers.riven.POST(
            "/api/v1/items/{item_id}/streams/{stream_id}/unblacklist",
            { params: { path: { item_id: entry.item_id, stream_id: entry.stream_id } } }
        );
        busy = null;

        if (response.data) {
            entries = entries.filter((e) => `${e.item_id}-${e.stream_id}` !== key);
            toast.success("Torrent is back in the pool.");
        } else {
            logger.error("Error response:", response.error);
            toast.error("Failed to unblacklist the torrent.");
        }
    }

    $effect(() => {
        if (open) load();
    });
</script>

<Dialog.Root bind:open>
    <Dialog.Trigger>
        {#snippet child({ props })}
            <Button {variant} {size} {...restProps} {...props}>
                {#if children}
                    {@render children()}
                {:else}
                    Blacklist
                {/if}
            </Button>
        {/snippet}
    </Dialog.Trigger>
    <Dialog.Content
        class="flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
        <Dialog.Header>
            <Dialog.Title>Blacklisted torrents: {title ?? "Media Item"}</Dialog.Title>
            <Dialog.Description>
                Torrents Riven won't use for this item. Temporary problems expire back into the pool
                on their own (Settings → Scraping → Blacklist); unblacklisting puts one back now.
            </Dialog.Description>
        </Dialog.Header>

        <div class="min-h-0 flex-1 overflow-auto">
            {#if loading}
                <div class="text-muted-foreground flex items-center gap-2 p-4 text-sm">
                    <Loader2 class="h-4 w-4 animate-spin" /> Loading…
                </div>
            {:else if entries.length === 0}
                <p class="text-muted-foreground p-4 text-sm">Nothing is blacklisted.</p>
            {:else}
                <ul class="divide-y divide-white/10">
                    {#each entries as entry (`${entry.item_id}-${entry.stream_id}`)}
                        <li class="flex items-start gap-3 py-3">
                            <div class="min-w-0 flex-1">
                                <p class="text-sm font-medium break-all">{entry.raw_title}</p>
                                <p class="text-muted-foreground mt-1 text-xs">
                                    {entry.item_label}
                                    · {blacklistReason(entry.reason)}
                                    {#if entry.blacklisted_at}
                                        · {formatBlacklistTime(entry.blacklisted_at)}
                                    {/if}
                                    ·
                                    <span class={entry.expires_at ? "" : "text-destructive"}
                                        >{blacklistExpiry(entry.expires_at)}</span>
                                    {#if entry.strikes > 1}
                                        · strike {entry.strikes}
                                    {/if}
                                </p>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                class="border-border text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 border bg-transparent"
                                disabled={busy !== null}
                                onclick={() => unblacklist(entry)}>
                                {#if busy === `${entry.item_id}-${entry.stream_id}`}
                                    <Loader2 class="mr-1 h-4 w-4 animate-spin" />
                                {/if}
                                Unblacklist
                            </Button>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    </Dialog.Content>
</Dialog.Root>
