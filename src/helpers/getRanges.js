// @flow
import type {CharacterMetaList, StyleRange, EntityRange} from '../modelFromElement';

type Ranges = {
  inlineStyleRanges: Array<StyleRange>;
  entityRanges: Array<EntityRange>;
};

function getRanges(characterMeta: CharacterMetaList): Ranges {
  let inlineStyleRanges = [];
  let entityRanges = [];
  // TODO
  return {
    inlineStyleRanges,
    entityRanges,
  };
}

export default getRanges;
