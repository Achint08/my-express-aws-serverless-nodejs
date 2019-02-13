// index.js

const serverless = require('serverless-http');
const bodyParser = require('body-parser')
const express = require('express')
const app = express()
const AWS = require('aws-sdk')

const USERS_TABLE = process.env.USERS_TABLE;

const IS_OFFLINE = process.env.IS_OFFLINE;
// const dynamoDb = new AWS.DynamoDB.DocumentClient();
let dynamoDb;

const kms = new AWS.KMS();

if(IS_OFFLINE === 'true') {
    dynamoDb = new AWS.DynamoDB.DocumentClient({
        region: 'localhost',
        endpoint: 'localhost:8000'
    })
    console.log(dynamoDb);
} else {
    dynamoDb = new AWS.DynamoDB.DocumentClient();
}

app.use(bodyParser.json({strict:false}));

app.post('/', function (req, res) {
  kms.decrypt({CiphertextBlob: new Buffer(process.env.password, 'base64')}, (err, data) => {
      if(err) {
          console.log(err);
          res.status(400).send("Gaya")
      }
      var password = data.Plaintext.toString('ascii')
      console.log(password)
      res.status(200).send("Hello World")
  })
})

app.get('/users/:userId', function(req,res) {
    const params = {
        TableName: USERS_TABLE,
        Key: {
            userId: req.params.userId,
        },
    }

    dynamoDb.get(params, (error, result) => {
        if(error) {
            console.log("[ERROR]:", error)
            res.status(400).json({error: 'Could not get user'});
        }
        if(result.Item) {
            const {userId, name} = result.Item;
            res.json({userId, name});
        } else {
            res.status(400).json({error: "User not found"});
        }
    });
})

app.post('/users', function(req, res) {
    const {userId, name} = req.body;
    if(typeof userId !== 'string') {
        res.status(400).json({ error: '"userId" must be a string'})
    } else if (typeof name !== 'string') {
        res.status(400).json({error: '"name" must be a string'})
    }

    const params = {
        TableName: USERS_TABLE,

        Item: {
            userId: userId,
            name: name
        }
    }
    console.log(req.body)
    dynamoDb.put(params, (error) => {
        if(error) {
            console.log(error);
            res.status(400).json({error: 'Could not create user'});
        }
        res.json({ userId, name});
    })
})

const generatePolicy = function(principalId, effect, resource) {
    const authResponse = {};
    authResponse.principalId = principalId;
    if (effect && resource) {
        const policyDocument = {};
        policyDocument.Version = '2012-10-17';
        policyDocument.Statement = [];
        const statementOne = {};
        statementOne.Action = 'execute-api:Invoke';
        statementOne.Effect = effect;
        statementOne.Resource = resource;
        policyDocument.Statement[0] = statementOne;
        authResponse.policyDocument = policyDocument;
    }
    return authResponse;
};

module.exports.auth = (event, context, callback) => {

    console.log(event);
    console.log("==================");
    console.log("Authorization: ", event.authorizationToken);
    console.log("==================");

    callback(null, generatePolicy('user', 'Allow', event.methodArn));
};

module.exports.handler = serverless(app);