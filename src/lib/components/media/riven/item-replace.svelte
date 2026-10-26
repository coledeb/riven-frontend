<script lang="ts">
    import providers from "$lib/providers";
    import { toast } from "svelte-sonner";
    import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
    import { Button } from "$lib/components/ui/button/index.js";
    import Loader2 from "@lucide/svelte/icons/loader-2";
    import { createScopedLogger } from "$lib/logger";
    import { invalidateAll } from "$app/navigation";

    const logger = createScopedLogger("item-replace");

    import { type Snippet } from "svelte";

    interface Props {
        title: string | null | undefined;
        ids: (string | null | undefined)[];
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
    let { title, ids, variant = "ghost", size = "sm", children, ...restProps }: Props = $props();

    async function replaceMediaItem(ids: (string | null | undefined)[]) {
        const validIds = ids.filter((id): id is string => id !== null && id !== undefined);

        const response = await providers.riven.POST("/api/v1/items/replace", {
            body: {
                ids: validIds
            }
        });

        if (response.data) {
            toast.success("Finding another copy. The current file stays until it's replaced.");
            await invalidateAll();
        } else {
            logger.error("Error response:", response.error);
            toast.error("Failed to replace media item.");
        }
    }

    let open = $state(false);
    let loading = $state(false);
</script>

<AlertDialog.Root bind:open>
    <AlertDialog.Trigger>
        {#snippet child({ props })}
            <Button {variant} {size} {...restProps} {...props}>
                {#if children}
                    {@render children()}
                {:else}
                    Replace
                {/if}
            </Button>
        {/snippet}
    </AlertDialog.Trigger>
    <AlertDialog.Content class="border border-white/10 bg-zinc-950/95 backdrop-blur-2xl">
        <AlertDialog.Header>
            <AlertDialog.Title>
                Replace "{title ?? "Media Item"}"?
            </AlertDialog.Title>
            <AlertDialog.Description>
                Riven blacklists the current source and finds another copy. The current file stays
                playable until the new one is in place. For a season or show, every episode is
                replaced.
            </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
                disabled={loading}
                onclick={async () => {
                    loading = true;
                    await replaceMediaItem(ids);
                    loading = false;
                    open = false;
                }}>
                {#if loading}
                    <Loader2 class="mr-1 inline-block animate-spin" />
                {/if}
                Replace
            </AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
