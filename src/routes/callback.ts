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
  if (error) {
    // TODO: Only render valid error codes (to prevent injection attacks)
    // See https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2.1
    return renderError(`Error code: <code>${error}</code>`, 401);
  }

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
      // TODO: Only render valid error codes (to prevent injection attacks)
      // See https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
      return renderError(
        `Error code: <code>${tokenResponse.error}</code>`,
        401,
      );
    }

    return openZotero(tokenResponse);
  } catch (error: any) {
    console.error(error);
    return renderError(error.message, 500);
  }
};

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
