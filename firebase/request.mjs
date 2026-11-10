import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';

// Cloud Functions has already consumed the body; give Astro a fresh byte stream.
// Canonicalize the origin so forwarded Host headers cannot influence links or CSRF checks.
export function astroRequest(req, siteUrl) {
  const origin = new URL(siteUrl);
  const body = req.rawBody ?? Buffer.alloc(0);
  const stream = Readable.from(body.length ? [body] : []);
  stream.method = req.method;
  stream.url = req.originalUrl || req.url;
  stream.headers = {...req.headers, host: origin.host};
  delete stream.headers['x-forwarded-host'];
  delete stream.headers['x-forwarded-proto'];
  stream.rawHeaders = Object.entries(stream.headers).flatMap(([key, value]) => [key, String(value)]);
  const socket = new EventEmitter();
  socket.encrypted = origin.protocol === 'https:';
  socket.remoteAddress = req.socket?.remoteAddress || 'unknown';
  socket.destroyed = false;
  stream.socket = socket;
  stream.connection = socket;
  stream.httpVersion = '1.1';
  return stream;
}
