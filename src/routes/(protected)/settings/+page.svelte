<script lang="ts">
    import type { ActionData, PageData } from "./$types";
    import { BasicForm, setValue } from "@sjsf/form";
    import { createMeta, setupSvelteKitForm } from "@sjsf/sveltekit/client";
    import * as defaults from "$lib/components/settings/form-defaults";
    import { setShadcnContext } from "$lib/components/shadcn-context";
    import { toast } from "svelte-sonner";
    import { icons } from "@sjsf/lucide-icons";
    import PageShell from "$lib/components/page-shell.svelte";
    import { Button } from "$lib/components/ui/button";
    import { onMount, tick } from "svelte";
    setShadcnContext();

    let { data }: { data: PageData } = $props();

    type Schema = {
        title?: string;
        description?: string;
        type?: unknown;
        properties?: Record<string, Schema>;
    };
    type Section = { id: string; title: string; description?: string };

    // Top-level settings that aren't objects are grouped under "General".
    const GENERAL = "general";
    // Most-used sections first; anything else keeps the backend's order.
    const ORDER = [
        "downloaders",
        "scraping",
        "ranking",
        "content",
        "updaters",
        "filesystem",
        "stream"
    ];

    // svelte-ignore state_referenced_locally
    const schema = data.form.schema as Schema;
    const properties = schema.properties ?? {};
    const isSection = (prop: Schema) => prop.type === "object" && !!prop.properties;

    const sections: Section[] = [
        { id: GENERAL, title: "General", description: "Core Riven options." },
        ...Object.entries(properties)
            .filter(([, prop]) => isSection(prop))
            .sort(([a], [b]) => {
                const rank = (key: string) =>
                    ORDER.includes(key) ? ORDER.indexOf(key) : ORDER.length;
                return rank(a) - rank(b);
            })
            .map(([id, prop]) => ({ id, title: prop.title ?? id, description: prop.description }))
    ];

    type UiNode = Record<string, unknown> & { "ui:options"?: Record<string, unknown> };

    // Per-field UI tweaks driven by markers prepareSettingsSchema adds to the schema:
    // secrets (`format: "password"`) use the masked SecretWidget; language lists stay lists of
    // dropdowns (sjsf would otherwise turn a unique list of choices into a checkbox grid).
    function fieldUi(prop: Schema & { format?: string; "x-language-list"?: boolean }): UiNode {
        if (prop.format === "password") return { "ui:components": { textWidget: "secretWidget" } };
        if (prop["x-language-list"]) return { "ui:components": { multiEnumField: "arrayField" } };
        const node: UiNode = {};
        for (const [key, child] of Object.entries(prop.properties ?? {})) {
            const childUi = fieldUi(child);
            if (Object.keys(childUi).length) node[key] = childUi;
        }
        return node;
    }

    // Tag each top-level field with its section; the stylesheet shows only the active one.
    const uiSchema = Object.fromEntries(
        Object.entries(properties).map(([key, prop]) => {
            const ui = fieldUi(prop);
            ui["ui:options"] = {
                ...ui["ui:options"],
                layouts: {
                    "object-property": {
                        "data-section": isSection(prop) ? key : GENERAL,
                        "data-section-title": isSection(prop) ? (prop.title ?? key) : "General"
                    }
                }
            };
            return [key, ui];
        })
    );

    // One fixed rule per section, keyed on the wrapper's data-active (rewriting a single rule on
    // every change sometimes wasn't re-applied after hydration, leaving the first section blank).
    const sectionStyles = `<style>${sections
        .map(
            (s) =>
                `.settings-form[data-active="${s.id}"] [data-section="${s.id}"] { display: block !important; }`
        )
        .join("\n")}</style>`;

    let active = $state(GENERAL);
    let invalidSections = $state<string[]>([]);
    const current = $derived(sections.find((s) => s.id === active) ?? sections[0]);

    function select(id: string) {
        if (query) {
            query = "";
            window.dispatchEvent(new CustomEvent("riven:settings-search-clear"));
        }
        active = id;
        history.replaceState(history.state, "", `#${id}`);
        window.scrollTo({ top: 0 });
    }

    onMount(() => {
        const fromHash = location.hash.slice(1);
        if (sections.some((s) => s.id === fromHash)) active = fromHash;

        const onSearch = (e: Event) => {
            query = (e as CustomEvent<{ query: string }>).detail.query;
        };
        window.addEventListener("riven:settings-search", onSearch);
        return () => window.removeEventListener("riven:settings-search", onSearch);
    });

    let formEl = $state<HTMLElement>();

    // The header's search box filters fields across every section (see header.svelte).
    let query = $state("");
    let matchedSections = $state<string[]>([]);

    const PROPERTY = '[data-layout="object-property"]';
    const ownedBy = (el: Element) => (child: Element) =>
        child.parentElement?.closest(PROPERTY) === el;

    // A field matches when every word appears in its label/description or a parent group's;
    // a matching group shows all its fields.
    function applySearch(text: string) {
        if (!formEl) return;
        // Each word must start a word in the text ("api" finds "API key", not "rapid")
        const terms = text
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean)
            .map((t) => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
        const all = formEl.querySelectorAll(PROPERTY);
        all.forEach((el) => el.removeAttribute("data-search-hidden"));
        formEl
            .querySelectorAll("[data-search-first]")
            .forEach((el) => el.removeAttribute("data-search-first"));
        if (!terms.length) {
            matchedSections = [];
            return;
        }

        const visit = (el: Element, inherited: string): boolean => {
            const own = [
                ...el.querySelectorAll(
                    'legend, [data-slot="field-label"], [data-slot="field-description"]'
                )
            ]
                .filter((t) => t.closest(PROPERTY) === el)
                .map((t) => t.textContent ?? "");
            const haystack = `${inherited} ${own.join(" ")}`.toLowerCase();
            if (terms.every((t) => t.test(haystack))) return true;
            let any = false;
            for (const child of [...el.querySelectorAll(PROPERTY)].filter(ownedBy(el))) {
                if (visit(child, haystack)) any = true;
                else child.setAttribute("data-search-hidden", "");
            }
            return any;
        };

        // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local scratch set, not state
        const found = new Set<string>();
        for (const top of formEl.querySelectorAll("[data-section]")) {
            if (visit(top, top.getAttribute("data-section-title") ?? "")) {
                const id = top.getAttribute("data-section")!;
                if (!found.has(id)) top.setAttribute("data-search-first", "");
                found.add(id);
            } else {
                top.setAttribute("data-search-hidden", "");
            }
        }
        matchedSections = sections.filter((s) => found.has(s.id)).map((s) => s.id);
    }

    $effect(() => {
        applySearch(query);
    });

    // Errors may sit in a hidden section: flag those sections and jump to the first one.
    async function checkErrors() {
        await tick();
        setTimeout(() => {
            if (!formEl) return;
            // eslint-disable-next-line svelte/prefer-svelte-reactivity -- local scratch set, not state
            const found = new Set<string>();
            formEl.querySelectorAll('[data-invalid="true"]').forEach((el) => {
                const id = el.closest("[data-section]")?.getAttribute("data-section");
                if (id) found.add(id);
            });
            invalidSections = sections.filter((s) => found.has(s.id)).map((s) => s.id);
            if (invalidSections.length && !invalidSections.includes(active))
                select(invalidSections[0]);
        }, 50);
    }

    const meta = createMeta<ActionData, PageData>().form;

    const { form, request } = setupSvelteKitForm(meta, {
        ...defaults,
        icons,
        uiSchema,
        // Backend can set sjsf UI options per field (e.g. addable/removable) via "x-ui-options".
        extraUiOptions: (option, config) =>
            (config?.schema as { "x-ui-options"?: Record<string, unknown> } | undefined)?.[
                "x-ui-options"
            ]?.[option] as never,
        delayedMs: 500,
        timeoutMs: 30000,
        // sjsf's default native form reset puts every field back to its page-load value, and the
        // form never picks up the reloaded data, so a saved change looked undone. Skip the reset and
        // show what the backend stored instead (page data is reloaded before onSuccess runs).
        reset: false,
        onSuccess: (result) => {
            if (result.type === "success") {
                setValue(form, data.form.initialValue as never);
                invalidSections = [];
                toast.success("Settings saved");
            } else {
                toast.error("Failed to save settings");
            }
        },
        onFailure: () => {
            toast.error("Something went wrong while saving settings");
        }
    });
