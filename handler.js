"use strict";
require("dotenv").config({ path: "./variables.env" });
require("./patch.js");

const connectToDatabase = require("./db");
const Employer = require("./models/Employer");
const Employee = require("./models/Employee");
const Job = require("./models/Job");
const Conversation = require("./models/Conversation");
const Message = require("./models/Message");
const WebSocketConnection = require("./models/WebSocketConnection");
const AWS = require("aws-sdk");

const axios = require("axios");

String.prototype.toObjectId = () => {
  const ObjectId = require("mongoose").Types.ObjectId;
  return new ObjectId(this.toString());
};

module.exports.addConversation = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  connectToDatabase().then(() => {
    Conversation.create(JSON.parse(event.body))
      .then((res) => {
        callback(null, { statusCode: 200, body: JSON.stringify(res) });
      })
      .catch((err) => callback(new Error(err)));
  });
};

module.exports.getConversationMessages = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const body = JSON.parse(event.body);

  connectToDatabase().then(() => {
    Message.find({ id: body.conversationId.toObjectId })
      .then((res) => {
        callback(null, {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify(res),
        });
      })
      .catch((err) => {
        console.log(err);
        callback(new Error(err));
      });
  });
};

module.exports.addMessage = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  connectToDatabase().then(() => {
    Message.create(JSON.parse(event.body))
      .then((res) => {
        callback(null, { statusCode: 200, body: JSON.stringify(res) });
      })
      .catch((err) => callback(new Error(err)));
  });
};

module.exports.addCognitoUserToMongoDb = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  let newUser = {
    email: event.request.userAttributes.email,
    phoneNumber: event.request.userAttributes.phone_number,
    firstName: event.request.userAttributes.name,
    lastName: event.request.userAttributes.family_name,
    accountType: event.request.userAttributes["custom:custom:accountType"],
    companyName: event.request.userAttributes["custom:custom:companyName"],
  };

  // TODO fix error handling
  // TODO change trigger to post authentication
  if (newUser.accountType === "employer") {
    connectToDatabase().then(() => {
      Employer.create(newUser)
        .then((res) => {
          callback(null, { statusCode: 200, body: JSON.stringify(res) });
        })
        .catch((err) => callback(new Error(err)));
    });
  } else if (newUser.accountType === "employee") {
    connectToDatabase().then(() => {
      Employee.create(newUser)
        .then((res) => {
          callback(null, { statusCode: 200, body: JSON.stringify(res) });
        })
        .catch((err) => callback(new Error(err)));
    });
  }
};

module.exports.addEmployer = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  connectToDatabase().then(() => {
    Employer.create(JSON.parse(event.body))
      .then((res) => {
        callback(null, { statusCode: 200, body: JSON.stringify(res) });
      })
      .catch((err) => callback(new Error(err)));
  });
};

module.exports.addEmployee = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  connectToDatabase().then(() => {
    Employee.create(JSON.parse(event.body))
      .then((res) => {
        callback(null, { statusCode: 200, body: JSON.stringify(res) });
      })
      .catch((err) => callback(new Error(err)));
  });
};

// TODO must take in how many jobs have already been created, then
// determine from that what color should be added to the job
module.exports.addJob = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  var body = JSON.parse(event.body);
  var uriEncodedAddress = encodeURIComponent(body.address);

  axios
    .get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${uriEncodedAddress}&key=AIzaSyDoUt-NQKYX-8sZU87ISTxNIg7DQijLZ7A`
    )
    .then((response) => {
      body.geoLocation = {
        type: "Point",
        coordinates: [
          response.data.results[0].geometry.location.lng,
          response.data.results[0].geometry.location.lat,
        ],
      };
    })
    .then(() => {
      connectToDatabase().then(() => {
        Job.create(body)
          .then((res) => {
            callback(null, {
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
              },
              body: JSON.stringify(res),
            });
          })
          .catch((err) => callback(new Error(err)));
      });
    });
};

module.exports.getJobs = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  var body = JSON.parse(event.body);

  connectToDatabase().then(() => {
    Job.find({
      geoLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [body.lng, body.lat],
          },
          $maxDistance: body.distance,
          $minDistance: 1,
        },
      },
    })
      .then((res) => {
        callback(null, {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
          },
          body: JSON.stringify(res),
        });
      })
      .catch((err) => {
        console.log(err);
        callback(new Error(err));
      });
  });
};

module.exports.wsConnectHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  connectToDatabase().then(() => {
    Employee.update(
      {
        id: event.queryStringParameters.conversationId.toObjectId,
        "participants.email": event.queryStringParameters.email,
      },
      {
        $set: {
          "participants.$.connectionId": event.requestContext.connectionId,
        },
      }
    )
      .then((res) => {
        callback(null, { statusCode: 200, body: JSON.stringify(res) });
      })
      .catch((err) => callback(new Error(err)));
  });

  // connectToDatabase().then(() => {
  //   Conversation.update(
  //     {
  //       id: event.queryStringParameters.conversationId.toObjectId,
  //       "participants.email": event.queryStringParameters.email,
  //     },
  //     {
  //       $set: {
  //         "participants.$.connectionId": event.requestContext.connectionId,
  //       },
  //     }
  //   )
  //     .then((res) => {
  //       callback(null, { statusCode: 200, body: JSON.stringify(res) });
  //     })
  //     .catch((err) => callback(new Error(err)));
  // });
};

module.exports.wsDisconnectHandler = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const body = JSON.parse(event.body);

  connectToDatabase().then(() => {
    WebSocketConnection.find({ connectionId: body.connectionId })
      .deleteOne()
      .then((res) => {
        callback(null, { statusCode: 200, body: JSON.stringify(res) });
      })
      .catch((err) => callback(new Error(err)));
  });
};
// module.exports.webSocketDefaultHandler = (event, context, callback) => {};

module.exports.webSocketOnMessageHandler = (event, context, callback) => {
  let send = undefined;
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });
  send = async (connectionId, data) => {
    await apigwManagementApi
      .postToConnection({ ConnectionId: connectionId, Data: `Echo: ${data}` })
      .promise();
  };
  let message = JSON.parse(event.body).message;
  connectToDatabase().then(() => {
    WebSocketConnection.find()
      .then((data) => {
        console.log(data);
        data.forEach((connection) => {
          send(connection.connectionId, message);
        });
      })
      .then(() => {
        callback(null, { statusCode: 200 });
      })
      .catch((err) => callback(new Error(err)));
  });
};

module.exports.wsSendMessage = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log(event);

  let send = undefined;
  const body = JSON.parse(event.body);
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: "2018-11-29",
    endpoint:
      event.requestContext.domainName + "/" + event.requestContext.stage,
  });
  send = async (connectionId, data) => {
    await apigwManagementApi
      .postToConnection({ ConnectionId: connectionId, Data: `Echo: ${data}` })
      .promise();
    callback(null, { statusCode: 200 });
  };

  send(body.connectionId, body.message);
};

module.exports.getEmployee = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const body = JSON.parse(event.body);

  connectToDatabase().then(() => {
    Employee.find({ email: body.email })
      .then((res) => {
        callback(null, {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify(res),
        });
      })
      .catch((err) => callback(new Error(err)));
  });
};

module.exports.getConversation = (event, context, callback) => {
  context.callbackWaitsForEmptyEventLoop = false;

  const body = JSON.parse(event.body);

  connectToDatabase().then(() => {
    Conversation.find({ id: body.conversationId.toObjectId })
      .then((res) => {
        callback(null, {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify(res),
        });
      })
      .catch((err) => callback(new Error(err)));
  });
};

// module.exports.webSocketFooHandler = (event, context, callback) => {};
