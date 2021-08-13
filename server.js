var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var crypto = require('crypto');
var path = require('path');
var ejs = require('ejs');

var app = express();

var config = require('./config.js');

function generateRandomness(length) {
	return require('crypto').randomBytes(length / 2).toString('hex');
}

app.use(bodyParser.urlencoded({
	extended: true
}));

app.use(bodyParser.json());

app.set('trust proxy', config.expressProxy);

app.use(session({
	secret: config.sessionSecret,
	resave: false,
	saveUninitialized: false
}));

app.set('view engine', 'ejs');

function authMiddleware(req, res, next) {

	if (req.session && req.session.loggedIn) {
		return next();
	}

	res.redirect('/login');
}

app.use('/admin', authMiddleware);
app.use('/admin/*', authMiddleware);

app.get('/login', function(req, res) {
	if (req.session && req.session.loggedIn) {
		return res.redirect('/admin');
	}

	res.render('login', { error: null, success: null });
});

var users = config.users;

app.post('/login', function(req, res) {
	if (!req.body.password) {
		return res.status(400).end('Password is required');
	}

	if (config.password === req.body.password) {
		req.session.loggedIn = true;
		req.session.csrf = generateRandomness(32);
		res.redirect('/admin');
	} else {
		res.render('login', { error: 'Invalid password', success: null });
	}
});

app.get('/logout', function(req, res) {
	if (!(req.session && req.session.loggedIn)) {
		return res.redirect('/login');
	}

	req.session.destroy(function(err) {
		if (err) {
			throw new Error(err);
		}
		res.redirect(`/login`);
	});
});

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

app.locals.db = knex;
app.locals.config = config;

if (config.customLogic) {
	require(path.join(__dirname, config.customLogic))(app);
}

app.get('/admin/new', function(req, res) {
	res.render('new', { error: null, success: null, csrf: req.session.csrf });
});

app.post('/admin/new', function (req, res) {
	if (req.body.csrf !== req.session.csrf) {
		return res.render('new', { error: 'Invalid security token', success: null, csrf: req.session.csrf });
	}

	if (!req.body.url) {
		return res.render('new', { error: 'URL required', success: null, csrf: req.session.csrf });
	}

	var regex = new RegExp('^(http[s]?:\\/\\/(www\\.)?|ftp:\\/\\/(www\\.)?|www\\.){1}([0-9A-Za-z-\\.@:%_\+~#=]+)+((\\.[a-zA-Z]{2,3})+)(/(.)*)?(\\?(.)*)?'); // eslint-disable-line no-useless-escape

	if (!regex.test(req.body.url)) {
		return res.render('new', { error: 'Not a valid URL', success: null, csrf: req.session.csrf });
	}

	var urlSafe = new RegExp('^[a-zA-Z0-9_.-]+$');

	if (req.body.shortid) {
		if (!urlSafe.test(req.body.shortid)) {
			return res.render('new', { error: 'You can use alpha-numeric characters and the following special characters: _.-', success: null, csrf: req.session.csrf });
		}
	}

	if (req.body.shortid === 'admin') {
		return res.render('new', { error: 'That\'s an internal link', success: null, csrf: req.session.csrf });
	}

	function randomValueHex () {
		var length = config.length;
		return crypto.randomBytes(Math.ceil(length / 2))
			.toString('hex') // convert to hexadecimal format
			.slice(0, length);	 // return required number of characters
	}

	var random = randomValueHex();

	knex('links').select('shortid').where({
		shortid: req.body.shortid ? req.body.shortid : random
	}).then(function(data) {
		if (data.length !== 0) {
			if (req.body.shortid) {
				return res.render('new', { error: 'Short ID must be unique', success: null, csrf: req.session.csrf });
			}
			return res.render('new', { error: 'Failed to generate unique short ID', success: null, csrf: req.session.csrf });
		}

		knex('links').insert({
			shortid: req.body.shortid ? req.body.shortid : random,
			url: req.body.url,
			clicks: 0
		}).then(function() {
			return res.render('new', { error: null, success: `${req.body.url} shortened to https://${config.domain}/${req.body.shortid ? req.body.shortid : random}`, csrf: req.session.csrf });
		}).catch(function(e) {
			res.render('new', { error: 'Unable to insert short URL into databse', success: null, csrf: req.session.csrf });
			throw new Error(`Unable to insert short URL into databse: ${e}`);
		});
	});
});

