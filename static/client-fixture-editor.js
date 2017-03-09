'use strict';

// Toggle between existing and new manufacturer
var manShortname = document.querySelector(".manufacturer-shortname");
var addMan = manShortname.querySelector(".add-manufacturer");

var newMan = document.querySelector(".new-manufacturer");
var useExistingMan = newMan.querySelector(".use-existing-manufacturer");

addMan.addEventListener("click", function() {
  manShortname.hidden = true;
  newMan.hidden = false;
});

useExistingMan.addEventListener("click", function() {
  manShortname.hidden = false;
  newMan.hidden = true;
});


// Clone physical template into fixture 
var templatePhysical = document.querySelector('.template-physical');
var physical = document.querySelector('.physical');
physical.appendChild(document.importNode(templatePhysical.content, true));


// Generate json file(s)
var saveButton = document.querySelector('.save-fixture');
saveButton.addEventListener("click", function() {
  var man;
  var manData = {};
  var fixData = {};

  if (!manShortname.hidden) {
    man = readSingle(".manufacturer-shortname select");
  }
  else {
    man = readSingle(".new-manufacturer-shortname input");
    readSingle(".new-manufacturer-name input",    manData, "name");
    readSingle(".new-manufacturer-website input", manData, "website");
    readSingle(".new-manufacturer-comment input", manData, "comment");
  }

  readSingle('.fixture-name input',      fixData, "name");
  readSingle('.fixture-shortname input', fixData, "shortname");
  readMultiple('.categories select',     fixData, "categories");
  readSingle('.comment textarea',        fixData, "comment");
  readSingle('.manual input',            fixData, "manualURL");

  console.log("\n### Generated data:");
  console.log(man);
  console.log(JSON.stringify(manData, null, 2));
  console.log(JSON.stringify(fixData, null, 2));
});


function readSingle(selector, data, property) {
  var input = document.querySelector(selector);
  if (!input.validity.valid) {
      console.error(selector + ' is invalid');
  }
  else if (input.value) {
    if (data && property) {
      data[property] = input.value;
    }
    else {
      return input.value;
    }
  }
}

function readMultiple(selector, data, property) {
  var select = document.querySelector(selector);

  if (!select.validity.valid) {
    console.error(selector + ' is invalid');
  }
  else {
    if (select.selectedOptions.length > 0) {
      var output = [];
      for (var option of select.selectedOptions) {
        output.push(option.value);
      }

      if (data && property) {
        data[property] = output;
      }
      else {
        return output;
      }
    }
  }
}