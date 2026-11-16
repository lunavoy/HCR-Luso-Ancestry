const jsonError = (status, detail) => Response.json({ detail }, {
  status,
  headers: { 'Cache-Control': 'no-store' },
})

export async function onRequest({ request, env }) {
  let origin
  try {
    origin = new URL(env.FASTAPI_ORIGIN)
    if (origin.protocol !== 'https:' || origin.href !== `${origin.origin}/`) {
      throw new Error('Invalid origin')
    }
  } catch {
    return jsonError(503, 'Endereço HTTPS da API ainda não configurado.')
  }

  const url = new URL(request.url)
  const target = new URL(origin)
  target.pathname = url.pathname
  target.search = url.search
  const headers = new Headers()
  for (const name of ['authorization', 'content-type', 'accept']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const { CF_ACCESS_CLIENT_ID: id, CF_ACCESS_CLIENT_SECRET: secret } = env
  if (id && secret) {
    headers.set('CF-Access-Client-Id', id)
    headers.set('CF-Access-Client-Secret', secret)
  }

  try {
    const upstream = await fetch(new Request(target, request), {
      headers,
      redirect: 'manual',
    })
    if (upstream.status >= 300 && upstream.status < 400) {
      return jsonError(502, 'A API retornou um redirecionamento inesperado.')
    }
    const responseHeaders = new Headers(upstream.headers)
    responseHeaders.delete('set-cookie')
    responseHeaders.set('Cache-Control', 'no-store')
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    return jsonError(502, 'Não foi possível conectar ao backend pelo túnel.')
  }
}
