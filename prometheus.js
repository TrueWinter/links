const express = require('express');
const app = express();

function start(db, config) {
	app.get('/metrics', function(req, res) {
		db('links').select('shortid', 'url', 'clicks').then(function(data) {
			res.write('# HELP twlinks_link_total Contains the number of clicks each short URL has had\n');
			res.write('# TYPE twlinks_link_total counter\n');

			for (var i = 0; i < data.length; i++) {
				res.write(`twlinks_link_total{shortid="${data[i].shortid}"} ${data[i].clicks}\n`);
			}

			res.end();
		}).catch(function(e) {
			res.status(500).end(`Error querying database: ${e}`);
			throw new Error(`Error querying database: ${e}`);
		});
	});

	app.listen(config.prometheus.port, function() {
		console.warn('Prometheus support is still in beta');
		console.log(`Prometheus exporter listening on port ${config.prometheus.port}`);
	});
}

module.exports.start = start;