import {Layout, inset} from '../layout.js';

let checks = 0;
function assert(condition, message) {
    checks++;
    if (!condition)
        throw new Error(message);
}
function equal(actual, expected, message) {
    assert(JSON.stringify(actual) === JSON.stringify(expected), message);
}

const area = {x: -1200, y: 30, width: 1200, height: 800};
const layout = new Layout();
layout.insert('a', area);
layout.insert('b', area);
equal(layout.rectangles(area).get('a'), {...area, width: 600}, 'First split halves width');
layout.insert('c', area);
equal(layout.rectangles(area).get('a'), {...area, width: 600, height: 400}, 'Longest side splits vertically');
equal(layout.rectangles(area).get('b'), {x: -600, y: 30, width: 600, height: 800}, 'Other tile stays put');
layout.insert('d', area);
assert([...layout.rectangles(area).values()].every(r => r.width === 600 && r.height === 400), 'Fourth window splits largest tile');
layout.remove('c');
equal(layout.rectangles(area).get('a'), {...area, width: 600}, 'Sibling fills removed space');
const beforeSwap = layout.rectangles(area);
layout.swap('a', 'd');
equal(layout.rectangles(area).get('d'), beforeSwap.get('a'), 'Swap retains geometry');
layout.insert('d', area);
assert(layout.rectangles(area).size === 3, 'Duplicate insert is inert');
layout.remove('missing');
assert(layout.rectangles(area).size === 3, 'Missing removal is inert');
for (const id of ['a', 'b', 'd'])
    layout.remove(id);
assert(layout.root === null, 'Last close clears root');
equal(inset(area, 8), {x: -1192, y: 38, width: 1184, height: 784}, 'Outer gaps and negative coordinates');

// Deterministic property coverage: odd sizes, portrait/landscape, all orientations,
// gaps, repeated insertion/removal, and monitor size changes.
for (const mode of ['auto', 'horizontal', 'vertical']) {
    for (const gap of [0, 1, 8, 32]) {
        const tree = new Layout();
        const bounds = inset({x: 21, y: 45, width: 3841, height: 2161}, gap);
        for (let i = 0; i < 6; i++) {
            const previous = tree.rectangles(bounds, gap);
            tree.insert(i, bounds, gap, mode);
            const next = tree.rectangles(bounds, gap);
            assert(next.size === i + 1, 'Every insertion adds exactly one leaf');
            if (previous.size) {
                const largestArea = Math.max(...[...previous.values()].map(r => r.width * r.height));
                const changed = [...previous].filter(([id, r]) => JSON.stringify(r) !== JSON.stringify(next.get(id)));
                assert(changed.length === 1, 'Only one existing tile changes');
                assert(changed[0][1].width * changed[0][1].height === largestArea, 'Always splits a largest tile');
            }
            const rectangles = [...next.values()];
            for (const r of rectangles) {
                assert(r.width > 0 && r.height > 0, 'Positive dimensions');
                assert(r.x >= bounds.x && r.y >= bounds.y && r.x + r.width <= bounds.x + bounds.width &&
                    r.y + r.height <= bounds.y + bounds.height, 'Within monitor work area');
                for (const other of rectangles) {
                    if (r !== other)
                        assert(r.x + r.width <= other.x || other.x + other.width <= r.x ||
                            r.y + r.height <= other.y || other.y + other.height <= r.y, 'No overlap');
                }
            }
        }
        for (const id of [2, 0, 5, 1, 4, 3])
            tree.remove(id);
        assert(tree.root === null, 'Arbitrary close order clears tree');
    }
}
print(`PASS: ${checks} layout assertions`);
