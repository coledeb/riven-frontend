// Reshape the backend's settings JSON Schema for the form:
// - Inline `$ref`s, so a property's own title/description win over the model's
//   ("Downloaders" instead of "DownloadersModel"); sjsf shows the `$defs` title otherwise.
// - Turn `anyOf: [X, {type: "null"}]` into a nullable X, so optional fields render as
//   one input instead of an "option 1 / option 2" picker.
// - Drop RTN's internal model docstring ("Custom Ranks used in SettingsModel.") from descriptions.
// - Mask secrets (API keys, tokens, passwords) as password inputs.
// - Language-code lists (items limited by a `^(en|fr|…)$` pattern) get a dropdown per entry,
//   labelled "English (en)"; marked `x-language-list` so the page keeps them as lists.

type Schema = Record<string, unknown>;

const isObject = (value: unknown): value is Schema =>
    typeof value === "object" && value !== null && !Array.isArray(value);

function collapseNullable(node: Schema): Schema {
    const anyOf = node.anyOf;
    if (!Array.isArray(anyOf) || anyOf.length !== 2) return node;
    const nonNull = anyOf.filter((option) => !(isObject(option) && option.type === "null"));
    if (nonNull.length !== 1 || !isObject(nonNull[0]) || typeof nonNull[0].type !== "string") {
        return node;
    }
    const { anyOf: _, ...rest } = node;
    return { ...nonNull[0], ...rest, type: [nonNull[0].type, "null"] };
}

const SECRET_KEY = /(^|_)(api_?key|token|password|secret)$/i;

function maskSecrets(node: Schema): Schema {
    if (!isObject(node.properties)) return node;
    for (const [key, prop] of Object.entries(node.properties)) {
        if (!isObject(prop) || !SECRET_KEY.test(key)) continue;
        const type = Array.isArray(prop.type) ? prop.type[0] : prop.type;
        if (type !== "string") continue;
        // sjsf derives the input type from `format`; ajv-formats accepts any string for it.
        if (prop.format === undefined) prop.format = "password";
    }
    return node;
}

const CODE_PATTERN = /^\^\(((?:[a-z]{2}\|)*[a-z]{2})\)\$$/;
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

function languageLists(node: Schema): Schema {
    if (!isObject(node.properties)) return node;
    for (const prop of Object.values(node.properties)) {
        if (!isObject(prop) || prop.type !== "array" || !isObject(prop.items)) continue;
        const items = prop.items;
        const match = typeof items.pattern === "string" ? CODE_PATTERN.exec(items.pattern) : null;
        if (!match) continue;
        const { pattern: _, ...rest } = items;
        prop.items = {
            ...rest,
            oneOf: match[1]
                .split("|")
                .map((code) => ({ const: code, title: `${languageNames.of(code) ?? code} (${code})` }))
                .sort((a, b) => a.title.localeCompare(b.title))
        };
        prop["x-language-list"] = true;
    }
    return node;
}

const INTERNAL_DOCSTRING = /\bSettingsModel\b/;

function dropInternalDocs(node: Schema): Schema {
    if (typeof node.description === "string" && INTERNAL_DOCSTRING.test(node.description)) {
        const { description: _, ...rest } = node;
        return rest;
    }
    return node;
}

export function prepareSettingsSchema(schema: Schema): Schema {
    const defs = (schema.$defs ?? {}) as Record<string, Schema>;

    const resolve = (node: unknown, seen: Set<string>): unknown => {
        if (Array.isArray(node)) return node.map((item) => resolve(item, seen));
        if (!isObject(node)) return node;

        let current: Schema = node;
        // Pydantic wraps a ref with siblings as `allOf: [{$ref}]`.
        if (Array.isArray(current.allOf) && current.allOf.length === 1 && isObject(current.allOf[0])) {
            const { allOf, ...rest } = current;
            current = { ...(allOf as Schema[])[0], ...rest };
        }
        if (typeof current.$ref === "string") {
            const name = current.$ref.split("/").pop()!;
            if (seen.has(name)) return current; // recursive model: leave the ref
            const { $ref: _, ...rest } = current;
            const target = resolve(defs[name], new Set([...seen, name])) as Schema;
            current = { ...target, ...rest };
            return dropInternalDocs(languageLists(maskSecrets(collapseNullable(current))));
        }

        const out: Schema = {};
        for (const [key, value] of Object.entries(current)) {
            if (key === "$defs") continue;
            out[key] = resolve(value, seen);
        }
        return dropInternalDocs(languageLists(maskSecrets(collapseNullable(out))));
    };

    return resolve(schema, new Set()) as Schema;
}
