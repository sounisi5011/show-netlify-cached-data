const fs = require('fs');
const path = require('path');
const util = require('util');

const flatCache = require('flat-cache');

const pkg = require('./package.json');

const writeFile = util.promisify(fs.writeFile);

const date = (new Date()).toISOString();
const titleText = pkg.description;

(async () => {
  let html = `<!doctype html>
<html lang=ja>
<meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<meta name=format-detection content="telephone=no,email=no,address=no">
<title>${titleText}</title>
<h1>${titleText}</h1>`;

  // @see https://www.netlify.com/docs/build-gotchas/#build-cache
  // @see https://github.com/netlify/build-image/blob/xenial/run-build-functions.sh#L11
  // @see https://github.com/netlify/build-image/blob/trusty/run-build-functions.sh#L11
  const cacheList = [
    flatCache.load('cache1'),
    flatCache.load('cache2', 'cache'),
    process.env.NETLIFY_BUILD_BASE ? flatCache.load('cache2', path.join(process.env.NETLIFY_BUILD_BASE, 'cache')) : null,
  ];

  for (const cache of cacheList) {
    if (!cache) continue;

    html += `<h2>${cache._pathToFile}</h2><pre>${JSON.stringify(cache.all(), null, 2)}</pre>`;

    cache.setKey('date', date);
    cache.setKey(
      'env',
      // @see https://www.netlify.com/docs/continuous-deployment/#environment-variables
      ['BRANCH', 'CONTEXT', 'DEPLOY_ID', 'URL', 'DEPLOY_PRIME_URL', 'DEPLOY_URL', 'HOME', 'NETLIFY_BUILD_BASE']
        .reduce((obj, prop) => ({
          ...obj,
          [prop]: (obj.hasOwnProperty(prop) ? process.env[prop] : null),
        }), {})
    );

    cache.save();
  }

  await writeFile('./dist/index.html', html);
})();
