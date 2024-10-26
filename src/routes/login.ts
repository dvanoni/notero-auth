import { renderError } from '../render';

export const handler: ExportedHandlerFetchHandler<Env> = (
  request,
  env,
  ctx,
) => {
  const params = new URL(request.url).searchParams;

  const state = params.get('state');
  if (!state) return renderError('Missing <code>state</code> parameter', 400);

  return openNotionOauth(env.NOTION_CLIENT_ID, env.NOTION_REDIRECT_URI, state);
};

function openNotionOauth(
  clientId: string,
  redirectUri: string,
  state: string,
): Response {
  const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${redirectUri}&state=${state}`;
  return Response.redirect(authUrl, 302);
}
