// Shared by the media page's Blacklist dialog and the Logs page's Blacklist tab.
export const BLACKLIST_REASONS: Record<string, string> = {
    cdn_host_down: "CDN server pulled",
    slow_source: "Too slow to play",
    not_cached: "Not cached",
    torrent_removed: "Removed from debrid account",
    download_error: "Download error",
    download_stalled: "Download stalled",
    wrong_files: "Wrong files",
    manual: "Manual",
    unknown: "Unknown"
};

export const blacklistReason = (reason: string) => BLACKLIST_REASONS[reason] ?? reason;

// The backend sends naive local times
export function formatBlacklistTime(value: string | null | undefined): string {
    if (!value) return "";
    return new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

export function blacklistExpiry(expiresAt: string | null | undefined): string {
    if (!expiresAt) return "Permanent";
    const hours = (new Date(expiresAt).getTime() - Date.now()) / 3_600_000;
    if (hours <= 0) return "Expiring now";
    if (hours < 48) return `in ${Math.ceil(hours)} h`;
    return `in ${Math.round(hours / 24)} days`;
}
