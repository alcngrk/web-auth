const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const fs = require('fs');



//-----------------------------POSSIBLE RESPONSES------------------------------
const OK = 200;
const CREATED = 201;
const SEE_OTHER = 303;
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const NOT_FOUND = 404;
const SERVER_ERROR = 500;
const NO_CONTENT = 204;
//-----------------------------POSSIBLE RESPONSES------------------------------

let authTimeout = 0;
let sslDir = '';


//input       :takes the port number, mode, timeout duration, and the directory
//input(cont) :of the key files.
//output      :doesn't have input, basically an infinite loop.
//side effects:manages the db used by model.
function serve(port, model, timeout, dir)
{
  try
  {
    let keyInsert = 'empty';
    let certInsert = 'empty';
    if(dir === '.')
    {
      keyInsert = fs.readFileSync('key.pem');
      certInsert = fs.readFileSync('cert.pem');
    }
    else
    {
      keyInsert = fs.readFileSync(dir + '/key.pem');
      certInsert = fs.readFileSync(dir + '/cert.pem');
    }
    authTimeout = timeout;
    sslDir = dir;
    const app = express();
    app.locals.model = model;
    app.locals.port = port;
    setupRoutes(app);
    https.createServer({
      key: keyInsert,
      cert: certInsert,
    }, app).listen(port, function(){
      console.log("listening on port ", port);
    });
  } catch (e)
  {
    console.error(e);
    console.log("Terminating program.");
    process.exit(1);
  }
}

//input       :takes the express' app as an input.
//output      :has no direct output.
//side effects:acts as a middleware function. shares side effects with
//side effects:every user, server, and model function.
function setupRoutes(app)
{
  app.use('/users/:id', bodyParser.json());
  app.put('/users/:id', newUser(app)); //yeni
  app.put('/users/:id/auth', authorizeUser(app));
  app.get('/users/:id', getUser(app));
}

