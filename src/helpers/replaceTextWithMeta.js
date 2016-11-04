// @flow
import repeat from './repeat';

import type {CharacterMeta} from '../modelFromElement';

type TextFragment = {
  text: string;
  characterMeta: Array<CharacterMeta>;
};

export default function replaceTextWithMeta(
  subject: TextFragment,
  searchText: string,
  replaceText: string,
): TextFragment {
  let {text, characterMeta} = subject;
  let searchTextLength = searchText.length;
  let replaceTextLength = replaceText.length;
  let resultTextParts: Array<string> = [];
  // Get empty set of same kind as characterMeta.
  let resultCharMeta = characterMeta.slice(0, 0);
  let lastEndIndex = 0;
  let index = text.indexOf(searchText);
  while (index !== -1) {
    resultTextParts.push(
      text.slice(lastEndIndex, index) + replaceText,
    );
    resultCharMeta = resultCharMeta.concat(
      characterMeta.slice(lastEndIndex, index),
      // Use the metadata of the first char we are replacing.
      repeat(characterMeta[index], replaceTextLength),
    );
    lastEndIndex = index + searchTextLength;
    index = text.indexOf(searchText, lastEndIndex);
  }
  resultTextParts.push(
    text.slice(lastEndIndex),
  );
  resultCharMeta = resultCharMeta.concat(
    characterMeta.slice(lastEndIndex),
  );
  return {text: resultTextParts.join(''), characterMeta: resultCharMeta};
}
