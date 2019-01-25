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

const findAndLoadYaml = function(level, names) {
  let doc;
  names.forEach((name) => {
    if (name.includes('.yml')) { // Catches the first recursion level where startFile is already found by fs
      try {
        doc = yaml.safeLoad(fs.readFileSync(`${parentDir}/${level}/${name}`, 'utf8'));
      } catch (e) {
        // console.log(`could not find file at ./equipmentFiles/${level}/${level}-${name}.yml`)
      }
    } else { // All recursions below the top level, where we need to try potential options to find the file
      try {
        doc = yaml.safeLoad(fs.readFileSync(`${parentDir}/${level}/${level}-${name}.yml`, 'utf8'));
        console.log(`found document at ${parentDir}/${level}/${level}-${name}.yml`);
      } catch (e) {
        // console.log(`could not find file at ./equipmentFiles/${level}/${level}-${name}.yml`)
      }
    }
  });
  return doc ? doc : undefined;
};

const convertName = function(childObj) {
  let names = [];
  if (typeof childObj !== 'object') {
    return [ childObj ];
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
      // files use 'air_handler' instead of 'AHU'
      if (name.includes('ahu')) {
        name = name.replace('ahu', 'air_handler');
      }
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
      if (!dataLabels.hasOwnProperty(parent)) { // If we haven't created an array for the parent to hold labels, make an empty one
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
    // console.log('No measurement points for ' + level + ' ' + current.type + ' ' + current.subtype);
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
  let current = findAndLoadYaml(level, convertName(nameCue));
  if (!current) {
    console.log('Could not find file for ' + Object.keys(nameCue) + '!');
    return;
  }
  if (levelIndex == 0) { // If we're at the equipment_group level, set the parent
    parent = current.type + '_' + current.subtype;
  }
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

let parent = '';

// ==== execution ====

startFiles.forEach(startFile => {
  recurse(levels, levelIndex, startFile);
});
console.log('All Done! Data labels:');
console.log(dataLabels);
