const fs = require('fs');
const path = require('path');
const util = require('util');

const flatCache = require('flat-cache');
const hostedGitInfo = require('hosted-git-info');
const makeDir = require('make-dir');
const rimraf = require('rimraf');

const pkg = require('./package.json');

const writeFile = util.promisify(fs.writeFile);
const rimrafAsync = util.promisify(rimraf);

function stringifyJSON(value) {
  const origJsonText = JSON.stringify(value);
  let randKey;
  do {
    randKey = Math.random().toString(36).substring(2);
  } while (origJsonText.includes(randKey));

  const replaceMap = new Map();
  const jsonText = JSON.stringify(value, (jsonKey, jsonValue) => {
    if (
      typeof jsonValue === 'string'
      && /^https?:\/\/[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?:[/?#]|$)/.test(jsonValue)
    ) {
      const replaceKey = `__${replaceMap.size}__${randKey}__`;
      replaceMap.set(replaceKey, jsonValue);
      return replaceKey;
    }
    return jsonValue;
  }, 2);
  return jsonText.replace(new RegExp(`__\\d+__${randKey}__`, 'g'), replaceKey => {
    const jsonValue = replaceMap.get(replaceKey);
    return `<a href="${jsonValue}" target="_blank">${jsonValue}</a>`;
  });
}

const date = (new Date()).toISOString();
const titleText = pkg.description;
const repoURL = process.env.REPOSITORY_URL || (
  hostedGitInfo.fromUrl(
    typeof pkg.repository === 'string'
    ? pkg.repository
    : pkg.repository.url
  )
  .browse()
);

(async () => {
  // @see https://docs.netlify.com/configure-builds/environment-variables/#build-metadata
  // @see https://docs.netlify.com/configure-builds/environment-variables/#git-metadata
  // @see https://docs.netlify.com/configure-builds/environment-variables/#deploy-urls-and-metadata
  const env = ['BRANCH', 'COMMIT_REF', 'CONTEXT', 'DEPLOY_ID', 'URL', 'DEPLOY_PRIME_URL', 'DEPLOY_URL', 'HOME', 'NETLIFY_BUILD_BASE']
    .reduce((obj, prop) => ({
      ...obj,
      [prop]: (process.env.hasOwnProperty(prop) ? process.env[prop] : null),
    }), {});
  let html = `<!doctype html>
<html lang=ja>
<meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<meta name=format-detection content="telephone=no,email=no,address=no">
<title>${titleText}</title>
<h1>${titleText}</h1><pre>${stringifyJSON({ date, env })}</pre>`;

  // @see https://docs.netlify.com/configure-builds/manage-dependencies/#dependency-cache
  // @see https://github.com/netlify/build-image/blob/3dc02886caa0ae907764cdad9295a17b7c486c95/run-build-functions.sh#L11
  // @see https://github.com/netlify/build-image/blob/450c24b893036c2813a0b0d0a2a05bcdd81935a4/run-build-functions.sh#L11
  const cacheList = [
    flatCache.load('cache1'),
    flatCache.load('cache2', 'cache'),
    process.env.NETLIFY_BUILD_BASE ? flatCache.load('cache3', path.join(process.env.NETLIFY_BUILD_BASE, 'cache')) : null,
  ];

  for (const cache of cacheList) {
    if (!cache) continue;

    html += `<h2>${cache._pathToFile}</h2><pre>${stringifyJSON(cache.all())}</pre>`;

    cache.setKey('date', date);
    cache.setKey('env', env);

    cache.save();
  }

  html += `<h2>Repository</h2><a href="${repoURL}">${repoURL}</a>`;

  await makeDir('./dist');
  await rimrafAsync('./dist/*');
  await writeFile('./dist/index.html', html);
})();
