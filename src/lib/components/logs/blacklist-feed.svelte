<script lang="ts">
    import providers from "$lib/providers";
    import { toast } from "svelte-sonner";
    import { resolve } from "$app/paths";
    import { Button } from "$lib/components/ui/button/index.js";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import { createScopedLogger } from "$lib/logger";
    import type { components } from "$lib/providers/riven";
    import { blacklistExpiry, blacklistReason, formatBlacklistTime } from "$lib/blacklist";
    import { onMount } from "svelte";

    const logger = createScopedLogger("blacklist-feed");

    type Entry = components["schemas"]["RecentBlacklistEntry"];

    // Newest first, refreshed while the tab is open so new blacklistings show up as they happen.
    const REFRESH_MS = 30_000;

    let {
        count = $bindable(0),
        activeOnly = false,
        refreshKey = 0
    }: { count?: number; activeOnly?: boolean; refreshKey?: number } = $props();

    let entries = $state<Entry[]>([]);
    let loading = $state(true);
    let failed = $state(false);
    let busy = $state<string | null>(null);

    const shown = $derived(activeOnly ? entries.filter((e) => !e.released_at) : entries);

    $effect(() => {
        count = shown.length;
    });

    async function load() {
        const response = await providers.riven.GET("/api/v1/items/blacklist", {
            params: { query: { limit: 300 } }
        });
        loading = false;

        if (response.data) {
            entries = response.data.entries;
            failed = false;
        } else {
            logger.error("Error response:", response.error);
            failed = true;
        }
    }

    onMount(() => {
        const timer = setInterval(load, REFRESH_MS);
        return () => clearInterval(timer);
    });

    $effect(() => {
        void refreshKey;
        load();
    });

    const key = (e: Entry) => `${e.item_id}-${e.stream_id}`;

    async function unblacklist(entry: Entry) {
        busy = key(entry);
        const response = await providers.riven.POST(
            "/api/v1/items/{item_id}/streams/{stream_id}/unblacklist",
            { params: { path: { item_id: entry.item_id, stream_id: entry.stream_id } } }
        );
        busy = null;

        if (response.data) {
            toast.success("Torrent is back in the pool.");
            await load();
        } else {
            logger.error("Error response:", response.error);
            toast.error("Failed to unblacklist the torrent.");
        }
    }

    function itemUrl(e: Entry): string | undefined {
        if (e.item_type === "movie") {
            if (e.tmdb_id) return resolve(`/details/media/${e.tmdb_id}/movie`);
            if (e.tvdb_id) return resolve(`/details/media/${e.tvdb_id}/movie?indexer=tvdb`);
        } else {
            if (e.tvdb_id) return resolve(`/details/media/${e.tvdb_id}/tv?indexer=tvdb`);
            if (e.tmdb_id) return resolve(`/details/media/${e.tmdb_id}/tv`);
        }
        return undefined;
    }
</script>

{#if loading}
    <div class="text-muted-foreground flex items-center gap-2 p-6 text-sm">
        <Loader2 class="h-4 w-4 animate-spin" /> Loading blacklist…
    </div>
{:else if failed && entries.length === 0}
    <p class="text-destructive p-6 text-sm">Failed to load the blacklist.</p>
{:else if shown.length === 0}
    <p class="text-muted-foreground p-6 text-sm">Nothing has been blacklisted.</p>
{:else}
    <ul>
        {#each shown as entry (key(entry))}
            {@const url = itemUrl(entry)}
            <li
                class="border-border/50 hover:bg-muted/20 flex items-start gap-4 border-b px-4 py-3 transition-colors last:border-b-0"
                class:opacity-60={entry.released_at}>
                <div class="text-muted-foreground w-24 shrink-0 pt-0.5 font-mono text-xs">
                    {formatBlacklistTime(entry.blacklisted_at) || "—"}
                </div>
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium">
                        {#if url}
                            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- itemUrl() already calls resolve() -->
                            <a href={url} class="hover:text-primary hover:underline"
                                >{entry.title}</a>
                        {:else}
                            {entry.title}
                        {/if}
                        {#if entry.item_label}
                            <span class="text-muted-foreground font-normal"
                                >{entry.item_label}</span>
                        {/if}
                    </p>
                    <p class="text-foreground/70 mt-0.5 font-mono text-xs break-all">
                        {entry.raw_title}
                    </p>
                    <p class="text-muted-foreground mt-1 text-xs">
                        {blacklistReason(entry.reason)}
                        {#if entry.resolution}
                            · {entry.resolution}
                        {/if}
                        ·
                        {#if entry.released_at}
                            released {formatBlacklistTime(entry.released_at)}
                        {:else}
                            <span class={entry.expires_at ? "" : "text-destructive"}
                                >{blacklistExpiry(entry.expires_at)}</span>
                        {/if}
                        {#if entry.strikes > 1}
                            · strike {entry.strikes}
                        {/if}
                    </p>
                </div>
                {#if !entry.released_at}
                    <Button
                        variant="secondary"
                        size="sm"
                        class="border-border text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 border bg-transparent"
                        disabled={busy !== null}
                        onclick={() => unblacklist(entry)}>
                        {#if busy === key(entry)}
                            <Loader2 class="mr-1 h-4 w-4 animate-spin" />
                        {/if}
                        Unblacklist
                    </Button>
                {/if}
            </li>
        {/each}
    </ul>
{/if}
