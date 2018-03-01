const assert = require('assert');
const bcrypt = require ('bcrypt');



function Users(db){
  this.db = db;
  this.users = db.collection('users');
}


//input       :Gets an id as a parameter
//output      :Returns a promise which resolves to the found user with the given ID.
//output(cont):If the ID doesn't match any entry in the DB, returns an empty obj.
//side effects:No side effects.
Users.prototype.getUserNoReject = function(id, path) {
  let searchSpec = {}
  searchSpec.id = id;
  if(path !== undefined)
  {
    return path.find(searchSpec).toArray().
      then(function(users) {
        return new Promise(function(resolve, reject) {
          if (users.length === 1) {
            resolve(users[0]);
          }
          else {
            resolve({});
          }
        });
      });
  }
  else
  {
    return this.users.find(searchSpec).toArray().
      then(function(users){
        return new Promise(function(resolve, reject) {
          if (users.length === 1) {
            resolve(users[0]);
          }
          else {
            resolve({});
          }
        });
      });
  }
}

//input       :Takes in a user object. It is important that this object is the
//input(cont) :object as it is in the mongodb database and collection. It isn't
//input(cont) :only used to filter the search, but also replacement.
//output      :returns a promise which is nothing if it succeeds, or an Error
//output(cont):if it fails.
//side effects:Removes seshId and sessionTime fields from the given user in the
//side effects:mongodb database and collection.
Users.prototype.terminateSession = function(userToReplace)
{
  let sessionlessUser = userToReplace;
  delete sessionlessUser.seshId;
  delete sessionlessUser.sessionTime;
  delete sessionlessUser.authToken;

  this.users.replaceOne(sessionlessUser, userToReplace).
  then(function(result)
  {
      if (result.modifiedCount != 1)
      {
        console.error(`updated ${result.modifiedCount} users`);
      }
  });
}

//input       :takes a user object and 2 six digit numbers as parameters.
//output      :returns a promise which resolves to either the authentication token
//output(cont):or an error with the number of updated users.
//side effects:changes database entry of the given user by adding seshId,
//side effects:sessionTime, and an authToken.
Users.prototype.createSession = function(userToReplace, seshId, authToken ,path)
{
  let userWithSession = Object.assign({}, userToReplace);
  userWithSession.seshId = seshId;
  userWithSession.sessionTime = Date.now();
  return new Promise(function(resolve,reject)
  {
    create_hash(String(authToken)).then(function(hash)
    {
      userWithSession.authToken = hash;
      path.replaceOne(userToReplace, userWithSession).
      then(function(result)
      {
          if (result.modifiedCount != 1)
            reject(new Error(`updated ${result.modifiedCount} users`));
          else
            resolve(userWithSession);
      });
    });
  });
}

compare_hash = function(db_Path , u_Id, plain_Pass, a_Token)
{
  let id = u_Id;
  let path = db_Path;
  let password = plain_Pass;
  let token = a_Token;

  return new Promise(function(resolve,reject)
  {
    if(typeof token === 'undefined')
      resolve(compare_hash_to_pw(path, id, password));
    else
      resolve(compare_hash_to_token(path, id, token));
  });
}



//input       :
//output      :
//side effects:
compare_hash_to_token = function(path, id, token)
{
  let searchSpec = {};
  searchSpec.id = id;
  return new Promise(function(resolve,reject)
  {
    path.find(searchSpec).toArray().
      then(function(users){
        let foundUser = users[0];
        if (token === foundUser.authToken)
          resolve(users[0]);
        else
          reject(new Error(`Wrong token for ${id}`));
      });
    });
}
//input       :
//output      :
//side effects:
Users.prototype.t_auth = function(path, user_Id, a_Token)
{
  let userId = user_Id;
  let token = a_Token;
  return new Promise(function(resolve,reject)
  {
    compare_hash(path, userId, {}, token)
    .then(function(foundUser)
    {
      if(foundUser.seshId === undefined)
      {
        reject(new Error(`No session for ${id}`));
      }
      else
        resolve(foundUser);
    }).catch((err)=>reject(err));
  });
}

