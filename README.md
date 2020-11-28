# Links

This is a simple URL shortener made by TrueWinter using NodeJS and Sqlite3 as the database.

## Configuration

A `config.js` file is used to configure this software. Below is an example configuration file

```js
var config = {
	length: 6,
	dbFile: './db.sqlite3',
	expressProxy: '127.0.0.1',
	password: 'password',
  	port: '19282',
	domain: 'short.url',
	homeRedirect: 'https://example.com'
};

module.exports = config;
```

You should use a proxy such as Nginx to proxy requests to the URL shortener's port (`19282` by default).

# Usage

## Short URL Creation

Go to `{domain}/new` and enter the long URL, an optional short ID (if left out, one will be randomly generated), and the password. You should receive a message containing the short URL.

## Stats

Go to `{domain}/stats` and enter the short ID to get stats for that URL (or `*` to get stats for all URLs), and enter the password.

## Uptime Monitoring

`{domain}/onlinecheck` returns `OK` with a `200` status code and should be used for uptime monitoring.
