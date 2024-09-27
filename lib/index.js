const { createServer } = require("http");
const express = require("express");
const { join } = require("path");
const morgan = require("morgan");
const { json } = require("body-parser");
const { Amplify } = require("aws-amplify");
const { signIn, fetchAuthSession, signOut } = require("aws-amplify/auth");

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
       * @type {String?} xAmzSecurityToken
       */
      xAmzSecurityToken: null,
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
        session.xAmzSecurityToken = credentials?.sessionToken;
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

createServer({}, app).listen(10000);