</script>

<svelte:head>
    <title>Settings - Riven</title>
    <!-- Only the active section's fields are shown; it stays one form, so Save covers every section. -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- built only from our own section ids -->
    {@html sectionStyles}
</svelte:head>

<PageShell class="h-full">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 md:flex-row md:gap-10">
        <nav class="md:w-52 md:shrink-0" aria-label="Settings sections">
            <h1 class="mb-3 hidden text-2xl font-semibold md:block">Settings</h1>
            <ul
                class="flex gap-1 overflow-x-auto pb-2 md:sticky md:top-20 md:flex-col md:overflow-visible md:pb-0">
                {#each sections as section (section.id)}
                    <li>
                        <button
                            type="button"
                            onclick={() => select(section.id)}
                            aria-current={active === section.id ? "page" : undefined}
                            class={[
                                "flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors",
                                active === section.id && !query
                                    ? "bg-primary/15 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            ]}>
                            <span class:opacity-40={query && !matchedSections.includes(section.id)}
                                >{section.title}</span>
                            {#if invalidSections.includes(section.id)}
                                <span class="bg-destructive size-2 rounded-full" title="Has errors"
                                ></span>
                            {/if}
                        </button>
                    </li>
                {/each}
            </ul>
        </nav>

        <div class="min-w-0 flex-1 md:max-w-3xl">
            <header class="mb-6 flex items-start justify-between gap-4">
                <div>
                    {#if query}
                        <h2 class="text-xl font-semibold">Search results</h2>
                        <p class="text-muted-foreground mt-1 text-sm">
                            {matchedSections.length
                                ? `Settings matching “${query}”. Pick a section to leave search.`
                                : `No settings match “${query}”.`}
                        </p>
                    {:else}
                        <h2 class="text-xl font-semibold">{current.title}</h2>
                    {/if}
                    {#if !query && current.description}
                        <p class="text-muted-foreground mt-1 text-sm">{current.description}</p>
                    {/if}
                </div>
                <!-- Submits the form below (`form` attribute), so it saves every section. -->
                <Button
                    type="submit"
                    form="settings-form"
                    class="shrink-0"
                    disabled={request.isProcessed}>
                    {request.isProcessed ? "Saving…" : "Save changes"}
                </Button>
            </header>

            <div
                bind:this={formEl}
                class="settings-form"
                data-active={query ? "search" : active}
                onsubmitcapture={checkErrors}>
                <BasicForm {form} id="settings-form" method="POST" novalidate></BasicForm>
            </div>
        </div>
    </div>
</PageShell>

<style>
    .settings-form :global([data-section]) {
        display: none;
    }
    .settings-form[data-active="search"] :global([data-section]) {
        display: block;
    }
    .settings-form :global([data-search-hidden]) {
        display: none !important;
    }
    /* Section names between search results, which can come from every section. */
    .settings-form[data-active="search"] :global([data-search-first]::before) {
        content: attr(data-section-title);
        display: block;
        margin: 1.5rem 0 0.5rem;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--muted-foreground);
    }
    /* Root "AppModel" title and the section's own title/description (shown in the header instead). */
    .settings-form :global(form > fieldset > legend),
    .settings-form
        :global([data-section] > [data-layout="object-property-content"] > fieldset > legend),
    .settings-form
        :global(
            [data-section]
                > [data-layout="object-property-content"]
                > fieldset
                > [data-slot="field-description"]
        ) {
        display: none;
    }

    /* Setting rows: label + description on the left, control on the right. */
    .settings-form :global([data-layout="field"]) {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
        column-gap: 2rem;
        row-gap: 0.25rem;
        align-items: center;
        padding-block: 0.875rem;
    }
    .settings-form :global([data-layout="field"] > *) {
        grid-column: 2;
        grid-row: 1 / span 2;
        min-width: 0;
    }
    .settings-form :global([data-layout="field"] > [data-layout="field-title-row"]) {
        grid-column: 1;
        grid-row: 1;
        align-self: end;
    }
    .settings-form :global([data-layout="field"] > [data-slot="field-description"]) {
        grid-column: 1;
        grid-row: 2;
        align-self: start;
    }
    .settings-form :global([data-layout="field"] > [data-slot="field-error"]),
    .settings-form :global([data-layout="field"] > ul) {
        grid-column: 2;
        grid-row: 3;
    }
    /* Switches: the widget wraps switch + label; put the label left and the switch at the far right. */
    .settings-form :global([data-layout="field"] > div:has(> [data-slot="switch"])) {
        display: contents;
    }
    .settings-form :global([data-layout="field"] > div > [data-slot="switch"]) {
        grid-column: 2;
        grid-row: 1 / span 2;
        justify-self: end;
    }
    .settings-form :global([data-layout="field"] > div > [data-slot="field-label"]) {
        grid-column: 1;
        grid-row: 1;
        align-self: end;
    }

    /* Checkbox lists (e.g. video extensions): title and description on top, options flow in columns. */
    .settings-form :global([data-layout="field"]:has(> div > [data-slot="checkbox"])) {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        column-gap: 1.5rem;
        row-gap: 0.5rem;
    }
    .settings-form
        :global(
            [data-layout="field"]:has(> div > [data-slot="checkbox"])
                > :is([data-layout="field-title-row"], [data-slot="field-description"], ul)
        ) {
        width: 100%;
    }
    .settings-form
        :global(
            [data-layout="field"]:has(> div > [data-slot="checkbox"])
                > div:has(> [data-slot="checkbox"])
        ) {
        width: 6.5rem;
    }

    /* Groups directly inside a section (e.g. one downloader) become cards; deeper groups are
       sub-headings inside the card, so nesting never stacks boxes in boxes. */
    .settings-form :global(fieldset[data-layout="object-field"]) {
        gap: 0.25rem;
    }
    .settings-form
        :global(
            [data-section]
                > *
                > fieldset
                > [data-layout="object-properties"]
                > *
                > *
                > fieldset[data-layout="object-field"]
        ) {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--card);
        padding: 1rem 1.25rem 0.25rem;
        margin-block: 1rem;
    }
    .settings-form :global([data-section] fieldset fieldset fieldset[data-layout="object-field"]) {
        border-top: 1px solid var(--border);
        padding-top: 1rem;
        margin-top: 0.75rem;
    }
    .settings-form :global([data-section] fieldset fieldset > legend) {
        float: left;
        width: 100%;
        font-weight: 600;
    }
    .settings-form :global([data-section] fieldset fieldset > legend + *) {
        clear: both;
    }
    .settings-form :global([data-layout="object-properties"]),
    .settings-form :global([data-layout="array-items"]) {
        gap: 0;
    }
    /* Thin divider between setting rows. */
    .settings-form
        :global(
            [data-layout="object-property"]:not([data-section])
                + [data-layout="object-property"]:not(
                    [data-section],
                    :has(> * > fieldset[data-layout="object-field"])
                )
        ) {
        border-top: 1px solid color-mix(in oklab, var(--border) 60%, transparent);
    }
    .settings-form :global([data-section="general"] + [data-section="general"]) {
        border-top: 1px solid color-mix(in oklab, var(--border) 60%, transparent);
    }

    /* Lists (genres, URLs…) are a setting row too: title + description left, items and Add right. */
    .settings-form :global(fieldset[data-layout="array-field"]) {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
        column-gap: 2rem;
        row-gap: 0.5rem;
        align-items: start;
        padding-block: 0.875rem;
    }
    .settings-form :global(fieldset[data-layout="array-field"] > *) {
        grid-column: 2;
        min-width: 0;
    }
    .settings-form :global(fieldset[data-layout="array-field"] > legend) {
        grid-column: 1;
        grid-row: 1;
        float: none;
        font-size: 0.875rem;
        font-weight: 500;
    }
    .settings-form :global(fieldset[data-layout="array-field"] > [data-slot="field-description"]) {
        grid-column: 1;
        grid-row: 2;
        align-self: start;
    }
    .settings-form :global(fieldset[data-layout="array-field"] > [data-layout="array-items"]) {
        grid-row: 1 / span 2;
    }
    .settings-form :global(fieldset[data-layout="array-field"] > button) {
        justify-self: start;
        width: auto;
    }
    .settings-form :global([data-layout="array-items"]:empty) {
        display: none;
    }
    .settings-form :global([data-layout="array-item"]) {
        width: 100%;
        margin-bottom: 0.5rem;
    }
    /* Each list entry is just its input (no "Exclude-1" label or two-column row). */
    .settings-form :global([data-layout="array-item"] [data-layout="field"]) {
        display: block;
        padding: 0;
    }
    .settings-form
        :global(
            [data-layout="array-item"] [data-layout="field"] > [data-layout="field-title-row"]
        ) {
        display: none;
    }
    .settings-form :global([data-layout="array-item"] > [data-layout="array-item-content"]) {
        flex: 1;
        min-width: 0;
    }

    /* Named entries (e.g. library profiles): name on top, settings underneath, remove button top right. */
    .settings-form
        :global([data-layout="object-property"]:has(> [data-layout="object-property-key-input"])) {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 0.5rem;
        align-items: start;
    }
    .settings-form
        :global([data-layout="object-property"] > [data-layout="object-property-content"]) {
        grid-column: 1 / -1;
    }
    .settings-form
        :global(
            [data-layout="object-property"]:has(> [data-layout="object-property-key-input"])
                > [data-layout="object-property-content"]
                > fieldset
                > :is(legend, [data-slot="field-description"])
        ) {
        display: none;
    }

    /* Simple name → value maps (e.g. Plex path mappings): one row of [name] [value] [delete]. */
    .settings-form
        :global(
            [data-layout="object-property"]:has(> [data-layout="object-property-key-input"]):has(
                    > [data-layout="object-property-content"] > [data-layout="field"]
                )
        ) {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
        align-items: center;
        margin-bottom: 0.5rem;
    }
    .settings-form
        :global(
            [data-layout="object-property"]:has(> [data-layout="object-property-key-input"]):has(
                    > [data-layout="object-property-content"] > [data-layout="field"]
                )
                > [data-layout="object-property-content"]
        ) {
        grid-column: auto;
    }
    .settings-form
        :global(
            [data-layout="object-property"]:has(> [data-layout="object-property-key-input"]):has(
                    > [data-layout="object-property-content"] > [data-layout="field"]
                )
                > :is(
                    [data-layout="object-property-key-input"],
                    [data-layout="object-property-content"]
                )
                [data-layout="field"]
        ) {
        display: block;
        padding: 0;
    }
    .settings-form
        :global(
            [data-layout="object-property"]:has(> [data-layout="object-property-key-input"]):has(
                    > [data-layout="object-property-content"] > [data-layout="field"]
                )
                > :is(
                    [data-layout="object-property-key-input"],
                    [data-layout="object-property-content"]
                )
                [data-layout="field-title-row"]
        ) {
        display: none;
    }
    .settings-form :global(fieldset[data-layout="object-field"] > button) {
        align-self: flex-start;
        width: auto;
        margin-bottom: 0.75rem;
    }

    /* Read-only values (e.g. Version) look like text, not an editable box. */
    .settings-form :global(input[readonly]) {
        opacity: 0.6;
        cursor: default;
        pointer-events: none;
    }

    /* The form's own Save button is replaced by the one in the section header. */
    .settings-form :global(form > button[type="submit"]) {
        display: none;
    }

    /* A disabled service (Enabled off) or a custom rank that isn't fetched (Fetch off) collapses to
       its title, description and that switch. */
    .settings-form
        :global(
            fieldset:has(
                    > [data-layout="object-properties"]
                        > [data-layout="object-property"]
                        > [data-layout="object-property-content"]
                        > [data-layout="field"]
                        > div
                        > [data-slot="switch"]:is(
                            [id$=".enabled"],
                            [id$=".fetch"]
                        )[aria-checked="false"]
                )
                > [data-layout="object-properties"]
                > [data-layout="object-property"]:not(
                    :has(
                        > [data-layout="object-property-content"]
                            > [data-layout="field"]
                            > div
                            > [data-slot="switch"]:is([id$=".enabled"], [id$=".fetch"])
                    )
                )
        ) {
        display: none;
    }

    /* A card's Enabled switch sits on the title line instead of its own row. Named entries (library
       profiles) have no visible title, so they keep a normal Enabled row. */
    .settings-form :global([data-section] fieldset fieldset) {
        position: relative;
    }
    .settings-form
        :global(
            [data-section]
                fieldset
                fieldset:not(
                    [data-layout="object-property"]:has(> [data-layout="object-property-key-input"])
                        > [data-layout="object-property-content"]
                        > fieldset
                )
                > [data-layout="object-properties"]
                > [data-layout="object-property"]:has(
                    > [data-layout="object-property-content"]
                        > [data-layout="field"]
                        > div
                        > [data-slot="switch"][id$=".enabled"]
                )
        ) {
        position: absolute;
        top: 1.1rem;
        right: 1.25rem;
        border: none;
    }
    /* Sub-groups inside a card have no side padding. */
    .settings-form
        :global(
            [data-section]
                fieldset
                fieldset
                fieldset:not(
                    [data-layout="object-property"]:has(> [data-layout="object-property-key-input"])
                        > [data-layout="object-property-content"]
                        > fieldset
                )
                > [data-layout="object-properties"]
                > [data-layout="object-property"]:has(
                    > [data-layout="object-property-content"]
                        > [data-layout="field"]
                        > div
                        > [data-slot="switch"][id$=".enabled"]
                )
        ) {
        right: 0;
    }
    .settings-form
        :global(
            [data-section]
                fieldset
                fieldset:not(
                    [data-layout="object-property"]:has(> [data-layout="object-property-key-input"])
                        > [data-layout="object-property-content"]
                        > fieldset
                )
                > [data-layout="object-properties"]
                > [data-layout="object-property"]:has(
                    > [data-layout="object-property-content"]
                        > [data-layout="field"]
                        > div
                        > [data-slot="switch"][id$=".enabled"]
                )
                [data-layout="field"]
        ) {
        display: block;
        padding: 0;
    }
    .settings-form
        :global(
            [data-section]
                fieldset
                fieldset:not(
                    [data-layout="object-property"]:has(> [data-layout="object-property-key-input"])
                        > [data-layout="object-property-content"]
                        > fieldset
                )
                > [data-layout="object-properties"]
                > [data-layout="object-property"]:has(
                    > [data-layout="object-property-content"]
                        > [data-layout="field"]
                        > div
                        > [data-slot="switch"][id$=".enabled"]
                )
                :is([data-slot="field-description"], [data-slot="field-label"])
        ) {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
    }

    /* Named entries: delete button on the id row. */
    .settings-form
        :global(
            [data-layout="object-property"]:has(> [data-layout="object-property-key-input"])
                > [data-layout="object-property-controls"]
        ) {
        grid-column: 2;
        grid-row: 1;
        align-self: center;
    }
    .settings-form
        :global(
            [data-layout="object-property"]:has(> [data-layout="object-property-key-input"])
                > [data-layout="object-property-content"]
        ) {
        grid-row: 2;
    }
</style>
