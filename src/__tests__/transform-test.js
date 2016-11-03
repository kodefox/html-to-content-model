// @flow
const {describe, it} = global;

import expect from 'expect';
import {fromHTML} from '../transform';

describe('transform', () => {

  it('should parse a simple block', () => {
    let html = `<p>Hello <strong>world</strong></p>`;
    expect(fromHTML(html)).toEqual({
      blocks: [
        {
          type: 'unstyled',
          entityNodes: [
            {
              entity: null,
              styleNodes: [
                {
                  text: 'Hello ',
                  styles: null,
                },
                {
                  text: 'world',
                  styles: ['BOLD'],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('should parse an entity', () => {
    let html = `Hello <a href="/">world</a>`;
    expect(fromHTML(html)).toEqual({
      entityMap: {
        ['0']: {
          type: 'LINK',
          data: {
            url: '/',
          },
        },
      },
      blocks: [
        {
          type: 'unstyled',
          entityNodes: [
            {
              entity: null,
              styleNodes: [
                {
                  text: 'Hello ',
                  styles: null,
                },
              ],
            },
            {
              entity: '0',
              styleNodes: [
                {
                  text: 'world',
                  styles: null,
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('should parse an entity with styles', () => {
    let html = `<b>Hello <a href="/">wo<i>rld</a>`;
    expect(fromHTML(html)).toEqual({
      entityMap: {
        ['0']: {
          type: 'LINK',
          data: {
            url: '/',
          },
        },
      },
      blocks: [
        {
          type: 'unstyled',
          entityNodes: [
            {
              entity: null,
              styleNodes: [
                {
                  text: 'Hello ',
                  styles: ['BOLD'],
                },
              ],
            },
            {
              entity: '0',
              styleNodes: [
                {
                  text: 'wo',
                  styles: ['BOLD'],
                },
                {
                  text: 'rld',
                  styles: ['BOLD', 'ITALIC'],
                },
              ],
            },
          ],
        },
      ],
    });
  });

});
