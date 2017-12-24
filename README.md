# NdT3Links

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/93d38fa6f2e1464ba59aa001882210b3)](https://www.codacy.com/app/NdT3Development/NdT3Links?utm_source=github.com&utm_medium=referral&utm_content=NdT3Development/NdT3Links&utm_campaign=badger)
[![Known Vulnerabilities](https://snyk.io/test/github/ndt3development/ndt3links/badge.svg)](https://snyk.io/test/github/ndt3development/ndt3links)

This is a simple URL shortener made by NdT3Development using NodeJS and Sqlite3 as the database.

## How it Works

| URL Path | Method | Description|
|    ---   |  ---   |  ---  |
| /:id     | GET    | Gets the redirect ID from the database and redirects the user to that URL                                                                                               |
| /new     | POST   | Creates a new database entry for a short URL. The request must contain a 'token' field with the correct token and a 'url' field with the URL that needs to be shortened |

## Configuration

A `config.js` file is used to configure this software. Below is an example configuration file

```js
var config = {
  length: 6,
  dbFile: './db.sqlite3',
  expressProxy: '127.0.0.1',
  morganLogFormat: 'combined',
  token: 'tokenhere'
};

module.exports = config;
```

| Name   | Description | Value Type |
|   ---  |     ---     |     ---    |
| length | The length of the generated ID | Number |
| dbFile | The path to the Sqlite3 database file | String |
| expressProxy | The express trust proxy configuration. More info at https://expressjs.com/en/guide/behind-proxies.html | See info link: https://expressjs.com/en/guide/behind-proxies.html |
| morganLogFormat | The format to use for logging. More info at https://www.npmjs.com/package/morgan#predefined-formats | String |
| token | The token used to add new short IDs | String |
