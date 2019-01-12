const yaml = require('js-yaml');
const fs = require('fs');

try {
  let doc = yaml.safeLoad(fs.readFileSync('./testFile.yml', 'utf8'));
  console.log(doc);
} catch (e) {
  console.log(e);
}
