import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DownloadForm from '#lib/components/DownloadForm.svelte';
import { setLocale } from '#lib/i18n.ts';

const urlsLabel = 'Video-URLs * (eine pro Zeile)';

describe('DownloadForm', () => {
	beforeEach(() => setLocale('de'));

	it('renders the form with the base directory prefix', () => {
		render(DownloadForm, { props: { onSubmit: vi.fn(), baseDirectory: '/downloads' } });
		expect(screen.getByLabelText(urlsLabel)).toBeInTheDocument();
		expect(screen.getByText('/downloads/')).toBeInTheDocument();
		expect(screen.getByText('Downloads starten')).toBeInTheDocument();
	});

	it('shows the number of detected URLs', async () => {
		render(DownloadForm, { props: { onSubmit: vi.fn() } });
		await fireEvent.input(screen.getByLabelText(urlsLabel), {
			target: { value: 'https://a.example\n\nhttps://b.example\n' },
		});
		expect(screen.getByText('2 URLs erkannt')).toBeInTheDocument();
	});

	it('shows a singular URL count', async () => {
		render(DownloadForm, { props: { onSubmit: vi.fn() } });
		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example' } });
		expect(screen.getByText('1 URL erkannt')).toBeInTheDocument();
	});

	it('rejects an empty submission', async () => {
		const onSubmit = vi.fn();
		const { container } = render(DownloadForm, { props: { onSubmit } });
		await fireEvent.submit(container.querySelector('form') as HTMLFormElement);
		expect(screen.getByText('Mindestens eine URL ist erforderlich')).toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('rejects invalid URLs', async () => {
		const onSubmit = vi.fn();
		const { container } = render(DownloadForm, { props: { onSubmit } });
		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'not a url' } });
		await fireEvent.submit(container.querySelector('form') as HTMLFormElement);
		expect(screen.getByText('Ungültige URL: not a url')).toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('submits the parsed URLs with optional settings and resets the form', async () => {
		const onSubmit = vi.fn();
		const { container } = render(DownloadForm, { props: { onSubmit } });
		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: ' https://a.example\n' } });
		await fireEvent.click(screen.getByText('Erweiterte Optionen'));
		await fireEvent.input(screen.getByLabelText('Zielverzeichnis (relativ, für alle)'), { target: { value: 'videos' } });
		await fireEvent.input(screen.getByLabelText('Format'), { target: { value: 'bestvideo+bestaudio' } });
		await fireEvent.input(screen.getByLabelText('Max. Qualität'), { target: { value: '1080' } });

		await fireEvent.submit(container.querySelector('form') as HTMLFormElement);
		expect(onSubmit).toHaveBeenCalledWith([
			{
				url: 'https://a.example',
				targetDirectory: 'videos',
				format: 'bestvideo+bestaudio',
				quality: '1080',
				filenamePattern: undefined,
			},
		]);
		expect(screen.queryByText('1 URL erkannt')).not.toBeInTheDocument();
	});

	it('hides advanced options again', async () => {
		render(DownloadForm, { props: { onSubmit: vi.fn() } });
		await fireEvent.click(screen.getByText('Erweiterte Optionen'));
		expect(screen.getByLabelText('Format')).toBeInTheDocument();
		await fireEvent.click(screen.getByText('Weniger Optionen'));
		expect(screen.queryByLabelText('Format')).not.toBeInTheDocument();
	});

	it('replaces the URLs on paste', async () => {
		render(DownloadForm, { props: { onSubmit: vi.fn() } });
		const paste = new Event('paste') as ClipboardEvent;
		Object.defineProperty(paste, 'clipboardData', {
			value: { getData: () => 'https://pasted.example' },
		});
		await fireEvent(screen.getByLabelText(urlsLabel), paste);
		expect(screen.getByText('1 URL erkannt')).toBeInTheDocument();
	});

	it('ignores empty pastes', async () => {
		render(DownloadForm, { props: { onSubmit: vi.fn() } });
		const paste = new Event('paste') as ClipboardEvent;
		Object.defineProperty(paste, 'clipboardData', {
			value: { getData: () => '  ' },
		});
		await fireEvent(screen.getByLabelText(urlsLabel), paste);
		expect(screen.queryByText(/URLs? erkannt/)).not.toBeInTheDocument();
	});

	it('disables the controls while loading', () => {
		const { container } = render(DownloadForm, { props: { onSubmit: vi.fn(), isLoading: true } });
		expect(screen.getByText('Wird hinzugefügt...')).toBeInTheDocument();
		expect(screen.getByLabelText(urlsLabel)).toBeDisabled();
		expect(container.querySelector('button[type="submit"]')).toBeDisabled();
	});

	it('selecting "Video-ID + Titel" sends the preset pattern', async () => {
		const onSubmit = vi.fn();
		const { container } = render(DownloadForm, { props: { onSubmit } });
		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example\n' } });
		const select = screen.getByLabelText('Dateinamen-Muster (für alle)');
		await fireEvent.change(select, { target: { value: 'idTitle' } });
		await fireEvent.submit(container.querySelector('form') as HTMLFormElement);
		expect(onSubmit).toHaveBeenCalledWith([
			{
				url: 'https://a.example',
				targetDirectory: undefined,
				format: undefined,
				quality: undefined,
				filenamePattern: '%(id)s %(title)s.%(ext)s',
			},
		]);
	});

	it('selecting "Datum + Titel" sends the preset pattern', async () => {
		const onSubmit = vi.fn();
		const { container } = render(DownloadForm, { props: { onSubmit } });
		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example\n' } });
		const select = screen.getByLabelText('Dateinamen-Muster (für alle)');
		await fireEvent.change(select, { target: { value: 'dateTitle' } });
		await fireEvent.submit(container.querySelector('form') as HTMLFormElement);
		expect(onSubmit).toHaveBeenCalledWith([
			{
				url: 'https://a.example',
				targetDirectory: undefined,
				format: undefined,
				quality: undefined,
				filenamePattern: '%(upload_date>%Y-%m-%d)s %(title)s.%(ext)s',
			},
		]);
	});

	it('custom pattern sends user input', async () => {
		const onSubmit = vi.fn();
		const { container } = render(DownloadForm, { props: { onSubmit } });
		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example\n' } });
		const select = screen.getByLabelText('Dateinamen-Muster (für alle)');
		await fireEvent.change(select, { target: { value: 'custom' } });
		await fireEvent.input(screen.getByLabelText('Eigenes yt-dlp-Muster'), { target: { value: '%(title)s' } });
		await fireEvent.submit(container.querySelector('form') as HTMLFormElement);
		expect(onSubmit).toHaveBeenCalledWith([
			{
				url: 'https://a.example',
				targetDirectory: undefined,
				format: undefined,
				quality: undefined,
				filenamePattern: '%(title)s',
			},
		]);
	});

	it('empty custom pattern submits undefined', async () => {
		const onSubmit = vi.fn();
		const { container } = render(DownloadForm, { props: { onSubmit } });
		await fireEvent.input(screen.getByLabelText(urlsLabel), { target: { value: 'https://a.example\n' } });
		const select = screen.getByLabelText('Dateinamen-Muster (für alle)');
		await fireEvent.change(select, { target: { value: 'custom' } });
		await fireEvent.submit(container.querySelector('form') as HTMLFormElement);
		expect(onSubmit).toHaveBeenCalledWith([
			{
				url: 'https://a.example',
				targetDirectory: undefined,
				format: undefined,
				quality: undefined,
				filenamePattern: undefined,
			},
		]);
	});

	it('custom input is hidden unless custom is selected', async () => {
		render(DownloadForm, { props: { onSubmit: vi.fn() } });
		expect(screen.queryByLabelText('Eigenes yt-dlp-Muster')).not.toBeInTheDocument();
		const select = screen.getByLabelText('Dateinamen-Muster (für alle)');
		await fireEvent.change(select, { target: { value: 'custom' } });
		expect(screen.getByLabelText('Eigenes yt-dlp-Muster')).toBeInTheDocument();
	});
});