//input       :
//output      :
//side effects:
Users.prototype.authorizeUser = function(user_Id, plain_Pass, a_Token)
{
  let userId = user_Id;
  let plainPass = plain_Pass;
  let token = a_Token;
  let path = this.users;

  return new Promise(function(resolve,reject)
  {
    if(typeof token === 'undefined')
    {
      resolve(Users.prototype.pw_auth(path, userId, plainPass));
    }
    else
      resolve(Users.prototype.t_auth(path, userId, token));
  });
}


//input       :takes the user id, and the plain password of the user as parameters.
//output      :returns a promise which resolves to either the authentication token
//output(cont):or an error with the number of updated users.
//side effects:causes the side effect of createSession, has no side effect of its own.
Users.prototype.pw_auth = function(path, user_Id, plain_Pass)
{
  let userId = user_Id;
  let plainPass = plain_Pass;
  return new Promise(function(resolve,reject)
  {
    compare_hash(path, userId, plainPass)
    .then(function(foundUser)
    {
      if(foundUser.seshId === undefined)
      {
        let seshId = Math.floor(Math.random()*100000) + 1;
        let authToken = Math.floor(Math.random()*100000) + 1;
        while(seshId < 100000)
              seshId = seshId*10;
        while(authToken < 100000)
              authToken = authToken*10;
        seshId = String(seshId);
        seshId = userId + "_" + seshId;
        Users.prototype.getUserNoReject(userId, path).then(function(user)
        {
          resolve(Users.prototype.createSession(user, seshId, authToken, path));
        });
      }
      else
      {
        resolve(foundUser);
      }
    }).catch((err)=>reject(err));
  });
}


//input       :takes the db path, user id, and the plaintext password of the user
//output      :returns a promise which either resolves to the correct user,
//output(cont):or an informative error with the failed search ID.
//side effects:has no side effects. it is a helper function.
compare_hash_to_pw = function(path, id, password)
{
  let searchSpec = {};
  searchSpec.id = id;
  return new Promise(function(resolve,reject)
  {
    path.find(searchSpec).toArray().
      then(function(users){
        let foundUser = users[0];
          if (bcrypt.compareSync(password, foundUser.pw)) {
            resolve(users[0]);
          }
          else {
            reject(new Error(`Wrong password for ${id}`));
          }
      });
    });
}
//input       :takes a plaintext as parameter
//output      :returns a promise which either resolves to a hashed text created
//output      :from the given plaintext, or an error.
//side effects:has no side effects. it is a helper function.
//extra info  :change the 'salt' value with a higher number for a slower execution.
create_hash = function(plaintext)
{
  return new Promise(function(resolve, reject)
  {
    try
    {
      const pass = plaintext;
      const salt = 3    //greater salt value will result in slower execution.
      const hash = bcrypt.hashSync(pass,salt)
      resolve(hash);
    }
    catch(error)
    {
      reject(error);
    }
  });
}

//input       :takes a json object containing the userID, and another object
//input       :which is the put request's body in our case.
//output      :returns a promise which either resolves to the authToken of the
//output(cont):created user, or the errors caused by bcrypt or insertOne
//side effects:adds a new entry to the database.
//extra info  :since the function is kind of long, the real return value is marked
//extra info  :with '<---' comment.
Users.prototype.newUser = function(info, user) {
  let addUser = info;
  if(Object.keys(user).length === 0)
  {
    addUser.id = info.id;
  }
  else
  {
    addUser = Object.assign({}, user);
    addUser.id = info.id;
  }

  let seshId = Math.floor(Math.random()*100000) + 1;
  let authToken = Math.floor(Math.random()*100000) + 1;
  while(seshId < 100000)
        seshId = seshId*10;
  while(authToken < 100000)
        authToken = authToken*10;
  seshId = String(seshId);
  seshId = info.id + "_" + seshId;

  let path = this.users;

  return new Promise(function(resolve){
      create_hash(String(authToken)).then(function(hash){
      addUser.authToken = hash;
      create_hash(info.pw).then(function(hash){
          addUser.pw = hash;
          addUser.seshId = seshId;
          addUser.sessionTime = Date.now();
          resolve(new Promise(function(resolve)
          {
            resolve(path.insertOne(addUser).
              then(function() {
                  return new Promise((resolve) => resolve(addUser.authToken));//<---
              }));
          }));
        }).catch((err)=>console.error(err));
      }).catch((err)=>console.error(err))
    });
}

module.exports =
{
  Users: Users,
};
