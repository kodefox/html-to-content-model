// @flow
const {describe, it} = global;

import expect from 'expect';
import fs from 'fs';
import {join} from 'path';

import {fromHTML} from '../transform';

// This separates the test cases in `data/test-cases.txt`.
const SEP = '\n\n#';

let testCasesRaw = fs.readFileSync(
  join(__dirname, '..', '..', 'test', 'test-cases.txt'),
  'utf8',
);

let customTagTestCasesRaw = fs.readFileSync(
  join(__dirname, '..', '..', 'test', 'custom-tag-test-cases.txt'),
  'utf8',
);

let testCases = testCasesRaw.slice(1).trim().split(SEP).map((text) => {
  let lines = text.split('\n');
  let description = lines.shift().trim();
  let model = JSON.parse(lines[0]);
  let html = lines.slice(1).join('\n');
  return {description, model, html};
});

let customTagTestCases = customTagTestCasesRaw.slice(1).trim().split(SEP).map((text) => {
  let lines = text.split('\n');
  let description = lines.shift().trim();
  let model = JSON.parse(lines[0]);
  let html = lines.slice(1).join('\n');
  return {description, model, html};
});

describe('stateFromHTML', () => {
  testCases.forEach((testCase) => {
    let {description, model, html} = testCase;
    it(`should render ${description}`, () => {
      let contentModel = fromHTML(html);
      expect(contentModel).toEqual(model);
    });
  });
});

describe('custom tag', () => {
  let options = {
    customTagToEntityMap: {
      cta: 'CALL_TO_ACTION',
    },
  };
  customTagTestCases.forEach((testCase) => {
    let {description, model, html} = testCase;
    it(`should render custom tag ${description}`, () => {
      let contentModel = fromHTML(html, options);
      expect(contentModel).toEqual(model);
    });
  });
});
