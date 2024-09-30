const { createServer } = require("http");
const express = require("express");
const { join } = require("path");
const morgan = require("morgan");
const { json } = require("body-parser");
const { Amplify } = require("aws-amplify");
const { signIn, fetchAuthSession, signOut } = require("aws-amplify/auth");
const { SignatureV4 } = require("@smithy/signature-v4");
const { Sha256 } = require("@aws-crypto/sha256-js");

const app = express();
app.use(
  morgan(
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
  )
);
app.use(express.static(join(__dirname, "..", "public")));
app.use(json({ type: "*/*" }));

app.post("/auth", async (req, res) => {
  try {
    const {
      username,
      password,
      authConfig,
      tokenType = "access",
      withSessionData = false,
    } = req.body;
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: authConfig.userPoolId,
          userPoolClientId: authConfig.userPoolWebClientId,
          identityPoolId: authConfig.identityPoolId,
          signUpVerificationMethod: "code",
          loginWith: {
            oauth: {
              scopes: authConfig.scope,
              responseType: "token",
            },
          },
        },
      },
    });
    /**
     * @type {String} idToken
     */
    let idToken = undefined;
    /**
     * @type {String} accessToken
     */
    let accessToken = undefined;
    /**
     * Signature data
     */
    const session = {
      /**
       * @type {String?} accessKey
       */
      accessKey: null,
      /**
       * @type {String?} secretAccessKey
       */
      secretAccessKey: null,
      /**
       * @type {String?} sessionToken
       */
      sessionToken: null,
    };
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await signIn({
          username,
          password,
          options: {
            authFlowType: authConfig.authenticationFlowType,
          },
        });
        const { tokens, credentials } = await fetchAuthSession();
        idToken = tokens.idToken.toString();
        accessToken = tokens.accessToken.toString();
        session.accessKey = credentials?.accessKeyId;
        session.secretAccessKey = credentials?.secretAccessKey;
        session.sessionToken = credentials?.sessionToken;
        await signOut();
        break;
      } catch (err) {
        console.warn(`Attempt ${attempt}, error:`, err);
        await new Promise((res) => {
          setTimeout(() => {
            res();
          }, 250);
        });
      }
    }
    switch (tokenType) {
      case "access":
        if (!accessToken) {
          throw new Error("Access Token is not found.");
        }
        res.status(200).jsonp({
          data: {
            token: accessToken,
            accessToken,
            ...(withSessionData ? { session } : {}),
          },
        });
        break;
      case "id":
        if (!idToken) {
          throw new Error("ID Token is not found.");
        }
        res.status(200).jsonp({
          data: {
            token: idToken,
            idToken,
            ...(withSessionData ? { session } : {}),
          },
        });
        break;
      case "session":
        if (!session.accessKey) {
          throw new Error("Session Token is not found.");
        }
        res.status(200).jsonp({
          data: {
            session,
          },
        });
        break;
      case "all":
      default:
        if (!accessToken) {
          throw new Error("Access Token is not found.");
        }
        if (!idToken) {
          throw new Error("ID Token is not found.");
        }
        res.status(200).jsonp({
          data: {
            token: accessToken,
            accessToken,
            idToken,
            ...(withSessionData ? { session } : {}),
          },
        });
        break;
    }
  } catch (err) {
    console.debug(err);
    res.status(500).jsonp({ error: err, message: err?.message });
  }
});

app.post("/sign", async (req, res) => {
  try {
    const { username, password, authConfig, params, serviceInfo } = req.body;
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: authConfig.userPoolId,
          userPoolClientId: authConfig.userPoolWebClientId,
          identityPoolId: authConfig.identityPoolId,
          signUpVerificationMethod: "code",
          loginWith: {
            oauth: {
              scopes: authConfig.scope,
              responseType: "token",
            },
          },
        },
      },
    });
    /**
     * @type { URL } - signed request
     */
    let signedRequest = {};
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await signIn({
          username,
          password,
          options: {
            authFlowType: authConfig.authenticationFlowType,
          },
        });
        let err;
        try {
          const { credentials } = await fetchAuthSession();

          if (credentials === undefined) {
            throw new Error("Unauthorized");
          }

          const url = new URL(params.url);

          const request = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: params?.method,
            body: params?.body ? JSON.stringify(params?.body) : null,
            headers: {
              host: url.hostname, // host is required by AWS Signature V4
              "Content-Type": "application/json",
            },
          };

          const signer = new SignatureV4({
            credentials,
            region: serviceInfo.region,
            service: serviceInfo.service,
            sha256: Sha256,
          });

          signedRequest = await signer.sign(request);
        } catch (error) {
          err = error;
        } finally {
          await signOut();
          if (err) throw err;
        }
        break;
      } catch (err) {
        console.warn(`Attempt ${attempt}, error:`, err);
        await new Promise((res) => {
          setTimeout(() => {
            res();
          }, 250);
        });
      }
    }
    res.status(200).jsonp({
      data: {
        signedRequest,
      },
    });
  } catch (err) {
    console.debug(err);
    res.status(500).jsonp({ error: err, message: err?.message });
  }
});

createServer({}, app).listen(10000);
