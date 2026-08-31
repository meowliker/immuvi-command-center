function queryFromUrl(url) {
  const out = {};
  const parsed = new URL(url);

  for (const [key, value] of parsed.searchParams.entries()) {
    if (out[key] === undefined) {
      out[key] = value;
    } else if (Array.isArray(out[key])) {
      out[key].push(value);
    } else {
      out[key] = [out[key], value];
    }
  }

  return out;
}

async function bodyFromRequest(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;

  const contentType = request.headers.get('content-type') || '';
  const text = await request.text();
  if (!text) return undefined;

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

function headersFromRequest(request) {
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
    headers[key.toLowerCase()] = value;
  });
  return headers;
}

function createLegacyResponse() {
  const headers = new Headers();
  let statusCode = 200;
  let body = '';
  let finished = false;

  return {
    legacy: {
      setHeader(name, value) {
        headers.set(name, String(value));
      },
      status(code) {
        statusCode = code;
        return this;
      },
      json(value) {
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json; charset=utf-8');
        }
        body = JSON.stringify(value);
        finished = true;
        return this;
      },
      send(value) {
        body = value === undefined ? '' : value;
        finished = true;
        return this;
      },
      end(value) {
        body = value === undefined ? '' : value;
        finished = true;
        return this;
      },
    },
    toResponse() {
      return new Response(body, { status: statusCode, headers });
    },
    get finished() {
      return finished;
    },
  };
}

export async function runLegacyHandler(handler, request) {
  const req = {
    method: request.method,
    url: request.url,
    query: queryFromUrl(request.url),
    headers: headersFromRequest(request),
    body: await bodyFromRequest(request),
  };

  const res = createLegacyResponse();
  await handler(req, res.legacy);

  return res.toResponse();
}
