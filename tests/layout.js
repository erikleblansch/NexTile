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
// Weighted borders retain proportions, clamp whole subtrees, and preserve area.
for (const gap of [0, 8, 32]) {
    const bounds = {x: -200, y: 24, width: 1500, height: 1000};
    const tree = new Layout();
    for (const id of ['a', 'b', 'c', 'd']) tree.insert(id, bounds, gap);
    const split = tree.dividers(bounds, gap)[0];
    assert(tree.resize(split.node, bounds.x + 1000, bounds, gap), 'Shared divider can move');
    const moved = tree.rectangles(bounds, gap);
    assert(moved.get('a').width > 900 && moved.get('b').width < 600, 'Both subtrees resize');
    const ratio = split.node.ratio;
    const larger = tree.rectangles({...bounds, width: 1800}, gap);
    assert(split.node.ratio === ratio && larger.get('a').width > moved.get('a').width,
        'Ratio survives monitor size changes');
    tree.resize(split.node, -10000, bounds, gap);
    assert([...tree.rectangles(bounds, gap).values()].every(r => r.width >= 120 && r.height >= 80),
        'Dragging past the edge clamps at subtree minimums');
    tree.resize(split.node, 10000, bounds, gap);
    assert([...tree.rectangles(bounds, gap).values()].every(r => r.width >= 120 && r.height >= 80),
        'Opposite edge also respects minimum sizes');
    assert(!tree.resize({}, 400, bounds, gap), 'Stale divider is ignored');
    assert(!tree.resize(split.node, NaN, bounds, gap), 'Invalid pointer coordinate is ignored');
}
for (const bounds of [{x: 0, y: 0, width: 1600, height: 1000}, {x: -800, y: 10, width: 800, height: 1600}]) {
    const tree = new Layout();
    for (const id of ['a', 'b', 'c']) tree.insert(id, bounds, 8);
    const before = tree.rectangles(bounds, 8);
    const oldSource = before.get('c');
    assert(tree.moveTo('a', 'b', bounds, 8), 'Moving removes source then splits target');
    const after = tree.rectangles(bounds, 8);
    const enlarged = after.get('c');
    assert(enlarged.width * enlarged.height > oldSource.width * oldSource.height, 'Remaining source sibling fills vacant space');
    const oldTarget = before.get('b');
    const horizontal = oldTarget.width >= oldTarget.height;
    assert(horizontal ? after.get('a').width < oldTarget.width : after.get('a').height < oldTarget.height,
        'Drop chooses the longest target dimension');
    assert(after.size === 3, 'Moving retains each window exactly once');
    assert(!tree.moveTo('a', 'a', bounds, 8) && !tree.moveTo('unknown', 'b', bounds, 8), 'Invalid drops are inert');
    // Repeated moves/resizes never duplicate leaves or overlap their rectangles.
    for (let step = 0; step < 60; step++) {
        tree.moveTo(['a', 'b', 'c'][step % 3], ['b', 'c', 'a'][step % 3], bounds, 8, step % 2 === 0);
        const divider = tree.dividers(bounds, 8)[0];
        tree.resize(divider.node, (divider.axis === 'horizontal' ? bounds.x : bounds.y) + 300 + step * 7, bounds, 8);
        const rects = [...tree.rectangles(bounds, 8).values()];
        assert(rects.length === 3, 'No duplicate or lost leaf after repeated moves');
        for (let i = 0; i < rects.length; i++) {
            const r = rects[i];
            assert(r.width >= 120 && r.height >= 80, 'Repeated moves and resizes respect minimums');
            for (let j = i + 1; j < rects.length; j++) {
                const t = rects[j];
                assert(r.x + r.width <= t.x || t.x + t.width <= r.x || r.y + r.height <= t.y || t.y + t.height <= r.y,
                    'No overlap after repeated moves and resizes');
            }
        }
    }
}
const tight = new Layout();
const tightArea = {x: 0, y: 0, width: 400, height: 180};
tight.insert('a', tightArea); tight.insert('b', tightArea); tight.insert('c', tightArea);
const savedRoot = tight.root;
assert(!tight.moveTo('a', 'b', tightArea, 0, false, () => ({width: 250, height: 160})),
    'Incompatible insertion is rejected');
assert(tight.root === savedRoot, 'Rejected insertion restores original tree atomically');
print(`PASS: ${checks} layout assertions`);
