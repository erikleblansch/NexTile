// SPDX-License-Identifier: GPL-3.0-or-later
// Pure geometry: no Shell objects, signals, timers, or global state.
export class Layout {
    constructor() {
        this.root = null;
    }

    _walk(area, gap, leaf, split = () => {}) {
        const visit = (node, rect) => {
            if (!node)
                return;
            if ('id' in node) {
                leaf(node, rect);
                return;
            }
            const horizontal = node.axis === 'horizontal';
            const dimension = horizontal ? 'width' : 'height';
            const coordinate = horizontal ? 'x' : 'y';
            const space = Math.min(gap, Math.max(0, rect[dimension] - 2));
            const usable = rect[dimension] - space;
            const first = Math.max(1, Math.min(usable - 1, Math.floor(usable * (node.ratio ?? 0.5) + 1e-7)));
            split(node, rect, rect[coordinate] + first + space / 2, space);
            visit(node.a, {...rect, [dimension]: first});
            visit(node.b, {...rect, [coordinate]: rect[coordinate] + first + space,
                [dimension]: usable - first});
        };
        visit(this.root, area);
    }

    rectangles(area, gap = 0) {
        const result = new Map();
        this._walk(area, gap, (node, rect) => result.set(node.id, rect));
        return result;
    }

    dividers(area, gap = 0) {
        const result = [];
        this._walk(area, gap, () => {}, (node, rect, position, space) => {
            result.push({node, rect, position, space, axis: node.axis});
        });
        return result;
    }

    minimum(node, gap, minimum = () => ({width: 120, height: 80})) {
        if ('id' in node)
            return minimum(node.id);
        const a = this.minimum(node.a, gap, minimum);
        const b = this.minimum(node.b, gap, minimum);
        return node.axis === 'horizontal'
            ? {width: a.width + gap + b.width, height: Math.max(a.height, b.height)}
            : {width: Math.max(a.width, b.width), height: a.height + gap + b.height};
    }

    resize(node, position, area, gap = 0, minimum) {
        const divider = this.dividers(area, gap).find(item => item.node === node);
        if (!divider || !Number.isFinite(position))
            return false;
        const horizontal = node.axis === 'horizontal';
        const dimension = horizontal ? 'width' : 'height';
        const coordinate = horizontal ? 'x' : 'y';
        const available = divider.rect[dimension] - divider.space;
        const low = this.minimum(node.a, gap, minimum)[dimension];
        const high = available - this.minimum(node.b, gap, minimum)[dimension];
        if (low > high)
            return false;
        const pixels = Math.max(low, Math.min(high, Math.round(position - divider.rect[coordinate] - divider.space / 2)));
        node.ratio = pixels / available;
        return true;
    }

    insertAt(id, target, area, gap = 0, before = false) {
        const rects = this.rectangles(area, gap);
        const rect = rects.get(target);
        if (!rect || rects.has(id))
            return false;
        const axis = rect.width >= rect.height ? 'horizontal' : 'vertical';
        const replace = node => {
            if ('id' in node) {
                if (node.id !== target)
                    return node;
                return {axis, ratio: 0.5, a: before ? {id} : node, b: before ? node : {id}};
            }
            return {...node, a: replace(node.a), b: replace(node.b)};
        };
        this.root = replace(this.root);
        return true;
    }

    moveTo(id, target, area, gap = 0, before = false, minimum = () => ({width: 120, height: 80})) {
        const current = this.rectangles(area, gap);
        if (id === target || !current.has(id) || !current.has(target))
            return false;
        const saved = this.root;
        this.remove(id);
        this.insertAt(id, target, area, gap, before);
        if ([...this.rectangles(area, gap)].some(([key, rect]) => {
            const min = minimum(key);
            return rect.width < min.width || rect.height < min.height;
        })) {
            this.root = saved;
            return false;
        }
        return true;
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
