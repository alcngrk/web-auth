#!/usr/bin/env nodejs
const assert = require('assert');
const mongo = require('mongodb').MongoClient;
const process = require('process');
const options = require('./options');
const model = require('./model/model');
const server = require('./server/server');

const port = options.options.port;
const authTimeout = options.options.authTimeout;
const sslDir = options.options.sslDir;

const DB_URL = 'mongodb://localhost:27017/proj3';

mongo.connect(DB_URL).
  //then((db) => products.initProducts(db)).
  then(function(db) {
    console.log("* * * * * * * * * * * * * * * * * * * * * *");
    console.log("*OPTIONS:");
    console.log("*Port : ",port, "authTimeout : ",authTimeout, "sslDir : ", sslDir);
    console.log("* * * * * * * * * * * * * * * * * * * * * *");
    const model1 = new model.Model(db);
    server.serve(port, model1, authTimeout, sslDir);
    //db.close();
  }).
  catch((e) => console.error(e));
