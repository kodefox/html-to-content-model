// @flow

import replaceTextWithMeta from './helpers/replaceTextWithMeta';
import repeat from './helpers/repeat';
import getRanges from './helpers/getRanges';
import {
  BLOCK_TYPE,
  ENTITY_TYPE,
  INLINE_STYLE,
  INLINE_ELEMENTS,
  SPECIAL_ELEMENTS,
  SELF_CLOSING_ELEMENTS,
} from './Constants';
import {NODE_TYPE_ELEMENT, NODE_TYPE_TEXT} from 'synthetic-dom';

import type {
  Node as SyntheticNode,
  ElementNode as SyntheticElement,
} from 'synthetic-dom';

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

export type RawEntity = {
  key: number;
  type: string;
  mutability: string;
  data: {[key: string]: mixed};
};

export type RawBlock = {
  text: string;
  type: string;
  depth: number;
  inlineStyleRanges: Array<StyleRange>;
  entityRanges: Array<EntityRange>;
  data: {[key: string]: mixed};
};

export type ContentModel = {
  entityMap: {[key: number]: RawEntity};
  blocks: Array<RawBlock>;
};

type DOMNode = SyntheticNode | Node;
type DOMElement = SyntheticElement | Element;

type Style = string;
type StyleSet = Set<Style>;

export type CharacterMeta = {
  style: StyleSet,
  entity: ?RawEntity,
};

export type CharacterMetaList = Array<CharacterMeta>;

type TextFragment = {
  text: string;
  characterMeta: CharacterMetaList;
};

// A ParsedBlock has two purposes:
//   1) to keep data about the block (textFragments, type)
//   2) to act as some context for storing parser state as we parse its contents
type ParsedBlock = {
  tagName: string;
  textFragments: Array<TextFragment>;
  type: string;
  // A stack in which the last item represents the styles that will apply
  // to any text node descendants.
  styleStack: Array<StyleSet>;
  entityStack: Array<?RawEntity>;
  depth: number;
};

type ElementStyles = {[tagName: string]: Style};

type Options = {
  elementStyles?: ElementStyles;
  blockTypes?: {[key: string]: string};
};

const NO_STYLE = new Set();
const NO_ENTITY = null;

const EMPTY_BLOCK_DATA = {};

const EMPTY_BLOCK: RawBlock = {
  text: '',
  type: BLOCK_TYPE.UNSTYLED,
  inlineStyleRanges: [],
  entityRanges: [],
  depth: 0,
  data: EMPTY_BLOCK_DATA,
};

const LINE_BREAKS = /(\r\n|\r|\n)/g;
// We use `\r` because that character is always stripped from source (normalized
// to `\n`), so it's safe to assume it will only appear in the text content when
// we put it there as a placeholder.
const SOFT_BREAK_PLACEHOLDER = '\r';
const ZERO_WIDTH_SPACE = '\u200B';
const DATA_ATTRIBUTE = /^data-([a-z0-9-]+)$/;

// Map element attributes to entity data.
const ELEM_ATTR_MAP = {
  a: {href: 'url', rel: 'rel', target: 'target', title: 'title'},
  img: {src: 'src', alt: 'alt'},
};

const getEntityData = (tagName: string, element: DOMElement) => {
  const data = {};
  if (ELEM_ATTR_MAP.hasOwnProperty(tagName)) {
    const attrMap = ELEM_ATTR_MAP[tagName];
    for (let i = 0; i < element.attributes.length; i++) {
      const {name, value} = element.attributes[i];
      if (value != null) {
        if (attrMap.hasOwnProperty(name)) {
          const newName = attrMap[name];
          data[newName] = value;
        } else if (DATA_ATTRIBUTE.test(name)) {
          data[name] = value;
        }
      }
    }
  }
  return data;
};

// Functions to convert elements to entities.
const ELEM_TO_ENTITY = {
  a(tagName: string, element: DOMElement): ?RawEntity {
    let data = getEntityData(tagName, element);
    // Don't add `<a>` elements with no href.
    if (data.url != null) {
      return {
        key: getKey(),
        type: ENTITY_TYPE.LINK,
        mutability: 'MUTABLE',
        data,
      };
    }
  },
  img(tagName: string, element: DOMElement): ?RawEntity {
    let data = getEntityData(tagName, element);
    // Don't add `<img>` elements with no src.
    if (data.src != null) {
      return {
        key: getKey(),
        type: ENTITY_TYPE.IMAGE,
        mutability: 'MUTABLE',
        data,
      };
    }
  },
};

class BlockGenerator {
  blockStack: Array<ParsedBlock>;
  blockList: Array<ParsedBlock>;
  entityMap: {[key: number]: RawEntity};
  depth: number;
  options: Options;

  constructor(options: Options = {}) {
    this.options = options;
    // This represents the hierarchy as we traverse nested elements; for
    // example [body, ul, li] where we must know li's parent type (ul or ol).
    this.blockStack = [];
    // This is a linear list of blocks that will form the output; for example
    // [p, li, li, blockquote].
    this.blockList = [];
    this.depth = 0;
  }