//input       :takes the request object as an input.
//output      :returns the request URL.
//side effects:no side effects.
function requestUrl(req)
{
  const port = req.app.locals.port;
  return `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
}

module.exports = {
  serve: serve
}

//input       :takes the app object as an input.
//output      :functions only direct outputs can be the errors caused by the
//output(cont):called functions, or the end to the request/response cycle.
//output(cont):possible responses = {BAD_REQUEST, CREATED, SEE_OTHER, SERVER_ERROR, UNAUTHORIZED}
//side effects:shares side effects with newUser, and terminateSession.
function newUser(app) {
  return function(request, response) {
    const user = request.body;
    const id = request.params.id;
    const pw = request.query.pw;

    if(typeof user === 'undefined' || typeof id === 'undefined' || typeof pw === 'undefined')
    {
      response.sendStatus(BAD_REQUEST);
    }
    else
    {
      //---
      request.app.locals.model.users.getUserNoReject(id).
      then(function(results)
      {
        if(results.id === undefined)
        {
          request.app.locals.model.users.newUser({ id: id,  pw: pw}, user).
          then(function(token)
          {
            let resp = {};
            resp.authToken = token;
            resp.status = "CREATED";
            let url = requestUrl(request);          //remove query from url.
            url = url.substr(0,url.indexOf('?'));   //remove query from url.

            response.append('Location', url + '/');

            response.status(CREATED).send(resp);
          }).
          catch((err) =>
          {
            console.error(err);
            response.sendStatus(SERVER_ERROR);
          });
        }
        else
		    {
          try
          {
            let resp = {};
            resp.sessionId = results.sessionId;
            resp.status = "EXISTS";
            resp.info = "user " + request.params.id + " already exists."

            let url = requestUrl(request);          //remove query from url.
            url = url.substr(0,url.indexOf('?'));   //remove query from url.

            response.append('Location', url + '/');
            response.status(SEE_OTHER).send(resp);
          }
          catch(err)
          {
            console.error(err);
            response.sendStatus(SERVER_ERROR);
          }
        }
      });
    }//---
  };
}

//input       :takes the app object as parameter.
//output      :functions only direct outputs can be the errors caused by the
//output(cont):called functions, or the end to the request/response cycle.
//output(cont):possible responses = {NOT_FOUND, OK, SERVER_ERROR, UNAUTHORIZED}.
function authorizeUser(app)
{
  return function(request, response)
  {
    try
    {
      const id = request.params.id;
      if(request.body.pw === undefined || request.body.pw === 'undefined')
      {
        let resp = {};
        resp.status = "ERROR_UNAUTHORIZED";
        resp.info = "users/" + id + "/auth requires a valid 'pw' password query parameter.";
        response.status(UNAUTHORIZED).send(resp);
      }
      else
      {
        const pw = request.body.pw;
        request.app.locals.model.users.getUserNoReject(id)
          .then(function(foundUser)
          {
            if(Object.keys(foundUser).length === 0)
            {
              let resp = {};
              resp.status = "ERROR_NOT_FOUND";
              resp.info = "User with ID '" + id + "' does not exist.";
              response.status(NOT_FOUND).send(resp);
            }
            else
            {
              request.app.locals.model.users.authorizeUser(id, pw)
              .then(function(foundUser)
              {
                let resp = {};
                resp.status = "OK";
                resp.authToken = foundUser.authToken;
                response.status(OK).send(resp);
              }).catch(function(err)
              {
                console.error(err);
                let resp = {};
                resp.status = "ERROR_UNAUTHORIZED";
                resp.info = "users/" + id + "/auth requires a valid 'pw' password query parameter.";
                response.status(UNAUTHORIZED).send(resp);
              });
            }
          });
      }
    } catch (e)
    {
      console.error(e);
      response.sendStatus(SERVER_ERROR);
    }
  }
}


function getUser(app)
{
  return function(request, response)
  {
    try
    {
      const id = request.params.id;

      //------------------------------------------------------------------------
      let token = request.headers.authorization;
      if(typeof token === 'undefined' || token.indexOf('Bearer ') === -1)
      {
        let resp = {};
        resp.status = "ERROR_UNAUTHORIZED";
        resp.info = "users/" + id + "/ requires a bearer authorization header.";
        response.status(UNAUTHORIZED).send(resp);
      }
      token = token.substr(token.indexOf(' ') + 1, token.length);
      //------------------------------------------------------------------------
      //Clear token of the word 'Bearer '

      request.app.locals.model.users.getUserNoReject(id)
        .then(function(foundUser)
        {
          if(Object.keys(foundUser).length === 0)
          {
            let resp = {};
            resp.status = "ERROR_NOT_FOUND";
            resp.info = "user '" + id + "' not found.";
            response.status(NOT_FOUND).send(resp);
          }
          else
          {
            if( ((Date.now() - foundUser.sessionTime)/1000 > authTimeout) ||
                            typeof foundUser.sessionTime === 'undefined')
            {
              let resp = {};
              resp.status = "ERROR_UNAUTHORIZED"
              if(typeof foundUser.seshId === 'undefined')
                resp.info = "Session of user '" + request.params.id + "' has timed out.";
              else
                resp.info = "session " + String(foundUser.seshId) + " timed out.";
              request.app.locals.model.users.terminateSession(foundUser);
              response.status(UNAUTHORIZED).send(resp);
            }
            else
            {
              request.app.locals.model.users.authorizeUser(id, null, token)
              .then(function(foundUser)
              {
                let resp = Object.assign({}, foundUser);
                delete resp._id; delete resp.id; delete resp.authToken;
                delete resp.pw; delete resp.seshId; delete resp.sessionTime;

                resp.status = "OK";
                response.status(OK).send(resp);
              }).catch(function(err)
              {
                console.error(err);
                let resp = {};
                resp.status = "ERROR_UNAUTHORIZED";
                resp.info = "invalid token for '/" + id + "'.";
                response.status(UNAUTHORIZED).send(resp);
              });
            }
          }
      });
    } catch (e)
    {
      console.log(e);
      response.sendStatus(SERVER_ERROR);
    }
  }
}
