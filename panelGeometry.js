// SPDX-License-Identifier: GPL-3.0-or-later
// Pure helpers shared by the panel and its tests.
export function workspaceFrames(count, position, viewport, scale = 1, activeWidth = 48) {
    if (!count)
        return [];
    const value = Math.max(0, Math.min(count - 1, position));
    let cursor = 0;
    const frames = Array.from({length: count}, (_, index) => {
        const proximity = Math.max(0, 1 - Math.abs(index - value));
        const expansion = proximity * proximity * (3 - 2 * proximity);
        const width = (24 + (activeWidth - 24) * expansion) * scale;
        const frame = {x: cursor, width, expansion};
        cursor += width + 8 * scale;
        return frame;
    });
    const left = Math.floor(value);
    const right = Math.ceil(value);
    const center = index => frames[index].x + frames[index].width / 2;
    const anchor = center(left) + (center(right) - center(left)) * (value - left);
    return frames.map(frame => ({...frame, x: frame.x + viewport / 2 - anchor}));
}

export function luminance(red, green, blue) {
    const linear = value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

export function contrastingInk(brightness, previous = null) {
    // Small hysteresis prevents flicker around the black/white crossover.
    if (previous === 'dark' && brightness > 0.16)
        return 'dark';
    if (previous === 'light' && brightness < 0.20)
        return 'light';
    return brightness > Math.sqrt(0.0525) - 0.05 ? 'dark' : 'light';
}

export function sampleBrightness(sample, x, width) {
    const ratio = sample.values.length / sample.width;
    const start = Math.max(0, Math.floor((x - sample.x) * ratio));
    const end = Math.min(sample.values.length, Math.ceil((x - sample.x + width) * ratio));
    if (end <= start)
        return null;
    let sum = 0;
    let count = 0;
    for (let column = start; column < end; column += Math.max(1, Math.floor((end - start) / 96))) {
        sum += sample.values[column];
        count++;
    }
    return sum / count;
}
