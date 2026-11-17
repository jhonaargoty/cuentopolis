const DEFAULT_ALLOWED_ORIGINS = [
	'http://localhost:5173',
	'http://localhost:5175',
	'https://jhonaargoty.github.io'
];

const DRIVE_AUDIO_HOSTS = [
	'drive.google.com',
	'docs.google.com',
	'drive.usercontent.google.com'
];

const DRIVE_IMAGE_HOSTS = [
	'lh3.googleusercontent.com',
	'drive.google.com',
	'docs.google.com',
	'drive.usercontent.google.com'
];

function getAllowedOrigins(env: Env): string[] {
	const configuredOrigins = env.ALLOWED_ORIGINS?.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);

	return configuredOrigins?.length ? configuredOrigins : DEFAULT_ALLOWED_ORIGINS;
}

function getCorsHeaders(origin: string | null, env: Env): Record<string, string> {
	if (!origin || !getAllowedOrigins(env).includes(origin)) {
		return { Vary: 'Origin' };
	}

	return {
		'Access-Control-Allow-Origin': origin,
		Vary: 'Origin',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Range',
		'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
	};
}

function getDriveFileId(value: string): string | null {
	if (/^[a-zA-Z0-9_-]+$/.test(value)) {
		return value;
	}

	let url: URL;

	try {
		url = new URL(value);
	} catch {
		return null;
	}

	if (!DRIVE_AUDIO_HOSTS.includes(url.hostname)) {
		return null;
	}

	const fileId = url.searchParams.get('id');
	if (fileId && /^[a-zA-Z0-9_-]+$/.test(fileId)) {
		return fileId;
	}

	const pathMatch = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
	return pathMatch?.[1] ?? null;
}

function getDriveImageUrl(value: string): string | null {
	let url: URL;

	try {
		url = new URL(value);
	} catch {
		return null;
	}

	if (!DRIVE_IMAGE_HOSTS.includes(url.hostname)) {
		return null;
	}

	url.protocol = 'https:';
	return url.toString();
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get('Origin');
		const corsHeaders = getCorsHeaders(origin, env);

		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: corsHeaders
			});
		}

		if (request.method === 'GET' && url.pathname === '/api/audio') {
			const fileId = getDriveFileId(url.searchParams.get('id') ?? '');

			if (!fileId) {
				return Response.json(
					{ error: 'Audio no válido' },
					{
						status: 400,
						headers: corsHeaders
					}
				);
			}

			try {
				const range = request.headers.get('Range');
				const upstreamHeaders = new Headers();

				if (range) {
					upstreamHeaders.set('Range', range);
				}

				const audioResponse = await fetch(
					`https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`,
					{ headers: upstreamHeaders }
				);

				if (!audioResponse.ok && audioResponse.status !== 206) {
					return Response.json(
						{ error: 'No se pudo descargar el audio' },
						{
							status: 502,
							headers: corsHeaders
						}
					);
				}

				const contentType = audioResponse.headers.get('Content-Type') ?? '';

				if (contentType.includes('text/html')) {
					return Response.json(
						{
							error:
								'Drive devolvió una página de confirmación en vez del audio. Revisa los permisos del archivo.'
						},
						{
							status: 502,
							headers: corsHeaders
						}
					);
				}

				const audioHeaders: Record<string, string> = {
					...corsHeaders,
					'Content-Type': contentType || 'audio/mpeg',
					'Cache-Control': 'public, max-age=31536000, immutable',
					'Accept-Ranges': audioResponse.headers.get('Accept-Ranges') ?? 'bytes'
				};

				for (const headerName of ['Content-Length', 'Content-Range']) {
					const headerValue = audioResponse.headers.get(headerName);
					if (headerValue) {
						audioHeaders[headerName] = headerValue;
					}
				}

				return new Response(audioResponse.body, {
					status: audioResponse.status === 206 ? 206 : 200,
					headers: audioHeaders
				});
			} catch (error) {
				console.error(error);

				return Response.json(
					{ error: 'Error al obtener el audio' },
					{
						status: 500,
						headers: corsHeaders
					}
				);
			}
		}

		if (request.method === 'GET' && url.pathname === '/api/image') {
			const imageUrl = getDriveImageUrl(url.searchParams.get('src') ?? '');

			if (!imageUrl) {
				return Response.json(
					{ error: 'Imagen no válida' },
					{
						status: 400,
						headers: corsHeaders
					}
				);
			}

			try {
				const imageResponse = await fetch(imageUrl, {
					headers: {
						Accept: 'image/*'
					}
				});

				if (!imageResponse.ok) {
					return Response.json(
						{ error: 'No se pudo descargar la imagen' },
						{
							status: 502,
							headers: corsHeaders
						}
					);
				}

				const contentType = imageResponse.headers.get('Content-Type') ?? '';

				if (!contentType.startsWith('image/')) {
					return Response.json(
						{ error: 'La portada remota no es una imagen' },
						{
							status: 502,
							headers: corsHeaders
						}
					);
				}

				return new Response(imageResponse.body, {
					status: 200,
					headers: {
						...corsHeaders,
						'Content-Type': contentType,
						'Cache-Control': 'public, max-age=31536000, immutable'
					}
				});
			} catch (error) {
				console.error(error);

				return Response.json(
					{ error: 'Error al obtener la imagen' },
					{
						status: 500,
						headers: corsHeaders
					}
				);
			}
		}

		const storyResourcesMatch = url.pathname.match(/^\/api\/stories\/(\d+)\/resources$/);

		if (request.method === 'GET' && storyResourcesMatch) {
			try {
				const { results } = await env.cuentopolis_db
					.prepare(`
						SELECT page, word, audio_url
						FROM story_resources
						WHERE story_id = ?
						ORDER BY page, id
					`)
					.bind(Number(storyResourcesMatch[1]))
					.all();

				return Response.json(results, {
					headers: corsHeaders
				});
			} catch (error) {
				console.error(error);

				return Response.json(
					{ error: 'Error al obtener los recursos del cuento' },
					{
						status: 500,
						headers: corsHeaders
					}
				);
			}
		}

		if (request.method === 'GET' && url.pathname === '/api/stories') {
			try {
				const { results } = await env.cuentopolis_db
					.prepare(`
						SELECT *
						FROM stories
						ORDER BY created_at DESC
					`)
					.all();

				const resourcesByStory = new Map<number, unknown[]>();

				try {
					const { results: resourceRows } = await env.cuentopolis_db
						.prepare(`
							SELECT story_id, page, word, audio_url
							FROM story_resources
							ORDER BY story_id, page, id
						`)
						.all<{
							story_id: number;
							page: number;
							word: string;
							audio_url: string;
						}>();

					for (const resource of resourceRows) {
						const storyResources = resourcesByStory.get(resource.story_id) ?? [];
						storyResources.push({
							page: resource.page,
							word: resource.word,
							audio_url: resource.audio_url
						});
						resourcesByStory.set(resource.story_id, storyResources);
					}
				} catch (error) {
					console.error('No se pudieron cargar los recursos de los cuentos', error);
				}

				const stories = results.map((story) => ({
					...story,
					resources: resourcesByStory.get(Number(story.id)) ?? []
				}));

				return Response.json(stories, {
					headers: corsHeaders
				});
			} catch (error) {
				console.error(error);

				return Response.json(
					{ error: 'Error al obtener los cuentos' },
					{
						status: 500,
						headers: corsHeaders
					}
				);
			}
		}

		return Response.json(
			{ error: 'Ruta no encontrada' },
			{
				status: 404,
				headers: corsHeaders
			}
		);
	}
} satisfies ExportedHandler<Env>;
