import { callback, login } from './routes';

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const url = new URL(request.url);

    switch (url.pathname) {
      case '/callback':
        return callback(request, env, ctx);
      case '/login':
        return login(request, env, ctx);
      default:
        return new Response('Not found', { status: 404 });
    }
  },
} satisfies ExportedHandler<Env>;
