
const allowedOrigins = [
	'http://localhost:5175'
];

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

		if (request.method === 'GET' && url.pathname === '/api/stories') {
			try {
				const { results } = await env.cuentopolis_db
					.prepare(`
						SELECT id, title, description, cover, content, created_at
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