app.get('/admin/edit/:id', function(req, res) {
	knex('links').select('shortid', 'url').where({
		shortid: req.params.id
	}).then(function(data) {
		if (data.length === 0) {
			return res.status(400).end('ID not found in database');
		}

		res.render('edit', { data: data[0], error: null, success: null, csrf: req.session.csrf });
	}).catch(function(e) {
		res.status(500).end(`Error querying database: ${e}`);
		throw new Error(`Error querying database: ${e}`);
	});
});

app.post('/admin/edit/:id', function (req, res) {
	if (req.body.csrf !== req.session.csrf) {
		return res.status(400).end('Invalid security token');
	}

	knex('links').select('shortid', 'url').where({
		shortid: req.params.id
	}).then(function(data) {
		if (data.length === 0) {
			return res.status(400).end('ID not found in database');
		}

		var regex = new RegExp('^(http[s]?:\\/\\/(www\\.)?|ftp:\\/\\/(www\\.)?|www\\.){1}([0-9A-Za-z-\\.@:%_\+~#=]+)+((\\.[a-zA-Z]{2,3})+)(/(.)*)?(\\?(.)*)?'); // eslint-disable-line no-useless-escape

		if (!regex.test(req.body.url)) {
			return res.render('new', { error: 'Not a valid URL', success: null });
		}

		knex('links').update({
			url: req.body.url
		}).where({
			shortid: req.params.id
		}).then(function() {
			res.redirect('/admin');
		}).catch(function(e) {
			res.status(500).end(`Error updating database: ${e}`);
			throw new Error(`Error updating database: ${e}`);
		});
	});
});

