// SPDX-License-Identifier: GPL-3.0-or-later
// Mutter 49 replaced the flag-taking maximize API. Preserve partial flags
// when restoring windows, including on distributions that backport the API.
export function maximizeFlags(window) {
    return window.get_maximize_flags?.() ?? window.get_maximized();
}

export function maximize(window, flags) {
    if (window.set_maximize_flags)
        window.set_maximize_flags(flags);
    else
        window.maximize(flags);
}

export function unmaximize(window, flags) {
    if (window.set_unmaximize_flags)
        window.set_unmaximize_flags(flags);
    else
        window.unmaximize(flags);
}

// GNOME 48/49 use a callback (the grid returns void); 50/51 return a
// Promise. Some distributions backport this change, so inspect the result.
export async function updateSearch(display, ids, terms, complete) {
    let completed = false;
    const once = () => {
        if (!completed) {
            completed = true;
            complete();
        }
    };
    const result = display.updateSearch(ids, terms, once);
    if (result?.then) {
        await result;
        once();
    }
}
