// SPDX-License-Identifier: GPL-3.0-or-later
// Pure geometry: no Shell objects, signals, timers, or global state.
export class Layout {
    constructor() {
        this.root = null;
    }

    rectangles(area, gap = 0) {
        const result = new Map();
        const visit = (node, rect) => {
            if (!node)
                return;
            if ('id' in node) {
                result.set(node.id, rect);
                return;
            }
            const horizontal = node.axis === 'horizontal';
            const length = horizontal ? rect.width : rect.height;
            const space = Math.min(gap, Math.max(0, length - 2));
            const first = Math.floor((length - space) / 2);
            const second = length - space - first;
            visit(node.a, {...rect, [horizontal ? 'width' : 'height']: first});
            visit(node.b, {
                ...rect,
                [horizontal ? 'x' : 'y']: (horizontal ? rect.x : rect.y) + first + space,
                [horizontal ? 'width' : 'height']: second,
            });
        };
        visit(this.root, area);
        return result;
    }

    insert(id, area, gap = 0, mode = 'auto') {
        if (!this.root) {
            this.root = {id};
            return;
        }
        const rects = this.rectangles(area, gap);
        if (rects.has(id))
            return;
        let largest;
        let maxArea = -1;
        for (const [key, rect] of rects) {
            if (rect.width * rect.height > maxArea) {
                largest = key;
                maxArea = rect.width * rect.height;
            }
        }
        const rect = rects.get(largest);
        const axis = mode === 'auto'
            ? (rect.width >= rect.height ? 'horizontal' : 'vertical') : mode;
        const replace = node => {
            if ('id' in node)
                return node.id === largest ? {axis, a: node, b: {id}} : node;
            return {...node, a: replace(node.a), b: replace(node.b)};
        };
        this.root = replace(this.root);
    }

    remove(id) {
        const prune = node => {
            if (!node || 'id' in node)
                return node?.id === id ? null : node;
            const a = prune(node.a);
            const b = prune(node.b);
            return a && b ? {...node, a, b} : a ?? b;
        };
        this.root = prune(this.root);
    }

    swap(first, second) {
        const visit = node => {
            if (!node)
                return;
            if ('id' in node) {
                if (node.id === first)
                    node.id = second;
                else if (node.id === second)
                    node.id = first;
            } else {
                visit(node.a);
                visit(node.b);
            }
        };
        visit(this.root);
    }
}

export function inset(area, gap) {
    const margin = Math.min(gap, Math.floor((Math.min(area.width, area.height) - 1) / 2));
    return {x: area.x + margin, y: area.y + margin,
        width: area.width - 2 * margin, height: area.height - 2 * margin};
}
