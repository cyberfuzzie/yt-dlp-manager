import type { Locale } from '#lib/i18n.ts';

export const availableLocales: Locale[] = ['de', 'en'];

export const defaultLocale: Locale = 'de';

const de: Record<string, string> = {
    // Header
    'app.title': 'yt-dlp Manager',
    'connection.connected': 'Verbunden',
    'connection.connecting': 'Verbinde...',
    'connection.disconnected': 'Getrennt',
    'connection.indicator': 'Status',
    'base.directory': 'Basis-Verzeichnis',

    // DownloadForm
    'form.title': 'Neue Downloads hinzufügen',
    'form.urls.label': 'Video-URLs * (eine pro Zeile)',
    'form.urls.placeholder': 'https://youtube.com/watch?v=...\nhttps://twitch.tv/...\nhttps://youtube.com/watch?v=...',
    'form.urls.urlCount': (n: number) => `${n} URL${n !== 1 ? 's' : ''} erkannt`,
    'form.urls.required': 'Mindestens eine URL ist erforderlich',
    'form.urls.invalid': (url: string) => `Ungültige URL: ${url}`,
    'form.directory.label': 'Zielverzeichnis (relativ, für alle)',
    'form.directory.placeholder': 'z.B. youtube/tutorials',
    'form.directory.hint': 'Leer lassen für Basis-Verzeichnis',
    'form.advanced': 'Erweiterte Optionen',
    'form.advancedLess': 'Weniger Optionen',
    'form.format.label': 'Format',
    'form.format.placeholder': 'z.B. bestvideo+bestaudio/best',
    'form.format.hint': 'yt-dlp Format-Selektor',
    'form.quality.label': 'Max. Qualität',
    'form.quality.placeholder': 'z.B. 1080, 720, 480',
    'form.quality.hint': 'Maximale Höhe in Pixeln',
    'form.submit': 'Downloads starten',
    'form.submitting': 'Wird hinzugefügt...',

    // DownloadList
    'list.empty.title': 'Keine Downloads vorhanden',
    'list.empty.hint': 'Füge oben einen neuen Download hinzu',
    'list.header': (count: number) => `Downloads (${count})`,

    // DownloadItem
    'item.added': 'Hinzugefügt',
    'item.detailsToggle': (open: boolean) => (open ? 'Details ausblenden' : 'Details anzeigen'),
    'item.cancel': 'Download abbrechen',
    'item.copyUrl': 'URL kopieren',
    'item.detail.id': 'ID',
    'item.detail.url': 'URL',
    'item.detail.targetDirectory': 'Zielverzeichnis',
    'item.detail.format': 'Format',
    'item.detail.quality': 'Qualität',
    'item.detail.created': 'Erstellt',
    'item.detail.started': 'Gestartet',
    'item.detail.completed': 'Beendet',

    // Utils
    'utils.now': 'gerade eben',
    'utils.minutesAgo': (n: number) => `vor ${n} Min.`,
    'utils.hoursAgo': (n: number) => `vor ${n} Std.`,
    'utils.daysAgo': (n: number) => `vor ${n} Tag${n !== 1 ? 'en' : ''}`,
    'utils.unknown': 'Unbekannt',

    // Error messages
    'error.add': 'Fehler beim Hinzufügen',
    'error.cancel': 'Fehler beim Abbrechen',
    'error.unknown': 'Unbekannter Fehler',

    // Language switcher
    'lang.de': 'Deutsch',
    'lang.en': 'English',
};

const en: Record<string, string> = {
    // Header
    'app.title': 'yt-dlp Manager',
    'connection.connected': 'Connected',
    'connection.connecting': 'Connecting...',
    'connection.disconnected': 'Disconnected',
    'connection.indicator': 'Status',
    'base.directory': 'Base directory',

    // DownloadForm
    'form.title': 'Add New Downloads',
    'form.urls.label': 'Video URLs * (one per line)',
    'form.urls.placeholder': 'https://youtube.com/watch?v=...\nhttps://twitch.tv/...\nhttps://youtube.com/watch?v=...',
    'form.urls.urlCount': (n: number) => `${n} URL${n !== 1 ? 's' : ''} detected`,
    'form.urls.required': 'At least one URL is required',
    'form.urls.invalid': (url: string) => `Invalid URL: ${url}`,
    'form.directory.label': 'Target directory (relative, for all)',
    'form.directory.placeholder': 'e.g. youtube/tutorials',
    'form.directory.hint': 'Leave blank for base directory',
    'form.advanced': 'Advanced Options',
    'form.advancedLess': 'Fewer Options',
    'form.format.label': 'Format',
    'form.format.placeholder': 'e.g. bestvideo+bestaudio/best',
    'form.format.hint': 'yt-dlp format selector',
    'form.quality.label': 'Max quality',
    'form.quality.placeholder': 'e.g. 1080, 720, 480',
    'form.quality.hint': 'Maximum height in pixels',
    'form.submit': 'Start Downloads',
    'form.submitting': 'Adding...',

    // DownloadList
    'list.empty.title': 'No downloads yet',
    'list.empty.hint': 'Add a new download using the form above',
    'list.header': (count: number) => `Downloads (${count})`,

    // DownloadItem
    'item.added': 'Added',
    'item.detailsToggle': (open: boolean) => (open ? 'Hide details' : 'Show details'),
    'item.cancel': 'Cancel download',
    'item.copyUrl': 'Copy URL',
    'item.detail.id': 'ID',
    'item.detail.url': 'URL',
    'item.detail.targetDirectory': 'Target directory',
    'item.detail.format': 'Format',
    'item.detail.quality': 'Quality',
    'item.detail.created': 'Created',
    'item.detail.started': 'Started',
    'item.detail.completed': 'Completed',

    // Utils
    'utils.now': 'just now',
    'utils.minutesAgo': (n: number) => `${n} min ago`,
    'utils.hoursAgo': (n: number) => `${n} hr ago`,
    'utils.daysAgo': (n: number) => `${n} day${n !== 1 ? 's' : ''} ago`,
    'utils.unknown': 'Unknown',

    // Error messages
    'error.add': 'Error adding',
    'error.cancel': 'Error cancelling',
    'error.unknown': 'Unknown error',

    // Language switcher
    'lang.de': 'German',
    'lang.en': 'English',
};

export const translations: Record<Locale, Record<string, string>> = { de, en };

export function getStatusLabels(locale: Locale): Record<string, string> {
    const map: Record<string, string> = {
        PENDING: locale === 'de' ? 'Wartend' : 'Pending',
        DOWNLOADING: locale === 'de' ? 'Wird heruntergeladen' : 'Downloading',
        COMPLETED: locale === 'de' ? 'Abgeschlossen' : 'Completed',
        FAILED: locale === 'de' ? 'Fehlgeschlagen' : 'Failed',
        CANCELLED: locale === 'de' ? 'Abgebrochen' : 'Cancelled',
    };
    return map;
}
