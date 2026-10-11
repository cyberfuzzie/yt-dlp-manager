import { t, getLocale } from '#lib/i18n.ts';

export function formatDate(dateString: string, locale?: string): string {
    const date = new Date(dateString);
    const loc = locale ?? getLocale() === 'en' ? 'en-US' : 'de-DE';
    return date.toLocaleString(loc, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return t('utils.now');
    if (diffMins < 60) return t('utils.minutesAgo', diffMins);
    if (diffHours < 24) return t('utils.hoursAgo', diffHours);
    if (diffDays < 7) return t('utils.daysAgo', diffDays);
    return formatDate(dateString);
}

export function formatBytes(bytes: number | null): string {
    if (bytes === null || bytes === undefined) return t('utils.unknown');
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
}

export function extractDomain(url: string): string {
    try {
        const hostname = new URL(url).hostname;
        return hostname.replace('www.', '');
    } catch {
        return url;
    }
}
