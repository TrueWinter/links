var express = require('express');
var bodyParser = require('body-parser');
var crypto = require('crypto');
var url = require('url');
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

app.use(morgan(config.morganLogFormat));

var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(config.dbFile);

var knex = require('knex')({
	client: 'sqlite3',
	connection: {
		filename: config.dbFile
	},
	useNullAsDefault: true
});

var cTable = knex.schema.createTableIfNotExists('links', function (table) {
	table.string('id');
	table.string('url');
}).toString();

//console.log(cTable);
db.serialize(function() {
	db.run(cTable);
});

app.get('/:id', function (req, res) {
	if (req.params.id === 'favicon.ico' || req.params.id === 'robots.txt') return;
	//console.log(req.params.id);
	var selectURL = knex.select('url')
		.from('links')
		.where('id', req.params.id)
		.toString();
	//console.log(selectURL);
	db.serialize(function() {
		db.all(selectURL, function (err, rows) {
			if (err) {
				console.log(err);
			} else {
				url = rows[0];
				if (url) {
					res.redirect(url.url);
				} else {
					res.status(400).json({ success: false, error: 'ID not found in database' });
				}
			}
		});
	});
});

app.post('/new', function (req, res) {

	if (!req.body.token) {
		return res.status(403).json({ success: false, error: 'No token provided' });
	}
	if (req.body.token !== config.token) {
		return res.status(401).json({ success: false, error: 'Token incorrect' });
	}
	//console.log(req.body.url);
	if (!req.body.url) {
		return res.status(400).json({ success: false, error: 'URL required' });
	}
	var regex = new RegExp('^(http[s]?:\\/\\/(www\\.)?|ftp:\\/\\/(www\\.)?|www\\.){1}([0-9A-Za-z-\\.@:%_\+~#=]+)+((\\.[a-zA-Z]{2,3})+)(/(.)*)?(\\?(.)*)?'); // eslint-disable-line no-useless-escape

	if (!regex.test(req.body.url)) {
		return res.status(400).json({ success: false, error: 'Not a valid URL' });
	}


	function randomValueHex (length) {
		return crypto.randomBytes(Math.ceil(length / 2))
			.toString('hex') // convert to hexadecimal format
			.slice(0, length);	 // return required number of characters
	}
	var random = randomValueHex(config.length);

	function insert() {
		var q = knex('links').insert({ url: req.body.url, id: random }).toString();
		//console.log(q);
		db.serialize(function() {
			db.run(q, function (err) {
				if (err) {
					res.status(500).json({ success: false, error: 'Error in inserting values to database' });
					return console.log(err);
				}

				console.log(`Inserted ID ${random} into database`);
				res.json({ success: true, URL: req.body.url, ID: random });
			});
		});
	}

	var check = knex.select('url')
		.from('links')
		.where('id', random)
		.toString();
	//console.log(check);
	db.serialize(function() {
		db.all(check, function (err, rows) {
			if (err) {
				res.json({ success: false, error: 'Error in checking for duplicate ID' });
				console.log(err);
			} else {
				var name = rows[0];
				if (!name) {
					insert();
				}
			}
		});
	});
});

app.get('/onlinecheck', function (req, res) {
	/*
	Use this for app/uptime monitoring.
	It will return a 200 instead of other codes which may 
	result in an offline status in some monitoring programs
	*/
	res.status(200).write('OK');
});

app.get('*', function (req, res) {
	res.status(404).json({ success: false, error: '404 Not Found' });
});

var listener = app.listen(process.env.PORT, function () {
	console.log(`App is listening on port ${listener.address().port}`);
});
