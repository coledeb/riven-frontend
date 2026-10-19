<!--
    Text widget for secrets (API keys, tokens, passwords): masked, with an eye button to reveal it.
    Used for fields prepareSettingsSchema marks `format: "password"` (see the settings page uiSchema).
-->
<script lang="ts">
    import { getFormContext, inputAttributes, type ComponentProps } from "@sjsf/form";
    import { Input } from "$lib/components/ui/input";
    import EyeIcon from "@lucide/svelte/icons/eye";
    import EyeOffIcon from "@lucide/svelte/icons/eye-off";

    let { value = $bindable(), config, handlers }: ComponentProps["textWidget"] = $props();

    const ctx = getFormContext();
    const attributes = $derived(inputAttributes(ctx, config, "shadcn4Text", handlers, {}));

    let shown = $state(false);
    // Plain record: spreading the attributes plus `type` into Input's props is too complex for TS.
    const inputProps = $derived({
        ...attributes,
        type: shown ? "text" : "password",
        autocomplete: "off"
    } as Record<string, unknown>);
</script>

<div class="relative">
    <Input bind:value {...inputProps} class="pr-10" />
    <button
        type="button"
        class="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md outline-none focus-visible:ring-[3px]"
        aria-label={shown ? "Hide value" : "Show value"}
        aria-pressed={shown}
        onclick={() => (shown = !shown)}>
        {#if shown}
            <EyeIcon class="size-4" />
        {:else}
            <EyeOffIcon class="size-4" />
        {/if}
    </button>
</div>
