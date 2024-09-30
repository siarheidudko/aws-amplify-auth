# This container allows you to use amazon cognito (amplify) authorization in postman

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
| `test_user@email.com` | `test_user_password` | `{"scope":["email","openid"],"identityPoolId":"us-central-1:test_pool_id","userPoolId":"us-central-1_TESTPOOLID","userPoolWebClientId":"test-pool-web-client-id","authenticationFlowType":"USER_SRP_AUTH"}` |

Add this code to your Pre-Request script:

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
      tokenType: 'id',
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

You can use various tokenType options.

| `tokenType` | Return params |
| --- | --- |
| `access` | - `token` (JWT, Cognito Access Token) <br>- `accessToken` (JWT, Cognito Access Token) |
| `id` | - `token` (JWT, Cognito ID Token) <br>- `idToken` (JWT, Cognito ID Token) |
| `all` | - `token` (JWT, Cognito Access Token) <br>- `accessToken` (JWT, Cognito Access Token) <br>- `idToken` (JWT, Cognito ID Token) |

## Signing on the Amplify side

You have to add the `withSessionData` parameter to the request, for example:

```js
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
      tokenType: 'id',
      withSessionData: true
    }),
  },
};
```

In response, you will receive an additional `session` json:

```json
{
 "data": {
  "token": "eyJraWQiO...",
  "idToken": "eyJraWQiO...",
  "session": {
   "accessKey": "A...",
   "secretAccessKey": "yX...",
   "sessionToken": "IQoJ..."
  }
 }
}
```

Use `data.session.sessionToken` in the `X-Amz-Security-Token` header, `data.session.accessKey` and `data.session.secretAccessKey` to sign the request.

## Signing on the Container side

You have to call a `/sign` endpoint with params, for example:

```js
const postRequest = {
  url: "http://localhost:10000/sign",
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
      params: {
        method: "GET",
        url: "https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/dev/workshops/RptKtbsn9pPSKF4opXcu"
      },
      serviceInfo: {
        region: "us-east-1",
        service: "execute-api"
      }
    }),
  },
};
```

You have to add collection variables or environments `AWS_SERVICE_NAME` and `AWS_SERVICE_REGION` and a pre-request script to your PostMan:

```js
const authConfig = JSON.parse(pm.environment.get("COGNITO_AUTH_CONFIG"));
const username = pm.environment.get("COGNITO_AUTH_USER");
const password = pm.environment.get("COGNITO_AUTH_PASSWORD");
const serviceName = pm.collectionVariables.get("AWS_SERVICE_NAME");
const awsRegion = pm.collectionVariables.get("AWS_SERVICE_REGION");

function strReplacer(keys, str){
    return Object.keys(keys).reduce(
      (acc, key) =>
        acc.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), `${keys[key]}`),
      str,
    );
}

const requestUrl = strReplacer(pm.environment.toObject() ?? {}, pm.request.url.toString());
const requestBody = pm.request.body ? strReplacer(pm.environment.toObject() ?? {}, pm.request.body.toString()) : null;
const requestMethod = pm.request.method;
const requestHeaders = pm.request.headers ? pm.request.headers.toObject() : {};

for(const key of Object.keys(requestHeaders)){
    requestHeaders[key] = strReplacer(pm.environment.toObject(), requestHeaders[key]);
}

const postRequest = {
  url: 'http://localhost:10000/sign',
  method: 'POST',
  header: {
    'Content-Type': 'application/json',
  },
  body: {
    mode: 'raw',
    raw: JSON.stringify({
        username,
        password,
        authConfig,
        params: {
            url: requestUrl,
            method: requestMethod,
            body: requestBody,
            headers: requestHeaders
        },
        serviceInfo: {
            service: serviceName,
            region: awsRegion
        }
    })
  }
};

pm.sendRequest(postRequest, (error, response)=> {
    if(error){ 
        console.log(error); 
        return;
    }
    const { signedRequest } = response.json().data;
    // remove a default authorization header
    pm.request.auth.use("noauth");
    // assign signed headers include authorization
    Object.entries(signedRequest.headers).forEach(([key, name])=>{
        pm.request.headers.upsert({
            key,
            value: name
        });
    });
    pm.request.body.update(signedRequest.body);
});
```

For more information, see Swagger UI [http://localhost:10000](http://localhost:10000)
