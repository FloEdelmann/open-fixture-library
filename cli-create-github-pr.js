const GitHubApi = require('github');

const repository = 'ofl-test'; // 'open-fixture-library';

let userToken = process.env.GITHUB_USER_TOKEN;
if (userToken === undefined) {
  console.info('environment variable GITHUB_USER_TOKEN not set, trying to read it from .env file...');

  const env = require('fs').readFileSync(require('path').join(__dirname, '.env'), 'utf8');

  let match;
  if (match = /^GITHUB_USER_TOKEN=(.*?)$/m.exec(env)) {
    userToken = match[1];
  }
  else {
    console.error('.env file does not contain GITHUB_USER_TOKEN variable');
    process.exit(1);
  }
}

const github = new GitHubApi({
  debug: false,
  protocol: "https",
  host: "api.github.com",
  headers: {
    'user-agent': 'Open Fixture Library'
  },
  followRedirects: false,
  timeout: 5000
});

let branchName;
let out;
let warnings;
let changedFiles;
let newRegister;

module.exports = function createPullRequest(additions) {
  out = additions;

  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
  branchName = 'branch' + timestamp;

  changedFiles = [];
  warnings = [];
  newRegister = {
    filesystem: {},
    manufacturers: {},
    categories: {}
  };
  let pullRequestUrl;

  github.authenticate({
    type: "token",
    token: userToken
  });


  console.log('get latest commit hash ...');
  return github.gitdata.getReference({
    owner: 'FloEdelmann',
    repo: repository,
    ref: 'heads/master'
  })
  .then(result => {
    const latestCommitHash = result.data.object.sha;
    console.log(latestCommitHash);

    console.log(`create new branch '${branchName}' ...`);
    return github.gitdata.createReference({
      owner: 'FloEdelmann',
      repo: repository,
      ref: 'refs/heads/' + branchName,
      sha: latestCommitHash
    });
  })
  .then(() => {
    console.log('done');

    if (Object.keys(out.manufacturers).length == 0) {
      return Promise.resolve();
    }

    return addOrUpdateFile('fixtures/manufacturers.json', 'manufacturers.json', oldFileContent => {
      if (oldFileContent == null) {
        return prettyStringify(out.manufacturers);
      }
      out.manufacturers = Object.assign({}, JSON.parse(oldFileContent), out.manufacturers);
      return prettyStringify(out.manufacturers);
    }, branchName, out, warnings, changedFiles, newRegister);
  })
  .then(() => {
    let chain = Promise.resolve();

    for (const fixtureKey in out.fixtures) {
      const [manKey, fixKey] = fixtureKey.split('/');

      newRegister.filesystem[fixtureKey] = {
        name: out.fixtures[fixtureKey].name,
        manufacturerName: out.manufacturers[manKey].name
      };

      if (!(manKey in newRegister.manufacturers)) {
        newRegister.manufacturers[manKey] = [];
      }
      newRegister.manufacturers[manKey].push(fixKey);

      for (const cat of out.fixtures[fixtureKey].categories) {
        if (!(cat in newRegister.categories)) {
          newRegister.categories[cat] = [];
        }
        newRegister.categories[cat].push(fixKey);
      }

      chain = chain.then(() => addOrUpdateFile(`fixtures/${fixtureKey}.json`, `fixture '${fixtureKey}'`, oldFileContent => {
        return prettyStringify(out.fixtures[fixtureKey]);
      }, branchName, out, warnings, changedFiles, newRegister));
    }

    return chain;
  })
  .then(() => {
    return addOrUpdateFile('fixtures/register.json', 'register.json', oldFileContent => {
      if (oldFileContent == null) {
        return prettyStringify(newRegister);
      }
      return prettyStringify(Object.assign({}, JSON.parse(oldFileContent), newRegister));
    }, branchName, out, warnings, changedFiles, newRegister);
  })
  .then(() => {
    console.log('create pull request ...');

    const addedFixtures = changedFiles.filter(line => line.startsWith('add fixture'));
    let title = `Added ${addedFixtures.length} new fixtures`;
    if (addedFixtures.length == 1) {
      title = `Added fixture '${addedFixtures[0]}'`;
    }


    let body = changedFiles.map(line => '* ' + line).join('\n');
    if (warnings.length > 0) {
      body += '\n\nWarnings:\n' + warnings.join('\n');
    }

    return github.pullRequests.create({
      owner: 'FloEdelmann',
      repo: repository,
      title: title,
      body: body,
      head: branchName,
      base: 'master'
    });
  })
  .then(result => {
    console.log('done');
    pullRequestUrl = result.data.url;

    console.log('add labels to pull request ...');
    return github.issues.addLabels({
      owner: 'FloEdelmann',
      repo: repository,
      number: result.data.number,
      labels: ['new-fixture', 'via-editor']
    });
  })
  .then(() => {
    console.log('done');
    console.log('View the pull request at ' + pullRequestUrl);
  })
  .catch(error => {
    console.error('Error: ' + error.message);
  });
};


