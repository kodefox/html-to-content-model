// @flow
import getEntityNodes from './getEntityNodes';
import parseHTML from './parseHTML';
import modelFromElement from './modelFromElement';

import type {EntityNode} from './getEntityNodes';
import type {RawEntity, RawBlock} from './modelFromElement';

type Entity = {
  type: string;
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

type Options = {
  customTagToEntityMap?: {[tagName: string]: string};
  customInlineElements?: {[tagName: string]: boolean};
};

const DEFAULT_OPTIONS: Options = {};
const EMPTY_KEYS: Array<string> = [];

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

// eslint-disable-next-line no-unused-vars
export function fromHTML(html: string, options: Options = DEFAULT_OPTIONS): Output {
  let element = parseHTML(html);
  let {customTagToEntityMap} = options;
  let customInlineElements = {};
  if (customTagToEntityMap) {
    for (let customTag of Object.keys(customTagToEntityMap)) {
      customInlineElements[customTag] = true;
    }
  }
  let {entityMap, blocks} = modelFromElement(element, {
    customTagToEntityMap,
    customInlineElements,
  });
  let normalizedEntityMap;
  let entityMapKeys = entityMap ? Object.keys(entityMap) : EMPTY_KEYS;
  if (entityMapKeys.length !== 0) {
    normalizedEntityMap = {};
    for (let key of entityMapKeys) {
      // This is to make Flow happy.
      let numericKey = Number(key);
      normalizedEntityMap[key] = normalizeEntity(entityMap[numericKey]);
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
