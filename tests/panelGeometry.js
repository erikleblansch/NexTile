import {workspaceFrames, luminance, contrastingInk, sampleBrightness} from '../panelGeometry.js';

let checks = 0;
function assert(value, message) {
    checks++;
    if (!value)
        throw new Error(message);
}
assert(luminance(0, 0, 0) === 0, 'Black luminance');
assert(luminance(255, 255, 255) === 1, 'White luminance');
assert(contrastingInk(0) === 'light', 'White on black');
assert(contrastingInk(1) === 'dark', 'Black on white');
assert(contrastingInk(0.18, 'light') === 'light', 'Hysteresis retains white');
assert(contrastingInk(0.18, 'dark') === 'dark', 'Hysteresis retains black');
assert(contrastingInk(0.21, 'light') === 'dark', 'Hysteresis exits to black');
assert(contrastingInk(0.15, 'dark') === 'light', 'Hysteresis exits to white');
assert(workspaceFrames(0, 0, 280).length === 0, 'Empty workspace list');
const sample = {x: -100, width: 100, values: new Float32Array([1, 1, 0, 0])};
assert(sampleBrightness(sample, -100, 50) === 1, 'Sample light half on negative-coordinate monitor');
assert(sampleBrightness(sample, -50, 50) === 0, 'Sample dark half');
assert(sampleBrightness(sample, -75, 50) === 0.5, 'Sample across mixed wallpaper');
assert(sampleBrightness(sample, 20, 50) === null, 'Off-screen samples are ignored');
for (const scale of [1, 2]) {
    for (const count of [1, 2, 6, 36]) {
        for (let active = 0; active < count; active++) {
            const frames = workspaceFrames(count, active, 280 * scale, scale);
            assert(frames.length === count, 'Every workspace has a frame');
            assert(frames[active].x + frames[active].width / 2 === 140 * scale,
                'Active pill stays exactly centered, including first and last');
            assert(frames[active].width === 48 * scale, 'Pill width');
            frames.forEach((frame, index) => {
                if (index !== active)
                    assert(frame.width === 24 * scale, 'Inactive circle width');
                if (index > 0)
                    assert(frame.x - frames[index - 1].x - frames[index - 1].width === 8 * scale,
                        'Stable spacing without overlaps');
            });
        }
    }
}
let previous = workspaceFrames(6, 0, 280);
for (let step = 1; step <= 500; step++) {
    const frames = workspaceFrames(6, step / 100, 280);
    frames.forEach((frame, index) => {
        assert(Math.abs(frame.x - previous[index].x) < 1.5, 'Continuous position during swipe');
        assert(Math.abs(frame.width - previous[index].width) < 0.5, 'Continuous circle-to-pill morph');
    });
    previous = frames;
}
print(`PASS: ${checks} panel geometry and contrast assertions`);
