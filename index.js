'use strict';
var restify, bunyan, routes, log, server, config;

restify = require('restify');
bunyan = require('bunyan');
routes = require('./routes/');
config = require('./lib/config');

log = bunyan.createLogger({
  name: 'find-keywords-in-text',
  level: process.env.LOG_LEVEL || 'info',
  stream: process.stdout,
  serializers: bunyan.stdSerializers
});

server = restify.createServer({
  name: 'find-keywords-in-text',
  log: log,
  formatters: {
    'application/json': function (req, res, body) {
      res.setHeader('Cache-Control', 'must-revalidate');

      // Does the client *explicitly* accepts application/json?
      var sendPlainText = (req.header('Accept').split(/, */).indexOf('application/json') === -1);

      // Send as plain text
      if (sendPlainText) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      }

      // Send as JSON
      if (!sendPlainText) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      return JSON.stringify(body);
    }
  }
});

server.use(restify.bodyParser({mapParams: true}));
server.use(restify.queryParser({mapParams: true}));
server.use(restify.CORS({origins: config.get('allowed-origins')}));
server.use(restify.gzipResponse());

// Default error handler. Personalize according to your needs.
server.on('uncaughtException', function (req, res, err) {
  console.log('Error!');
  console.log(err);
  res.send(500, {success: false});
});

server.on('after', restify.auditLogger({log: log}));
routes(server);

// Set the title of process for easier debugging.
process.title = server.name;

console.log('Find Keywords in Text API started on', config.get('port') || 9999, 'port!');
server.listen(config.get('port') || 9999, function () {
  log.info('%s listening at %s', server.name, server.url);
});
