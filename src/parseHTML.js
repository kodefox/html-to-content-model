// @flow
import {SAXParser} from 'parse5';
import {
  TextNode,
  ElementNode,
  FragmentNode,
} from 'synthetic-dom';

type Attr = {name: string; value: string};
type Attrs = Array<Attr>;

export default function parseHTML(html: string): FragmentNode {
  let parser = new SAXParser();
  let rootNode = new FragmentNode();
  let nodeStack = [rootNode];
  let getCurrentNode = () => nodeStack[nodeStack.length - 1];
  parser.on('startTag', (name: string, attrs: Attrs) => {
    let newNode = new ElementNode(name, attrs);
    let currentNode = getCurrentNode();
    if (currentNode) {
      currentNode.appendChild(newNode);
    }
    nodeStack.push(newNode);
  });
  parser.on('endTag', () => {
    nodeStack.pop();
  });
  parser.on('text', (text: string) => {
    let currentNode = getCurrentNode();
    if (currentNode) {
      currentNode.appendChild(new TextNode(text));
    }
  });
  parser.write(html);
  // This is kind of hacky, but it forces the parser to flush all pending text.
  parser.write('</html>');
  parser.end();
  return new ElementNode('body', [], [rootNode]);
}
