# This container allows you to use amazone cognito (amplify) authorization in postman

The container does not save your data, after successfully receiving the token and returning the result, it no longer knows anything about your account. This is done from a security point of view.

**All settings are made in the Postman application, the container does not require configuration.**

## Setup

Add configuration settings:

- COGNITO_AUTH_USER
- COGNITO_AUTH_PASSWORD
- COGNITO_AUTH_CONFIG

Example:

| `COGNITO_AUTH_USER` | `COGNITO_AUTH_PASSWORD` | `COGNITO_AUTH_CONFIG` |
| --- | --- | --- |
| `test_user@email.com` | `test_user_password` | `{"scope":["email","openid"],"identityPoolId":"us-central-1:test_pool_id","region":"us-central-1","userPoolId":"us-central-1_TESTPOOLID","userPoolWebClientId":"test-pool-web-client-id","authenticationFlowType":"USER_SRP_AUTH"}` |

Add this code to Scripts/Before query:

```js
const authConfig = JSON.parse(pm.environment.get("COGNITO_AUTH_CONFIG"));
const username = pm.environment.get("COGNITO_AUTH_USER");
const password = pm.environment.get("COGNITO_AUTH_PASSWORD");

const postRequest = {
  url: "http://localhost:10000/auth",
  method: "POST",
  header: {
    "Content-Type": "application/json",
  },
  body: {
    mode: "raw",
    raw: JSON.stringify({
      username,
      password,
      authConfig,
    }),
  },
};

pm.sendRequest(postRequest, (error, response) => {
  if (error) {
    console.log(error);
    return;
  }
  const { token } = response.json().data;
  pm.collectionVariables.set("AUTH_TOKEN", token);
});
```

Use the `{{AUTH_TOKEN}}` variable for authorization (for example in header).
