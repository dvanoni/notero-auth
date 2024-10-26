import type {
  OauthTokenParameters,
  OauthTokenResponse as OauthTokenSuccessResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { renderError, renderHtml } from '../render';
import { base64Encode } from '../utils';

type OauthTokenErrorResponse = {
  error: string;
};

type OauthTokenResponse = OauthTokenSuccessResponse | OauthTokenErrorResponse;

export const handler: ExportedHandlerFetchHandler<Env> = async (
  request,
  env,
  ctx,
) => {
  const params = new URL(request.url).searchParams;

  const error = params.get('error');
  if (error) return renderOauthError(error);

  const code = params.get('code');
  if (!code) return renderError('Missing <code>code</code> parameter', 400);

  const state = params.get('state');
  if (!state) return renderError('Missing <code>state</code> parameter', 400);

  // TODO: Check `state` parameter to prevent CSRF attacks

  try {
    const tokenResponse = await createOauthToken(
      env.NOTION_CLIENT_ID,
      env.NOTION_CLIENT_SECRET,
      env.NOTION_REDIRECT_URI,
      code,
    );

    if (!tokenResponse) {
      return renderError('Unexpected error', 500);
    }

    if ('error' in tokenResponse) {
      return renderOauthError(tokenResponse.error);
    }

    return openZotero(tokenResponse);
  } catch (error: any) {
    console.error(error);
    return renderError(error.message, 500);
  }
};

/**
 * Render the error if it's a valid one from either of the following:
 *  - https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2.1
 *  - https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
 *
 * Otherwise, render a generic error message.
 */
function renderOauthError(error: string): Response {
  switch (error) {
    case 'access_denied':
      return renderError('Access denied', 403);
    case 'invalid_client':
      return renderError('Invalid client', 401);
    case 'invalid_grant':
      return renderError('Invalid grant', 400);
    case 'invalid_request':
      return renderError('Invalid request', 400);
    case 'invalid_scope':
      return renderError('Invalid scope', 400);
    case 'server_error':
      return renderError('Server error', 500);
    case 'temporarily_unavailable':
      return renderError('Temporarily unavailable', 503);
    case 'unauthorized_client':
      return renderError('Unauthorized client', 401);
    case 'unsupported_grant_type':
      return renderError('Unsupported grant type', 400);
    case 'unsupported_response_type':
      return renderError('Unsupported response type', 400);
    default:
      return renderError('Unexpected error', 500);
  }
}

async function createOauthToken(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
): Promise<OauthTokenResponse | null> {
  const body: OauthTokenParameters = {
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  };
  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${base64Encode(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
      'User-Agent': 'notero-auth',
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (typeof json !== 'object' || json === null) return null;
  if ('access_token' in json) return json as OauthTokenSuccessResponse;
  if ('error' in json) return json as OauthTokenErrorResponse;
  return null;
}

function openZotero(tokenResponse: OauthTokenSuccessResponse): Response {
  const encodedResponse = base64Encode(JSON.stringify(tokenResponse));
  const body = `
    <h1>Connecting Notero to Notion</h1>
    <p>
      When prompted, click <strong>"Open Zotero"</strong> to complete the connection.<br>
      You may then close this page.
    </p>
    <script>
      setTimeout(() => {
        window.open("zotero://notero/notion-auth?tokenResponse=${encodedResponse}");
      }, 1000);
    </script>
`;
  return renderHtml(body);
}
