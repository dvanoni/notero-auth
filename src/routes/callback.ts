import type {
  OauthTokenParameters,
  OauthTokenResponse as OauthTokenSuccessResponse,
} from '@notionhq/client/build/src/api-endpoints';
import {
  encrypt,
  generateSymmetricKey,
  importRSAPublicKey,
  wrapKey,
} from '../crypto';
import { renderError, renderHtml } from '../render';
import { base64Decode, base64Encode, utf8JSONEncode } from '../utils';

type EncryptedTokenResponse = {
  key: string;
  iv: string;
  tokenResponse: string;
};

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

  const [publicKey, nonce] = state.split('.');
  if (!publicKey || !nonce) {
    return renderError('Invalid <code>state</code> parameter', 400);
  }

  // TODO: Check `state` parameter to prevent CSRF attacks

  try {
    const tokenResponse = await createOauthToken(
      env.NOTION_CLIENT_ID,
      env.NOTION_CLIENT_SECRET,
      env.NOTION_REDIRECT_URI,
      code,
    );

    if ('error' in tokenResponse) {
      return renderOauthError(tokenResponse.error);
    }

    const encryptedTokenResponse = await encryptTokenResponse(
      publicKey,
      tokenResponse,
    );
    return openZotero(encryptedTokenResponse, nonce);
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
): Promise<OauthTokenResponse> {
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
  if (
    json !== null &&
    typeof json === 'object' &&
    ('access_token' in json || 'error' in json)
  ) {
    return json as OauthTokenResponse;
  }
  throw new Error('Invalid access token response');
}

async function encryptTokenResponse(
  base64PublicKey: string,
  tokenResponse: OauthTokenSuccessResponse,
): Promise<EncryptedTokenResponse> {
  const publicKeyData = base64Decode(base64PublicKey);
  const publicKey = await importRSAPublicKey(publicKeyData);

  const symmetricKey = await generateSymmetricKey();
  const wrappedKey = await wrapKey(symmetricKey, publicKey);

  const tokenResponseData = utf8JSONEncode(tokenResponse);
  const { encryptedData, iv } = await encrypt(symmetricKey, tokenResponseData);

  return {
    key: base64Encode(wrappedKey),
    iv: base64Encode(iv),
    tokenResponse: base64Encode(encryptedData),
  };
}

function openZotero(
  encryptedTokenResponse: EncryptedTokenResponse,
  nonce: string,
): Response {
  const params = new URLSearchParams({ ...encryptedTokenResponse, nonce });
  const zoteroUrl = `zotero://notero/notion-auth?${params}`;

  return renderHtml(`
    <h1>Connecting Notero to Notion</h1>
    <p>Return to Zotero to complete the connection to Notion.</p>
    <a href="${zoteroUrl}" class="button">Open Zotero</a>
    <p>
      If Zotero does not open or successfully connect to Notion, copy the
      token below and paste it into the Notero preferences window.
    </p>
    <div class="full-width input-group">
      <input id="token-input" class="monospace" type="text" value="${params}" readonly>
      <button id="copy-button" class="button">Copy</button>
    </div>
    <script>
      document.getElementById('token-input').addEventListener('click', (e) => {
        e.target.select();
      });

      document.getElementById('copy-button').addEventListener('click', (e) => {
        try {
          navigator.clipboard.writeText('${params}');

          const originalText = e.target.textContent;
          e.target.textContent = 'Copied!';
          setTimeout(() => {
            e.target.textContent = originalText;
          }, 2000);
        } catch (error) {
          console.error('Failed to copy token:', error);
          e.target.textContent = 'Failed';
        }
      });
    </script>
`);
}
