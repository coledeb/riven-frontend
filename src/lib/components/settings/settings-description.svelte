<script lang="ts">
    // Field description with line breaks and **bold** from the backend schema.
    // Plain text only: nothing is rendered as HTML.
    import { descriptionAttributes, getFormContext, type ComponentProps } from "@sjsf/form";
    import { getThemeContext } from "@sjsf/shadcn4-theme";

    const { description, config }: ComponentProps["description"] = $props();

    const ctx = getFormContext();
    const themeCtx = getThemeContext();
    const { FieldDescription } = $derived(themeCtx.components);

    const lines = $derived(
        String(description ?? "")
            .split("\n")
            .map((line) =>
                line.split("**").map((text, i) => ({ text, bold: i % 2 === 1 }))
            )
    );
</script>

<FieldDescription {...descriptionAttributes(ctx, config, "descriptionAttributes", {})}>
    {#each lines as parts, i (i)}
        {#if i > 0}<br />{/if}
        {#each parts as part, j (j)}
            {#if part.bold}<strong>{part.text}</strong>{:else}{part.text}{/if}
        {/each}
    {/each}
</FieldDescription>