  process(element: DOMElement): ContentModel {
    this.processBlockElement(element);
    let contentBlocks: Array<RawBlock> = [];
    this.blockList.forEach((block) => {
      let {text, characterMeta} = concatFragments(block.textFragments);
      let includeEmptyBlock = false;
      // If the block contains only a soft break then don't discard the block,
      // but discard the soft break.
      if (text === SOFT_BREAK_PLACEHOLDER) {
        includeEmptyBlock = true;
        text = '';
      }
      if (block.tagName === 'pre') {
        ({text, characterMeta} = trimLeadingNewline(text, characterMeta));
      } else {
        ({text, characterMeta} = collapseWhiteSpace(text, characterMeta));
      }
      // Previously we were using a placeholder for soft breaks. Now that we
      // have collapsed whitespace we can change it back to normal line breaks.
      text = text.split(SOFT_BREAK_PLACEHOLDER).join('\n');
      // Discard empty blocks (unless otherwise specified).
      if (text.length || includeEmptyBlock) {
        let {inlineStyleRanges, entityRanges} = getRanges(characterMeta);
        contentBlocks.push({
          text,
          type: block.type,
          inlineStyleRanges,
          entityRanges,
          depth: block.depth,
          data: EMPTY_BLOCK_DATA,
        });
      }
    });
    if (!contentBlocks.length) {
      contentBlocks = [EMPTY_BLOCK];
    }
    return {
      entityMap: this.entityMap,
      blocks: contentBlocks,
    };
  }

  getBlockTypeFromTagName(tagName: string): string {
    let {blockTypes} = this.options;
    if (blockTypes && blockTypes[tagName]) {
      return blockTypes[tagName];
    }

    switch (tagName) {
      case 'li': {
        let parent = this.blockStack.slice(-1)[0];
        return (parent.tagName === 'ol') ?
          BLOCK_TYPE.ORDERED_LIST_ITEM :
          BLOCK_TYPE.UNORDERED_LIST_ITEM;
      }
      case 'blockquote': {
        return BLOCK_TYPE.BLOCKQUOTE;
      }
      case 'h1': {
        return BLOCK_TYPE.HEADER_ONE;
      }
      case 'h2': {
        return BLOCK_TYPE.HEADER_TWO;
      }
      case 'h3': {
        return BLOCK_TYPE.HEADER_THREE;
      }
      case 'h4': {
        return BLOCK_TYPE.HEADER_FOUR;
      }
      case 'h5': {
        return BLOCK_TYPE.HEADER_FIVE;
      }
      case 'h6': {
        return BLOCK_TYPE.HEADER_SIX;
      }
      case 'pre': {
        return BLOCK_TYPE.CODE;
      }
      case 'figure': {
        return BLOCK_TYPE.ATOMIC;
      }
      default: {
        return BLOCK_TYPE.UNSTYLED;
      }
    }
  }

  processBlockElement(element: DOMElement) {
    if (!element) {
      return;
    }
    let tagName = element.nodeName.toLowerCase();
    let type = this.getBlockTypeFromTagName(tagName);
    let hasDepth = canHaveDepth(type);
    let allowRender = !SPECIAL_ELEMENTS.hasOwnProperty(tagName);
    let block: ParsedBlock = {
      tagName: tagName,
      textFragments: [],
      type: type,
      styleStack: [NO_STYLE],
      entityStack: [NO_ENTITY],
      depth: hasDepth ? this.depth : 0,
    };
    if (allowRender) {
      this.blockList.push(block);
      if (hasDepth) {
        this.depth += 1;
      }
    }
    this.blockStack.push(block);
    if (element.childNodes != null) {
      Array.from(element.childNodes).forEach(this.processNode, this);
    }
    this.blockStack.pop();
    if (allowRender && hasDepth) {
      this.depth -= 1;
    }
  }

  processInlineElement(element: DOMElement) {
    let tagName = element.nodeName.toLowerCase();
    if (tagName === 'br') {
      this.processText(SOFT_BREAK_PLACEHOLDER);
      return;
    }
    let block = this.blockStack.slice(-1)[0];
    let styleSet = block.styleStack.slice(-1)[0];
    let entity = block.entityStack.slice(-1)[0];
    styleSet = addStyleFromTagName(styleSet, tagName, this.options.elementStyles);
    if (ELEM_TO_ENTITY.hasOwnProperty(tagName)) {
      let newEntity = ELEM_TO_ENTITY[tagName](tagName, element);
      // If the to-entity function returns nothing, use the existing entity.
      if (newEntity) {
        entity = newEntity;
        this.entityMap[entity.key] = entity;
      }
    }
    block.styleStack.push(styleSet);
    block.entityStack.push(entity);
    if (element.childNodes != null) {
      Array.from(element.childNodes).forEach(this.processNode, this);
    }
    if (SELF_CLOSING_ELEMENTS.hasOwnProperty(tagName)) {
      this.processText('\u00A0');
    }
    block.entityStack.pop();
    block.styleStack.pop();
  }

