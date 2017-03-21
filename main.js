#!/usr/bin/node

const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const sassMiddleware = require('node-sass-middleware');
const browserify = require('browserify-middleware');

// setup port
app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'), () => {
  console.log('Node app is running on port', app.get('port'));
});

// compile sass
app.use(sassMiddleware({
  src: path.join(__dirname, 'views', 'stylesheets'),
  dest: path.join(__dirname, 'static'),
  outputStyle: 'compressed'
}));

// client scripts
app.use('/js', browserify('./client'));

// static files that shall be accessible
app.use(express.static(path.join(__dirname, 'static')));

// views is directory for all template files
app.set('views', path.join(__dirname, 'views'));

// custom renderer
app.engine('js', (filePath, options, callback) => {
  const renderer = require(filePath);

  let opts = {
    manufacturers: manufacturers,
    register: register,
    plugins: plugins,
    baseDir: __dirname,
    messages: getMessages()
  };
  Object.assign(opts, options);

  callback(null, renderer(opts));
});
app.set('view engine', 'js');


// message objects to show to the user
let messages = [];

// the interesting data
let manufacturers = null;
let register = null;

// read in the JSON files to fill those data structures
fs.readFile(path.join(__dirname, 'fixtures', 'manufacturers.json'), 'utf8', (error, data) => {
  if (error) {
    addFileReadError('There was an error reading in the manufacturer data.', error);
    return;
  }

  manufacturers = JSON.parse(data);
});
fs.readFile(path.join(__dirname, 'fixtures', 'register.json'), 'utf8', (error, data) => {
  if (error) {
    addFileReadError('There was an error reading in the register.', error);
    return;
  }

  register = JSON.parse(data);
});

// load available plugins
let plugins = {};
for (const filename of fs.readdirSync(path.join(__dirname, 'plugins'))) {
  plugins[path.basename(filename, '.js')] = require(path.join(__dirname, 'plugins', filename));
}


app.get('/', (request, response) => {
  response.render('pages/index');
});

app.get('/about', (request, response) => {
  response.render('pages/about');
});

app.get('/categories', (request, response) => {
  response.render('pages/categories');
});

app.get('/manufacturers', (request, response) => {
  response.render('pages/manufacturers');
});

app.get('/search', (request, response) => {
  response.render('pages/search', {
    query: request.query
  });
});

// if no other route applies
app.use((request, response, next) => {
  // first char is always a slash, last char has to be tested
  const sanitizedUrl = request.originalUrl.slice(1, (request.originalUrl.slice(-1) == '/') ? -1 : request.originalUrl.length);
  const segments = sanitizedUrl.split('/');


  if (segments.length == 1 && segments[0] in manufacturers) {
    response.render('pages/single_manufacturer', {
      man: segments[0]
    });
    return;
  }

  if (segments.length == 2 && segments[0] in manufacturers) {
    const man = segments[0];
    const fix = segments[1];

    if (register.manufacturers[man].indexOf(fix) != -1) {
      response.render('pages/single_fixture', {
        man: man,
        fix: fix
      });
      return;
    }

    const [key, pluginName] = fix.split('.');
    if (pluginName in plugins && 'export' in plugins[pluginName]) {
      const outfiles = plugins[pluginName].export([{
        manufacturerKey: man,
        fixtureKey: key
      }], {
        baseDir: __dirname,
        manufacturers: manufacturers
      });

      downloadFiles(response, outfiles, pluginName);
      return;
    }
  }

  if (segments.length == 2 && segments[0] === 'categories' && decodeURIComponent(segments[1]) in register.categories) {
    response.render('pages/single_category', {
      category: decodeURIComponent(segments[1])
    });
    return;
  }

  console.log(`page ${request.originalUrl} [${segments}] not found`);

  response.status(404).render('pages/404');
});


function downloadFiles(response, files, zipname) {
  if (files.length == 1) {
    response
      .status(201)
      .attachment(files[0].name)
      .type(files[0].mimetype)
      .send(Buffer.from(files[0].content));
    return;
  }

  // else zip all together
  const zip = new require('node-zip')();
  for (const file of files) {
    zip.file(file.name, file.content);
  }
  const data = zip.generate({
    base64: false,
    compression: 'DEFLATE'
  });

  response
    .status(201)
    .attachment('ofl_export_' + zipname + '.zip')
    .type('application/zip')
    .send(Buffer.from(data, 'binary'));
}

function getMessages() {
  if (messages.length > 0) {
    return messages;
  }

  if (manufacturers == null || register == null) {
    return [{
      type: 'info',
      text: 'We are still reading the data. Please reload the page in a few moments.'
    }];
  }

  return [];
}

function addFileReadError(text, error) {
  console.error(text, error.toString());
  messages.push({
    type: 'error',
    text: `${text}<br /><code>${error.toString()}</code>`
  });
}