app.post('/admin/delete/:id', function (req, res) {
	if (req.body.csrf !== req.session.csrf) {
		return res.status(400).end('Invalid security token');
	}

	knex('links').select('shortid', 'url').where({
		shortid: req.params.id
	}).then(function(data) {
		if (data.length === 0) {
			return res.status(400).end('ID not found in database');
		}

		knex('links').where({
			shortid: req.params.id
		}).delete().then(function() {
			res.redirect('/admin');
		}).catch(function(e) {
			res.status(500).end(`Error updating database: ${e}`);
			throw new Error(`Error updating database: ${e}`);
		});
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

app.get('/admin', function(req, res) {
	knex('links').select('shortid', 'url', 'clicks').then(function(data) {
		res.render('links', { error: null, success: null, data: data, csrf: req.session.csrf });
	}).catch(function(e) {
		res.status(500).end(`Error querying database: ${e}`);
		throw new Error(`Error querying database: ${e}`);
	});
});

app.get('/:id', function (req, res) {
	if (req.params.id === 'favicon.ico' || req.params.id === 'robots.txt') return res.status(404).end();
	//console.log(req.params.id);
	var _id = req.params.id.endsWith('/') ? req.params.id.replace('/', '') : req.params.id;
	knex('links').select('shortid', 'url', 'clicks').where({
		shortid: _id
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

app.get('/api/links', function(req, res) {
	if (!req.get('password')) {
		return res.status(403).json({ success: false, message: 'No password provided' });
	}

	if (req.get('password') !== config.password) {
		return res.status(401).json({ success: false, message: 'Password incorrect' });
	}

	knex('links').select('shortid', 'url').then(function(data) {
		return res.json(data);
	}).catch(function(e) {
		res.status(500).json({ success: false, message: `Error querying database: ${e}` });
		throw new Error(`Error querying database: ${e}`);
	});
});

app.get('/api/links/:id', function(req, res) {
	if (!req.get('password')) {
		return res.status(403).json({ success: false, message: 'No password provided' });
	}

	if (req.get('password') !== config.password) {
		return res.status(401).json({ success: false, message: 'Password incorrect' });
	}

	knex('links').select('*').where({
		shortid: req.params.id
	}).then(function(data) {
		if (data.length === 0) {
			return res.status(404).json({ success: false, message: 'ID not found in database' });
		}

		return res.json(data[0]);
	}).catch(function(e) {
		res.status(500).json({ success: false, message: `Error querying database: ${e}` });
		throw new Error(`Error querying database: ${e}`);
	});
});

app.post('/api/links/add', function(req, res) {
	if (!req.get('password')) {
		return res.status(403).json({ success: false, message: 'No password provided' });
	}

	if (req.get('password') !== config.password) {
		return res.status(401).json({ success: false, message: 'Password incorrect' });
	}

	if (!req.body.url) {
		return res.status(400).json({ success: false, error: 'URL required' });
	}

	var regex = new RegExp('^(http[s]?:\\/\\/(www\\.)?|ftp:\\/\\/(www\\.)?|www\\.){1}([0-9A-Za-z-\\.@:%_\+~#=]+)+((\\.[a-zA-Z]{2,3})+)(/(.)*)?(\\?(.)*)?'); // eslint-disable-line no-useless-escape

	if (!regex.test(req.body.url)) {
		return res.status(400).json({ success: false, message: 'Not a valid URL' });
	}

	function randomValueHex () {
		var length = config.length;
		return crypto.randomBytes(Math.ceil(length / 2))
			.toString('hex') // convert to hexadecimal format
			.slice(0, length);	 // return required number of characters
	}

	var random = randomValueHex();

	knex('links').select('shortid').where({
		shortid: req.body.shortid ? req.body.shortid : random
	}).then(function(data) {
		if (data.length !== 0) {
			if (req.body.shortid) {
				return res.status(500).end('Short ID is not unique');
			}
			return res.status(500).end('Failed to generate unique short ID');
		}

		knex('links').insert({
			shortid: req.body.shortid ? req.body.shortid : random,
			url: req.body.url,
			clicks: 0
		}).then(function() {
			res.json({ success: true, longURL: req.body.url, shortid: req.body.shortid ? req.body.shortid : random });
		}).catch(function(e) {
			res.status(500).json({ success: false, message: `Unable to insert short URL into databse: ${e}` });
			throw new Error(`Unable to insert short URL into databse: ${e}`);
		});
	});
});

app.post('/api/links/:id/incrementClicks', function(req, res) {
	if (!req.get('password')) {
		return res.status(403).json({ success: false, message: 'No password provided' });
	}

	if (req.get('password') !== config.password) {
		return res.status(401).json({ success: false, message: 'Password incorrect' });
	}

	knex('links').select('shortid', 'clicks').where({
		shortid: req.params.id
	}).then(function(data) {
		if (data.length === 0) {
			return res.status(404).json({ success: false, message: 'ID not found in database' });
		}

		knex('links').update({
			clicks: data[0].clicks + 1
		}).where({
			shortid: req.params.id
		}).then(function() {
			res.json({ success: true });
		}).catch(function(e) {
			res.status(500).json({ success: false, message: `Failed to update click count: ${e}` });
			throw new Error(`Failed to update click count: ${e}`);
		});
	}).catch(function(e) {
		res.status(500).json({ success: false, message: `Unable to insert short URL into databse: ${e}` });
		throw new Error(`Unable to insert short URL into databse: ${e}`);
	});
});

var listener = app.listen(config.port, function () {
	console.log(`App is listening on port ${listener.address().port}`);
});
