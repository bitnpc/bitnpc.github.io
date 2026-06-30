/**
 * remark-mermaid — converts ` ```mermaid ` fenced code blocks to
 * `<div class="mermaid">` tags that the mermaid.js library
 * renders client-side into SVG diagrams.
 */
import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';

export function remarkMermaid() {
  return (tree: Root) => {
    visit(tree, 'code', (node: any, index: number, parent: any) => {
      if (node.lang === 'mermaid') {
        parent.children[index] = {
          type: 'html',
          value: `<div class="mermaid" role="img" aria-label="Diagram">${node.value}</div>`,
        };
      }
    });
  };
}
