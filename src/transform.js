// @flow
import {convertToRaw} from 'draft-js';
import {stateFromHTML} from 'draft-js-import-html';
import getEntityNodes from './getEntityNodes';
import parseHTML from './parseHTML';

import type {EntityNode} from './getEntityNodes';

export type StyleRange = {
  offset: number;
  length: number;
  style: string;
};

export type EntityRange = {
  offset: number;
  length: number;
  key: number;
};

type RawEntity = {
  type: string;
  mutability: string;
  data: {[key: string]: mixed};
};

type Entity = {
  type: string;
  data: {[key: string]: mixed};
};

type RawBlock = {
  text: string;
  type: string;
  depth: number;
  inlineStyleRanges: Array<StyleRange>;
  entityRanges: Array<EntityRange>;
  data: {[key: string]: mixed};
};

type Block = {
  type: string;
  entityNodes: Array<EntityNode>;
  depth?: number;
  data?: {[key: string]: mixed};
};

type Output = {
  entityMap?: {[key: string]: Entity};
  blocks: Array<Block>;
};

type Options = {};

const DEFAULT_OPTIONS = {};

export function normalizeEntity(entity: RawEntity): Entity {
  let {type, data} = entity;
  return {type, data};
}

export function normalizeBlock(block: RawBlock): Block {
  let {text, type, depth, inlineStyleRanges, entityRanges, data} = block;
  let result: Block = {
    type,
    entityNodes: getEntityNodes(text, entityRanges, inlineStyleRanges),
  };
  if (depth !== 0) {
    result.depth = depth;
  }
  if (!isEmptyObject(data)) {
    result.data = data;
  }
  return result;
}

function isEmptyObject(object: {[key: string]: any}) {
  return Object.keys(object).length === 0;
}

export function fromHTML(html: string, options: Options = DEFAULT_OPTIONS): Output { // eslint-disable-line no-unused-vars
  let {entityMap, blocks} = convertToRaw(
    stateFromHTML(html, {parser: parseHTML})
  );
  let normalizedEntityMap;
  let entityMapKeys = Object.keys(entityMap);
  if (entityMapKeys.length !== 0) {
    normalizedEntityMap = {};
    for (let key of entityMapKeys) {
      normalizedEntityMap[key] = normalizeEntity(entityMap[key]);
    }
  }
  let normalizedBlocks = blocks.map(normalizeBlock);
  return normalizedEntityMap ? {
    entityMap: normalizedEntityMap,
    blocks: normalizedBlocks,
  } : {
    blocks: normalizedBlocks,
  };
}
