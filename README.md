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
