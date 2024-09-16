import { Buffer } from "node:buffer";

function base64Encode(str) {
  return Buffer.from(str).toString("base64url");
}

async function createOauthToken(clientId, clientSecret, code, redirectUri) {
  const response = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${base64Encode(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
      "User-Agent": "notero-auth",
    },
    body: JSON.stringify({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  return response.json();
}

function openNotionOauth(clientId, redirectUri) {
  // TODO: Add `state` parameter to prevent CSRF attacks
  const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${redirectUri}`;
  return Response.redirect(authUrl, 302);
}

function openZotero(tokenResponse) {
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

function renderError(message, status) {
  const body = `<h1 class="error">An error occurred</h1><p>${message}</p>`;
  return renderHtml(body, status);
}

function renderHtml(body, status) {
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Notero Auth</title>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <style>
      body {
        align-items: center;
        background-color: #f4f4f4;
        display: flex;
        flex-direction: column;
        font-family: sans-serif;
        margin: 2rem;
        text-align: center;
      }
      h1 {
        color: #19855A;
      }
      p {
        color: #37584b;
        line-height: 1.7;
      }
      p, code {
        font-size: 1rem;
      }
      .error {
        color: #af262d;
      }
    </style>
  </head>
  <body>
    <img src="https://assets.vanoni.dev/notero-128.png" alt="Notero logo" width="64" height="64">
${body}
  </body>
</html>
`;
  return new Response(html, {
    headers: { "Content-Type": "text/html" },
    status,
  });
}

export default {
  async fetch(request, env, ctx) {
    const clientId = env.NOTION_CLIENT_ID;
    const clientSecret = env.NOTION_CLIENT_SECRET;
    const redirectUri = env.NOTION_REDIRECT_URI;

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const params = new URL(request.url).searchParams;

    if (params.has("error")) {
      // See https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.2.1
      return renderError(
        `Error code: <code>${params.get("error")}</code>`,
        401,
      );
    }

    // If no code or error provided, redirect to the Notion OAuth login page
    if (!params.has("code")) {
      return openNotionOauth(clientId, redirectUri);
    }

    // TODO: Check for `state` parameter to prevent CSRF attacks
    const code = params.get("code");

    try {
      const tokenResponse = await createOauthToken(
        clientId,
        clientSecret,
        code,
        redirectUri,
      );

      if (tokenResponse.error) {
        // See https://datatracker.ietf.org/doc/html/rfc6749#section-5.2
        return renderError(
          `Error code: <code>${tokenResponse.error}</code>`,
          401,
        );
      }

      return openZotero(tokenResponse);
    } catch (error) {
      console.error(error);
      return renderError(error.message, 500);
    }
  },
};
