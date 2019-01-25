// ==== arguments ====
let testMode = process.argv.includes('-t') ? true : false;
// console.log('test mode ' + testMode);

// ==== imports ====
const yaml = require('js-yaml');
const fs = require('fs');


// ==== functions ====
String.prototype.replaceAtIndex = function(index, replacement) {
  // Used to replace characters at string indexes in convertName()
  return this.substr(0, index) + replacement + this.substr(index + replacement.length);
}

const loadYamlFile = function(level, names) {
  let doc;
  names.forEach((name) => {
    try {
      doc = yaml.safeLoad(fs.readFileSync(`${parentDir}/${level}/${level}-${name}.yml`, 'utf8'));
      console.log(`found document at ${parentDir}/${level}/${level}-${name}.yml`);
    } catch (e) {
      // console.log(`could not find file at ./equipmentFiles/${level}/${level}-${name}.yml`)
    }
  });
  return doc ? doc : undefined;
};

const convertName = function(childObj) {
  let names = [];
  if (typeof childObj !== 'object') {
    throw new Error('ERROR: expected an object passed to convertName()!');
  }
  let originalName = Object.keys(childObj)[0];
  let subsets = Object.keys(childObj[originalName]);
  // console.log(`convertName found name: ${originalName} and subsets: ${subsets}`);
  subsets.push(''); // Make certain the following for loop runs at least once w/o a subset
  subsets.forEach(subset => {
    [true, false].forEach((i) => { // Once for true, once for false
      let name = i ? originalName + ' ' + subset : subset + ' ' + originalName; // subset or name first, one for each iteration
      // === Below add all possible combinations that a file may have ===
      name = name.toLowerCase(); // all equipment files use lowercase
      // try finding a file with no spaces or hyphens
      let noFluff = name.replace(' ', '');
      names.push(noFluff);
      // try finding a file where all spaces are hyphens (works if there are no spaces)
      let allHyphens = name.replace(' ', '-');
      names.push(allHyphens);
      // try finding a file where the first space is a hyphen and the rest are removed
      let firstHyphen = name.replaceAtIndex(name.indexOf(' '), '-');
      names.push(firstHyphen.replace(' ', '')); // get rid of the remaining spaces
    });
  });
  uniqueNames = names.filter((item, pos) => names.indexOf(item) == pos); // Filter out repeat entries
  return uniqueNames;
}

const convertUnit = function(unit) {
  switch (unit) {
    case 'T':
      return 'TEMP'
  }
}

const makeDataLabel = function() {
  let dataLabelString = 'DL' + dataLabelStrings.equipment_group + dataLabelStrings.equipment + dataLabelStrings.component + dataLabelStrings.loop_point_type;
  dataLabelStrings.usedDLSs.push(dataLabelString);
  return dataLabelString;
}

const addDataLabels = function(parent, current, level) {
  if (current.measurement_points !== null && current.measurement_points.length !== 0) {
    current.measurement_points.forEach(mp => {
      dataLabelStrings.loop_point_type = '_' + mp.loop_point_type.toUpperCase();
      // console.log('pushing label');
      if (!dataLabels.hasOwnProperty(parent)) {
        console.log('data labels does not have parent ' + parent + ', so I am making an empty object');
        dataLabels[parent] = [];
      }
      dataLabels[parent].push({
        level,
        device: current.type + ' ' + current.subtype,
        dataLabel: makeDataLabel(),
        inputType: mp.loop_point_type,
        unit: mp.measurement_type
      });
    });
  } else {
    console.log('No measurement points for ' + level + ' ' + current.type + ' ' + current.subtype);
  }
}

const getChildString = function(level) {
  switch (level) {
    case 'equipment_group':
      return 'child_equipment';
    case 'equipment':
      return 'child_components';
    default:
      return false;
  }
}

const testValidChildren = function(current, level) {
  return current[getChildString(level)] !== undefined && Object.keys(getChildString(level)).length !== 0;
}

const recurse = (levels, levelIndex, nameCue) => {
  let level = levels[levelIndex];
  let current = loadYamlFile(level, convertName(nameCue));
  dataLabelStrings.setLabelString(current, level);
  addDataLabels(parent, current, level);
  if (testValidChildren(current, level)) {
    let children = current[getChildString(level)]
    Object.keys(children).forEach(key => {
      recurse(levels, levelIndex + 1, { [key]: children[key] });
    });
  }
}

// ==== inits ====
// parent directory for files to parse
const parentDir = './equipmentFiles';

// levels
const levels = ['equipment_group', 'equipment', 'component'];
let levelIndex = 0;

// Set up object to contain strings that will become the data labels (DL_...)
let dataLabelStrings = {
  equipment_group: '',
  equipment: '',
  component: '',
  loop_point_type: '',
  usedDLSs: [], // Array for storing the data label strings already used
  setLabelString: function(current, varToSet) {
    let append = current.subtype == 'Default' ? '' : `-${current.subtype.toUpperCase()}`;
    this[varToSet] = '_' + current.type.toUpperCase() + append;
  }
}

let dataLabels = []; // Object for storing the data labels as they are generated
let deviceStructure = {}; // Object for human reference of the parsed hierarchy

let startDir;
if (testMode) {
  startDir = process.argv[2];
} else {
  startDir = 'equipment_group';
}

let startFiles = fs.readdirSync(`${parentDir}/${startDir}/`);

// ==== execution ====

let level = levels[levelIndex];
let parent = '';
startFiles.forEach(startFile => {
  // Load file
  current = yaml.safeLoad(fs.readFileSync(`${parentDir}/${startDir}/${startFile}`, 'utf8'));
  // Set the parent for this recursive iteration
  parent = current.type + '_' + current.subtype;
  // Create the data label string for this file
  let append = current.subtype == 'Default' ? '' : `-${current.subtype.toUpperCase()}`;
  dataLabelStrings.equipment_group = '_' + current.type.toUpperCase() + append;
  // Add measurement points to the list of data labels
  addDataLabels(parent, current, level);
  recurse(levels, levelIndex + 1, current[getChildString(level)]);

});
console.log('All Done! Data labels:');
console.log(dataLabels);
