// The temporary tunnel sends its public HTTPS requests to localhost.
// Keep this an exact origin: other tunnels and arbitrary forwarded headers
// must not grant access to the local pairing API.
const previewOrigin =
  'https://unfortunately-illinois-downtown-ways.trycloudflare.com';

export function allowedRequestOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const target = new URL(request.url);
  if (!origin || origin === target.origin) return true;
  const forwardedProto = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    .trim();
  if (
    forwardedProto === 'https' &&
    origin === `https://${target.host}`
  )
    return true;
  return (
    ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) &&
    origin === previewOrigin
  );
}
