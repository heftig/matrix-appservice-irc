"use strict";
var sdk = require("./cs-extended-sdk");
var models = require("../models");
var matrixModels = require("./models");
var q = require("q");
var MatrixUser = matrixModels.MatrixUser;

var globalClient = undefined;
var hsDomain = undefined;

var getClientAs = function(userId) {
	if (userId) {
		globalClient.userId = userId;
		sdk.userId = userId;
	}
	else {
		globalClient.userId = undefined;
		sdk.userId = undefined;
		sdk.accessToken = globalClient.credentials.accessToken;
	}
	return globalClient;
};

var mkUserId = function(localpart) {
	return "@"+localpart+":"+hsDomain;
};

module.exports.sendMessage = function(room, from, msgtype, text, doNotJoin) {
	var defer = q.defer();

	msgtype = msgtype || "m.text";
	var client = getClientAs(from.userId);
	client.sendMessage(
		room.roomId, {
			msgtype: msgtype,
			body: text
		}
	).then(function(suc) {
		console.log("sendMessage: %s", JSON.stringify(suc));
		defer.resolve(suc);
	},
	function(err) {
		if (err.errcode == "M_FORBIDDEN" && !doNotJoin) {
			// try joining the room
			client.joinRoom(room.roomId).done(function(response) {
				module.exports.sendMessage(room, from, msgtype, text, true);
			}, function(err) {
				console.error("sendMessage: Couldn't join room: %s",
					JSON.stringify(err));
				defer.reject(err);
			});
		}
		else {
			console.error("sendMessage: %s", JSON.stringify(err));
			defer.reject(err);
		}
	});
	return defer.promise;
};

module.exports.getMatrixUser = function(userLocalpart) {
	// TODO optimise this by not trying to register users which
	// have already been made
	var defer = q.defer();

	var client = getClientAs();
	client.register("m.login.application_service", {
		user: userLocalpart
	}).done(function(response) {
		defer.resolve(new MatrixUser(response.user_id));
	},
	function(err) {
		if (err.errcode == "M_USER_IN_USE") {
			// made it before
			defer.resolve(new MatrixUser(mkUserId(userLocalpart)));
		}
		else {
			console.error("getMatrixUser -> %s : %s", userLocalpart,
				JSON.stringify(err));
			defer.reject({});
		}
	});
	return defer.promise;
};

module.exports.joinRoom = function(roomId, matrixUser) {
	var client = getClientAs(matrixUser.userId);
	return client.joinRoom(roomId);
};

module.exports.setMatrixClientConfig = function(config) {
    globalClient = sdk.cs.createClient(config);
    hsDomain = config.domain;
};