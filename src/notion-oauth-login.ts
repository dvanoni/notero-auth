import type {
  OauthTokenParameters,
  OauthTokenResponse as OauthTokenSuccessResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { Buffer } from 'node:buffer';
import { renderError, renderHtml } from './render';

type OauthTokenErrorResponse = {
  error: string;
};

type OauthTokenResponse = OauthTokenSuccessResponse | OauthTokenErrorResponse;

function base64Encode(str: string): string {
  return Buffer.from(str).toString('base64url');
}

async function createOauthToken(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
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

function openNotionOauth(clientId: string, redirectUri: string): Response {
  // TODO: Add `state` parameter to prevent CSRF attacks
  console.log('rediretUri', redirectUri);
  const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${redirectUri}`;
  console.log('authUrl', authUrl);
  return Response.redirect(authUrl, 302);
}

function openZotero(tokenResponse: any): Response {
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

export default {
  async fetch(request, env, ctx) {
    const clientId = env.NOTION_CLIENT_ID;
    const clientSecret = env.NOTION_CLIENT_SECRET;
    const redirectUri = env.NOTION_REDIRECT_URI;

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const params = new URL(request.url).searchParams;

    if (params.has('error')) {
      // See https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2.1
      return renderError(
        `Error code: <code>${params.get('error')}</code>`,
        401,
      );
    }

    // If no code or error provided, redirect to the Notion OAuth login page
    const code = params.get('code');
    if (!code) {
      const response = openNotionOauth(clientId, redirectUri);
      console.log('response', response);
      return response;
    }

    // TODO: Check for `state` parameter to prevent CSRF attacks

    try {
      const tokenResponse = await createOauthToken(
        clientId,
        clientSecret,
        code,
        redirectUri,
      );

      if (!tokenResponse) {
        return renderError('An error occurred', 500);
      }

      if ('error' in tokenResponse) {
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
  },
} satisfies ExportedHandler<Env>;
