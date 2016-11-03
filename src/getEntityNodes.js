// @flow
type EntityKey = string;

import type {EntityRange, StyleRange} from './transform';

export type EntityNode = {
  entity: ?EntityKey;
  styleNodes: Array<StyleNode>;
};

export type StyleNode = {
  text: string;
  styles: ?Array<string>;
};

// Used to temporarily separate styles in a string.
const SEP = '|';

export default function getEntityNodes(
  text: string,
  entityRanges: Array<EntityRange>,
  styleRanges: Array<StyleRange>,
): Array<EntityNode> {
  let charEntity: ?EntityKey = null;
  let prevCharEntity: ?EntityKey = null;
  let entityNodes: Array<EntityNode> = [];
  let rangeStart = 0;
  for (let i = 0; i < text.length; i++) {
    prevCharEntity = charEntity;
    charEntity = getEntityAt(entityRanges, i);
    if (i > 0 && charEntity !== prevCharEntity) {
      entityNodes.push({
        entity: prevCharEntity,
        styleNodes: getStyleNodes(
          text.slice(rangeStart, i),
          styleRanges,
          rangeStart,
        ),
      });
      rangeStart = i;
    }
  }
  entityNodes.push({
    entity: charEntity,
    styleNodes: getStyleNodes(
      text.slice(rangeStart),
      styleRanges,
      rangeStart,
    ),
  });
  return entityNodes;
}

function getStyleNodes(
  text: string,
  styleRanges: Array<StyleRange>,
  offset: number,
): Array<StyleNode> {
  let charStyles = '';
  let prevCharStyles = '';
  let styleNodes = [];
  let rangeStart = 0;
  for (let i = 0; i < text.length; i++) {
    prevCharStyles = charStyles;
    charStyles = getStylesAt(styleRanges, i + offset);
    if (i > 0 && charStyles !== prevCharStyles) {
      styleNodes.push({
        text: text.slice(rangeStart, i),
        styles: prevCharStyles ? prevCharStyles.split(SEP) : null,
      });
      rangeStart = i;
    }
  }
  styleNodes.push({
    text: text.slice(rangeStart),
    styles: charStyles ? charStyles.split(SEP) : null,
  });
  return styleNodes;
}

function getEntityAt(ranges: Array<EntityRange>, i: number): ?EntityKey {
  for (let range of ranges) {
    if (i >= range.offset && i < range.offset + range.length) {
      return String(range.key);
    }
  }
  return null;
}

function getStylesAt(ranges: Array<StyleRange>, i: number): string {
  let styleSet = [];
  for (let range of ranges) {
    if (i >= range.offset && i < range.offset + range.length) {
      styleSet.push(range.style);
    }
  }
  return styleSet.join(SEP);
}
