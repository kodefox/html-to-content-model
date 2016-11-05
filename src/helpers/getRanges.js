// @flow
import type {CharacterMeta, StyleRange, EntityRange, RawEntity} from '../modelFromElement';

type Ranges = {
  inlineStyleRanges: Array<StyleRange>;
  entityRanges: Array<EntityRange>;
};

function isEqualEntity(oldEntity: ?RawEntity, newEntity: ?RawEntity): boolean {
  if (oldEntity == null || newEntity == null) {
    return (oldEntity == null && newEntity == null);
  }
  return (oldEntity.key === newEntity.key);
}

function getRanges(charMetaList: Array<CharacterMeta>): Ranges {
  let inlineStyleRanges = [];
  let entityRanges = [];
  let styleRangeMap = new Map();
  let prevEntity = null;
  let prevEntityStartIndex = 0;
  charMetaList.forEach((charMeta, index) => {
    let {style, entity} = charMeta;
    for (let styleName of style) {
      if (!styleRangeMap.has(styleName)) {
        styleRangeMap.set(styleName, index);
      }
    }
    for (let [styleName, startIndex] of styleRangeMap) {
      if (!style.has(styleName)) {
        inlineStyleRanges.push({
          style: styleName,
          offset: startIndex,
          length: index - startIndex,
        });
        styleRangeMap.delete(styleName);
      }
    }
    if (!isEqualEntity(prevEntity, entity)) {
      if (prevEntity != null) {
        entityRanges.push({
          key: prevEntity.key,
          offset: prevEntityStartIndex,
          length: index - prevEntityStartIndex,
        });
      }
      prevEntity = entity;
      prevEntityStartIndex = index;
    }
  });
  for (let [styleName, startIndex] of styleRangeMap) {
    inlineStyleRanges.push({
      style: styleName,
      offset: startIndex,
      length: charMetaList.length - startIndex,
    });
  }
  if (prevEntity != null) {
    entityRanges.push({
      key: prevEntity.key,
      offset: prevEntityStartIndex,
      length: charMetaList.length - prevEntityStartIndex,
    });
  }
  return {
    inlineStyleRanges,
    entityRanges,
  };
}

export default getRanges;
