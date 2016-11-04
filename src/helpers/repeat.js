// @flow

function repeat<T>(item: T, length: number): Array<T> {
  let result = new Array(length);
  for (let i = 0; i < length; i++) {
    result[i] = item;
  }
  return result;
}

export default repeat;
