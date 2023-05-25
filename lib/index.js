const { createServer } = require("http");
const express = require("express");
const { join } = require("path");
const morgan = require("morgan");
const { json } = require("body-parser");
const { Auth } = require("@aws-amplify/auth");

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
    const { username, password, authConfig } = req.body;
    Auth.configure({
      Auth: authConfig || {},
    });
    const signInUser = await Auth.signIn(username, password);
    const { signInUserSession } = signInUser || {};
    const { accessToken } = signInUserSession || {};
    const { jwtToken } = accessToken;
    if (!jwtToken) {
      console.debug(signInUser);
      throw new Error("Token is not found.");
    }
    res.status(200).jsonp({ data: { token: jwtToken } });
  } catch (err) {
    console.debug(err);
    res.status(500).jsonp({ error: err, message: err?.message });
  }
});

createServer({}, app).listen(10000);