  processTextNode(node: DOMNode) {
    let text = node.nodeValue;
    // This is important because we will use \r as a placeholder for a soft break.
    text = text.replace(LINE_BREAKS, '\n');
    // Replace zero-width space (we use it as a placeholder in markdown) with a
    // soft break.
    // TODO: The import-markdown package should correctly turn breaks into <br>
    // elements so we don't need to include this hack.
    text = text.split(ZERO_WIDTH_SPACE).join(SOFT_BREAK_PLACEHOLDER);
    this.processText(text);
  }

  processText(text: string) {
    let block = this.blockStack.slice(-1)[0];
    let styleSet = block.styleStack.slice(-1)[0];
    let entity = block.entityStack.slice(-1)[0];
    let charMetadata = {
      style: styleSet,
      entity: entity,
    };
    block.textFragments.push({
      text: text,
      characterMeta: repeat(charMetadata, text.length),
    });
  }

  processNode(node: DOMNode) {
    if (node.nodeType === NODE_TYPE_ELEMENT) {
      let element: DOMElement = node;
      let tagName = element.nodeName.toLowerCase();
      if (INLINE_ELEMENTS.hasOwnProperty(tagName)) {
        this.processInlineElement(element);
      } else {
        this.processBlockElement(element);
      }
    } else if (node.nodeType === NODE_TYPE_TEXT) {
      this.processTextNode(node);
    }
  }
}

function trimLeadingNewline(text: string, characterMeta: CharacterMetaList): TextFragment {
  if (text.charAt(0) === '\n') {
    text = text.slice(1);
    characterMeta = characterMeta.slice(1);
  }
  return {text, characterMeta};
}

function trimLeadingSpace(text: string, characterMeta: CharacterMetaList): TextFragment {
  while (text.charAt(0) === ' ') {
    text = text.slice(1);
    characterMeta = characterMeta.slice(1);
  }
  return {text, characterMeta};
}

function trimTrailingSpace(text: string, characterMeta: CharacterMetaList): TextFragment {
  while (text.slice(-1) === ' ') {
    text = text.slice(0, -1);
    characterMeta = characterMeta.slice(0, -1);
  }
  return {text, characterMeta};
}

function collapseWhiteSpace(text: string, characterMeta: CharacterMetaList): TextFragment {
  text = text.replace(/[ \t\n]/g, ' ');
  ({text, characterMeta} = trimLeadingSpace(text, characterMeta));
  ({text, characterMeta} = trimTrailingSpace(text, characterMeta));
  let i = text.length;
  while (i--) {
    if (text.charAt(i) === ' ' && text.charAt(i - 1) === ' ') {
      text = text.slice(0, i) + text.slice(i + 1);
      characterMeta = characterMeta.slice(0, i).concat(characterMeta.slice(i + 1));
    }
  }
  // There could still be one space on either side of a softbreak.
  ({text, characterMeta} = replaceTextWithMeta(
    {text, characterMeta},
    SOFT_BREAK_PLACEHOLDER + ' ',
    SOFT_BREAK_PLACEHOLDER,
  ));
  ({text, characterMeta} = replaceTextWithMeta(
    {text, characterMeta},
    ' ' + SOFT_BREAK_PLACEHOLDER,
    SOFT_BREAK_PLACEHOLDER,
  ));
  return {text, characterMeta};
}

function canHaveDepth(blockType: string): boolean {
  switch (blockType) {
    case BLOCK_TYPE.UNORDERED_LIST_ITEM:
    case BLOCK_TYPE.ORDERED_LIST_ITEM: {
      return true;
    }
    default: {
      return false;
    }
  }
}

function concatFragments(fragments: Array<TextFragment>): TextFragment {
  let text = '';
  let characterMeta: CharacterMetaList = [];
  fragments.forEach((textFragment: TextFragment) => {
    text = text + textFragment.text;
    characterMeta = characterMeta.concat(textFragment.characterMeta);
  });
  return {text, characterMeta};
}


function addStyleFromTagName(styleSet: StyleSet, tagName: string, elementStyles?: ElementStyles): StyleSet {
  switch (tagName) {
    case 'b':
    case 'strong': {
      return styleSet.add(INLINE_STYLE.BOLD);
    }
    case 'i':
    case 'em': {
      return styleSet.add(INLINE_STYLE.ITALIC);
    }
    case 'ins': {
      return styleSet.add(INLINE_STYLE.UNDERLINE);
    }
    case 'code': {
      return styleSet.add(INLINE_STYLE.CODE);
    }
    case 'del': {
      return styleSet.add(INLINE_STYLE.STRIKETHROUGH);
    }
    default: {
      // Allow custom styles to be provided.
      if (elementStyles && elementStyles[tagName]) {
        return styleSet.add(elementStyles[tagName]);
      }

      return styleSet;
    }
  }
}

function getKey(): number {
  return Math.floor(Math.random() * Math.pow(2, 53));
}

function modelFromElement(element: DOMElement, options?: Options): ContentModel {
  let generator = new BlockGenerator(options);
  return generator.process(element);
}

export default modelFromElement;
