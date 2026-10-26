
const allowedOrigins = [
	'http://localhost:5175'
];

const DRIVE_AUDIO_HOSTS = [
	'drive.google.com',
	'docs.google.com',
	'drive.usercontent.google.com'
];

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

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get('Origin');

		const corsHeaders: Record<string, string> = {};

		if (origin && allowedOrigins.includes(origin)) {
			corsHeaders['Access-Control-Allow-Origin'] = origin;
			corsHeaders['Vary'] = 'Origin';
			corsHeaders['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
			corsHeaders['Access-Control-Allow-Headers'] = 'Content-Type';
		}

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
				const audioResponse = await fetch(
					`https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`
				);

				if (!audioResponse.ok) {
					return Response.json(
						{ error: 'No se pudo descargar el audio' },
						{
							status: 502,
							headers: corsHeaders
						}
					);
				}

				return new Response(audioResponse.body, {
					status: 200,
					headers: {
						...corsHeaders,
						'Content-Type': audioResponse.headers.get('Content-Type') ?? 'audio/mpeg',
						'Cache-Control': 'public, max-age=31536000, immutable'
					}
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

		if (request.method === 'GET' && url.pathname === '/api/stories') {
			try {
				const { results } = await env.cuentopolis_db
					.prepare(`
						SELECT *
						FROM stories
						ORDER BY created_at DESC
					`)
					.all();

				return Response.json(results, {
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