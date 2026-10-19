<script lang="ts">
    import { Badge } from "$lib/components/ui/badge/index.js";
    import { cn } from "$lib/utils";
    import { mediaProgressStore } from "$lib/stores/media-progress.svelte";

    type Size = "sm" | "default";

    let {
        state: loadedState,
        itemId,
        size = "sm",
        class: className
    }: { state: string; itemId?: number | string; size?: Size; class?: string } = $props();

    // With an itemId, follow the item's live state and show what Riven is doing with it.
    // The API sends ids as strings, the event streams as numbers.
    const id = $derived(itemId === undefined ? undefined : Number(itemId));
    const state = $derived(
        (id !== undefined && mediaProgressStore.getItemState(id)) || loadedState
    );
    const activity = $derived(id !== undefined ? mediaProgressStore.getActivity(id) : []);

    const KNOWN_STATES = ["Completed", "Requested", "Downloading", "Paused", "Unknown"];
    const isDefaultState = $derived(!KNOWN_STATES.includes(state));

    const variant = $derived(state === "Unknown" ? "destructive" : "secondary");

    const sizeClasses = $derived(
        size === "default" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-xs"
    );
</script>

<Badge
    {variant}
    title={activity.length ? activity.join(", ") : undefined}
    class={cn(
        "inline-flex items-center justify-center backdrop-blur-sm",
        sizeClasses,
        state === "Completed" && "bg-emerald-600/80 text-emerald-50 hover:bg-emerald-600/70",
        state === "Requested" && "bg-sky-600/80 text-sky-50 hover:bg-sky-600/70",
        state === "Downloading" && "bg-amber-600/80 text-amber-50 hover:bg-amber-600/70",
        state === "Paused" && "bg-slate-500/80 text-slate-50 hover:bg-slate-500/70",
        isDefaultState && "bg-amber-600/80 text-amber-50 hover:bg-amber-600/70",
        activity.length > 0 && "animate-pulse",
        className
    )}>{activity.length ? `${state} · ${activity[0]}…` : state}</Badge>
