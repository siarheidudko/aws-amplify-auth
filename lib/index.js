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
    const { username, password, authConfig, tokenType = "access" } = req.body;
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
    for (let attempt = 1; attempt <= 10; attempt++) {
      try {
        await signIn({
          username,
          password,
          options: {
            authFlowType: authConfig.authenticationFlowType,
          },
        });
        const { tokens } = await fetchAuthSession();
        idToken = tokens.idToken.toString();
        accessToken = tokens.accessToken.toString();
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
            accessToken: accessToken,
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
            idToken: idToken,
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
            accessToken: accessToken,
            idToken: idToken,
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
