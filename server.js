var express = require('express');
var bodyParser = require('body-parser');
var crypto = require('crypto');
var path = require('path');
var morgan = require('morgan');
var app = express();

try {
	var config = require('./config.js');
} catch (e) {
	var eCode = e.code ? e.code : 'NO ERROR CODE';
	console.error(`Unable to load config file. Error code: ${eCode}`);
	process.exit(1);
}

app.use(bodyParser.urlencoded({
	extended: true
}));

app.use(bodyParser.json());

app.set('trust proxy', config.expressProxy);

app.use(morgan('combined'));

var knex = require('knex')({
	client: 'sqlite3',
	connection: {
		filename: config.dbFile
	},
	useNullAsDefault: true
});

knex.schema.hasTable('links').then(function(exists) {
	if (!exists) {
		knex.schema.createTable('links', function(table) {
			table.increments('id');
			table.string('shortid');
			table.string('url');
			table.integer('clicks');
		}).then(function() {
			console.log('Table created');
		}).catch(function(e) {
			throw new Error(`Unable to create table: ${e}`);
		});
	}
}).catch(function(e) {
	throw new Error(`Unable to create table: ${e}`);
});

app.get('/new', function(req, res) {
	res.sendFile(path.join(__dirname, 'new.html'));
});

app.post('/new', function (req, res) {

	if (!req.body.password) {
		return res.status(403).end('No token provided');
	}
	if (req.body.password !== config.password) {
		return res.status(401).end('Password incorrect');
	}
	//console.log(req.body.url);
	if (!req.body.url) {
		return res.status(400).json({ success: false, error: 'URL required' });
	}

	var regex = new RegExp('^(http[s]?:\\/\\/(www\\.)?|ftp:\\/\\/(www\\.)?|www\\.){1}([0-9A-Za-z-\\.@:%_\+~#=]+)+((\\.[a-zA-Z]{2,3})+)(/(.)*)?(\\?(.)*)?'); // eslint-disable-line no-useless-escape

	if (!regex.test(req.body.url)) {
		return res.status(400).end('Not a valid URL');
	}

	function randomValueHex () {
		var length = config.length;
		return crypto.randomBytes(Math.ceil(length / 2))
			.toString('hex') // convert to hexadecimal format
			.slice(0, length);	 // return required number of characters
	}

	var random = randomValueHex();

	knex('links').select('shortid').where({
		id: req.body.shortid ? req.body.shortid : random
	}).then(function(data) {
		if (data.length !== 0) {
			if (req.body.shortid) {
				return res.status(500).end('Short ID is not unique');
			}
			return res.status(500).end('Failed to generate unique short ID');
		}
	});

	knex('links').insert({
		shortid: req.body.shortid ? req.body.shortid : random,
		url: req.body.url,
		clicks: 0
	}).then(function() {
		res.end(`${req.body.url} shortened to https://${config.domain}/${req.body.shortid ? req.body.shortid : random}`);
	}).catch(function(e) {
		res.status(500).end(`Unable to insert short URL into databse: ${e}`);
		throw new Error(`Unable to insert short URL into databse: ${e}`);
	});

});

app.get('/onlinecheck', function (req, res) {
	/*
	Use this for app/uptime monitoring.
	It will return a 200 instead of other codes which may
	result in an offline status in some monitoring programs
	*/
	res.status(200).end('OK');
});

app.get('/', function(req, res) {
	res.redirect(config.homeRedirect);
});

app.get('/stats', function(req, res) {
	res.sendFile(path.join(__dirname, 'stats.html'));
});

app.post('/stats', function(req, res) {
	if (!(req.body.password || req.body.shortid)) {
		return res.status(400).end('All fields are required');
	}

	if (req.body.password !== config.password) {
		return res.status(403).end('Incorrect password');
	}

	if (req.body.shortid !== '*') {
		knex('links').select('shortid', 'url', 'clicks').where({
			shortid: req.body.shortid
		}).then(function(data) {
			if (data.length === 0) {
				res.status(404).end('ID not found in database');
			}

			res.json(data[0]);
		}).catch(function(e) {
			res.status(500).end(`Error querying database: ${e}`);
			throw new Error(`Error querying database: ${e}`);
		});
	} else {
		knex('links').select('shortid', 'url', 'clicks').then(function(data) {
			res.json(data);
		}).catch(function(e) {
			res.status(500).end(`Error querying database: ${e}`);
			throw new Error(`Error querying database: ${e}`);
		});
	}

});

app.get('/:id', function (req, res) {
	if (req.params.id === 'favicon.ico' || req.params.id === 'robots.txt') return res.status(404).end();
	//console.log(req.params.id);
	knex('links').select('shortid', 'url', 'clicks').where({
		shortid: req.params.id
	}).then(function(data) {
		if (data.length === 0) {
			return res.status(404).end('ID not found in database');
		}

		knex('links').update({
			clicks: data[0].clicks + 1
		}).where({
			shortid: req.params.id
		}).then(function() {
			//res.end(data[0].url);
			//res.json(data[0]);
			res.redirect(data[0].url);
		}).catch(function(e) {
			res.status(500).end(`Failed to update click count: ${e}`);
			throw new Error(`Failed to update click count: ${e}`);
		});
	}).catch(function(e) {
		res.status(500).end(`Error querying database: ${e}`);
		throw new Error(`Error querying database: ${e}`);
	});
});

var listener = app.listen(config.port, function () {
	console.log(`App is listening on port ${listener.address().port}`);
});
