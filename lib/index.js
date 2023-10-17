const { createServer } = require("http");
const express = require("express");
const { join } = require("path");
const morgan = require("morgan");
const { json } = require("body-parser");
const { Auth, CognitoUserInterface } = require("@aws-amplify/auth");

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
    Auth.configure({
      Auth: authConfig || {},
    });
    /**
     * @type {CognitoUserInterface} signInUser
     */
    let signInUser = undefined;
    for (const attempt = 1; attempt <= 10; attempt++) {
      try {
        signInUser = await Auth.signIn(username, password);
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
    /**
     * @type {CognitoUserSession} signInUserSession
     */
    const { signInUserSession } = signInUser || {};
    /**
     * @type {CognitoAccessToken} accessToken
     */
    const { accessToken } = signInUserSession || {};
    /**
     * @type {CognitoIdToken} accessToken
     */
    const { idToken } = signInUserSession || {};
    /**
     * @type {CognitoRefreshToken} accessToken
     */
    const { refreshToken } = signInUserSession || {};
    switch (tokenType) {
      case "access":
        if (!accessToken?.jwtToken) {
          console.debug(signInUser);
          throw new Error("Access Token is not found.");
        }
        res.status(200).jsonp({
          data: {
            token: accessToken.jwtToken,
            accessToken: accessToken.jwtToken,
          },
        });
        break;
      case "id":
        if (!idToken?.jwtToken) {
          console.debug(signInUser);
          throw new Error("ID Token is not found.");
        }
        res.status(200).jsonp({
          data: {
            token: idToken.jwtToken,
            idToken: idToken.jwtToken,
          },
        });
        break;
      case "refresh":
        if (!refreshToken?.jwtToken) {
          console.debug(signInUser);
          throw new Error("Refresh Token is not found.");
        }
        res.status(200).jsonp({
          data: {
            token: refreshToken.jwtToken,
            refreshToken: refreshToken.jwtToken,
          },
        });
        break;
      case "all":
      default:
        if (!accessToken?.jwtToken) {
          console.debug(signInUser);
          throw new Error("Access Token is not found.");
        }
        if (!idToken?.jwtToken) {
          console.debug(signInUser);
          throw new Error("ID Token is not found.");
        }
        if (!refreshToken?.jwtToken) {
          console.debug(signInUser);
          throw new Error("Refresh Token is not found.");
        }
        res.status(200).jsonp({
          data: {
            token: accessToken.jwtToken,
            accessToken: accessToken.jwtToken,
            idToken: idToken.jwtToken,
            refreshToken: refreshToken.jwtToken,
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
