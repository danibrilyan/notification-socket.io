var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');

app.set('port', (process.env.PORT || 3000));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

var pushService = (function () {
	var connections = {};
	return {
		/**
		 * Register user in connections. This method must be executed as first in whole registration process.
		 * @param userId id of user.
		 * @param connectionId id of connection.
		 */
		registerUser: function (userId, connectionId) {
			if (connections[userId] === undefined) {
				connections[userId] = {};
			}

			connections[userId][connectionId] = null;
			console.log('Registered connection ' + connectionId.substring(0, 4) + '*** for user ' + userId);
		},
		/**
		 * Register socket to communication. Must be executed after registerUser.
		 * Modify socket object and set field userId and connectionId.
		 * @param userId id of user.
		 * @param connectionId id of connection.
		 * @param socket socket.
		 * @returns {boolean} if socket was registered or not, if false then you have to do everything again.
		 */
		registerSocket: function (userId, connectionId, socket) {
			if (connections[userId] != null && connections[userId][connectionId] == null) {
				socket.userId = userId;
				socket.connectionId = connectionId;
				connections[userId][connectionId] = socket;
				console.log('Registered socket for connection ' + connectionId.substring(0, 4) + '*** and  user ' + userId);
				return true;
			} else {
				console.log('Not found empty conn for connection ' + connectionId.substring(0, 4) + '*** and  user ' + userId);
				return false;
			}
		},
		/**
		 * Remove connection.
		 * @param socket socket to remove.
		 */
		removeConnection: function (socket) {
			var userId = socket.userId;
			var connectionId = socket.connectionId;
			if (userId && connectionId && connections[userId] && connections[userId][connectionId]) {
				console.log('Removed socket for user ' + userId + ' and connection: ' + connectionId.substring(0, 4) + '***');
				delete connections[socket.connectionId];
			}
		},
		/**
		 * Send notification to user.
		 * @param userId id of user.
		 * @param message message.
		 */
		pushMessage: function (userId, message) {
			var userConnections = connections[userId];
			if (userConnections) {
				for (var connectionId in  userConnections) {
					if (userConnections.hasOwnProperty(connectionId)) {
						var socket = userConnections[connectionId];
						if (socket != null) {
							socket.emit('message', message);
						}
					}
				}
			}
		}
	}
}());

/**
 * Handle connection to socket.io.
 */
io.on('connection', function (socket) {
	/**
	 * On registered socket from client.
	 */
	socket.on('register', function (userId, connectionId) {
		pushService.registerSocket(userId, connectionId, socket);
	});

	/**
	 * On disconnected socket.
	 */
	socket.on('disconnect', function () {
		pushService.removeConnection(socket);
	});
});

/**
 * Api to register user.
 */
app.put('/api/:userId/register', function (req, res) {
	if (req.header('X-AUTH-TOKEN') != process.env['AUTH_TOKEN']) {
		res.status(401).send();
	} else {
		var userId = req.params['userId'];
		var connectionId = req.query['connectionId'];
		if (userId && connectionId) {
			pushService.registerUser(userId, connectionId);
			res.send();
		} else {
			res.status(400).send('Bad Request');
		}
	}
});

/**
 * Api to send message to user.
 */
app.post('/api/push', function (req, res) {
	if (req.header('X-AUTH-TOKEN') != process.env['AUTH_TOKEN']) {
		res.status(401).send();
	} else if (req.body.to && req.body.message) {
		pushService.pushMessage(req.body.to, req.body.message);
		res.send();
	}
	else {
		res.status(400).send('Bad Request');
	}
});

/**
 * Ping endpoint.
 */
app.get('/status/ping', function (req, res) {
	res.send('pong')
});

/**
 * Info endpoint.
 */
app.get('/status/info', function (req, res) {
	res.setHeader('Content-Type', 'application/json');
	var info = {
		'name': 'socket.io-server'
	};
	res.send(info)
});

http.listen(app.get('port'), function () {
	console.log('Node app is running on port', app.get('port'));
});