function addOrUpdateFile(filename, context, newContentFunction) {
  console.log(`does ${context} exist?`);

  return github.repos.getContent({
    owner: 'FloEdelmann',
    repo: repository,
    path: filename
  })
  .then(result => {
    console.log('yes -> update it ...');

    const oldFileContent = Buffer.from(result.data.content, result.data.encoding).toString('utf8');
    const newFileContent = newContentFunction(oldFileContent);

    if (oldFileContent == newFileContent) {
      console.log('no need to update, files are the same');
      return;
    }

    return github.repos.updateFile({
      owner: 'FloEdelmann',
      repo: repository,
      path: filename,
      message: `Update ${context} via editor`,
      content: encodeBase64(newFileContent),
      sha: result.data.sha,
      branch: branchName
    })
    .then(() => {
      console.log('done');
      changedFiles.push(`update ${context}`);
    })
    .catch(error => {
      console.error(`Error updating ${context}: ${error.message}`);
      warnings.push(`* ${context}: \`${error.message}\``);
    });
  })
  .catch(error => {
    console.log('no -> create it ...');
    return github.repos.createFile({
      owner: 'FloEdelmann',
      repo: repository,
      path: filename,
      message: `Add ${context} via editor`,
      content: encodeBase64(newContentFunction(null)),
      branch: branchName
    })
    .then(() => {
      console.log('done');
      changedFiles.push(`add ${context}`);
    })
    .catch(error => {
      console.error(`Error adding ${context}: ${error.message}`);
      warnings.push(`* ${context}: \`${error.message}\``);
    });
  });
}


function encodeBase64(string) {
  return Buffer.from(string).toString('base64');
}

function prettyStringify(obj) {
  let str = JSON.stringify(obj, null, 2);

  // make number arrays fit in one line
  str = str.replace(/^( +)"(range|dimensions|degreesMinMax)": (\[\n(?:.|\n)*?^\1\])/mg, (match, spaces, key, values) => {
    return `${spaces}"${key}": [` + JSON.parse(values).join(', ') + ']';
  });

  // make string arrays fit in one line
  str = str.replace(/^( +)"(categories|authors)": (\[\n(?:.|\n)*?^\1\])/mg, (match, spaces, key, values) => {
    return `${spaces}"${key}": [` + JSON.parse(values).map(val => `"${val}"`).join(', ') + ']';
  });

  // make multiByteChannel arrays fit in one line
  str = str.replace(/^( +)"multiByteChannels": (\[\n(?:.|\n)*?^\1\])/mg, (match, spaces, values) => {
    const channelLists = JSON.parse(values).map(channelList => {
      return spaces + '  [' + channelList.map(val => `"${val}"`).join(', ') + ']';
    });
    return `${spaces}"multiByteChannels": [\n` + channelLists.join(',\n') + `\n${spaces}]`;
  });
  return str;
}