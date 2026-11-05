// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Search from 'resource:///org/gnome/shell/ui/search.js';
import {updateSearch} from './compatibility.js';
import {Highlighter} from 'resource:///org/gnome/shell/misc/util.js';
import {ensureActorVisibleInScrollView} from 'resource:///org/gnome/shell/misc/animationUtils.js';

// Reuse GNOME's grid/list widgets and live provider registry, without creating
// another SearchResultsView (which owns session-long singleton connections).
export const NativeSearch = GObject.registerClass({
    Signals: {'terms-changed': {}, 'updated': {}, 'activated': {}},
}, class NativeSearch extends St.BoxLayout {
    _init() {
        // St gained orientation in 48 and removed vertical in 51.
        const vertical = 'orientation' in St.BoxLayout.prototype
            ? {orientation: Clutter.Orientation.VERTICAL} : {vertical: true};
        super._init({name: 'searchResults', style_class: 'nextile-native-results',
            ...vertical});
        this._content = new St.BoxLayout({name: 'searchResultsContent',
            ...vertical, x_expand: true});
        this._scrollView = new St.ScrollView({style_class: 'search-display vfade',
            overlay_scrollbars: true, x_expand: true, y_expand: true,
            hscrollbar_policy: St.PolicyType.NEVER, child: this._content});
        this.add_child(this._scrollView);
        this._status = new St.Label({style_class: 'search-statustext',
            x_align: Clutter.ActorAlign.CENTER});
        this.add_child(this._status);
        this._sections = new Map();
        this._terms = [];
        this._generation = 0;
        this._timeout = 0;
        this._requests = [];
        this._rows = [];
        this._selected = -1;
        this._pending = 0;
        this._activateWhenReady = false;
        this._highlighter = new Highlighter();
        this._disposed = false;
        this.connect('destroy', () => {
            this._disposed = true;
            this._cancel();
            this._sections.clear();
        });
    }

    get terms() { return this._terms; }
    highlightTerms(text) { return this._highlighter.highlight(text ?? ''); }

    _cancel() {
        this._generation++;
        if (this._timeout)
            GLib.Source.remove(this._timeout);
        this._timeout = 0;
        this._requests.forEach(request => request.cancel());
        this._requests = [];
        this._pending = 0;
        this._activateWhenReady = false;
    }

    setTerms(terms) {
        this._cancel();
        this._terms = terms;
        this._rows = [];
        this._selected = -1;
        for (const {display} of this._sections.values()) {
            if (display._notifyAllocationId) {
                display.disconnect(display._notifyAllocationId);
                display._notifyAllocationId = 0;
            }
            if (display._updateSearchLater) {
                global.compositor.get_laters().remove(display._updateSearchLater);
                delete display._updateSearchLater;
            }
            display.clear();
        }
        this._highlighter = new Highlighter(terms);
        this.emit('terms-changed');
        this.visible = terms.length > 0;
        if (!terms.length)
            return;
        this._status.text = _('Searching…');
        this._status.show();
        this._timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            this._timeout = 0;
            this._search();
            return GLib.SOURCE_REMOVE;
        });
    }

    _syncProviders() {
        const providers = Main.overview.searchController._searchResults._providers;
        for (const [source, section] of this._sections) {
            if (!providers.includes(source)) {
                section.display.destroy();
                this._sections.delete(source);
            }
        }
        for (const [index, source] of providers.entries()) {
            if (!this._sections.has(source)) {
                const provider = {
                    id: source.id, appInfo: source.appInfo, maxResults: source.maxResults,
                    canLaunchSearch: source.canLaunchSearch,
                    filterResults: (...args) => source.filterResults(...args),
                    launchSearch: terms => source.launchSearch(terms),
                };
                // Never assign display/state to GNOME's original provider.
                provider.display = null;
                const section = {source, provider, metas: new Map()};
                provider.getResultMetas = async ids => ids.map(id => section.metas.get(id));
                provider.createResultObject = meta => {
                    const result = source.createResultObject?.(meta) ?? (source.appInfo
                        ? new Search.ListSearchResult(provider, meta, this)
                        : new Search.GridSearchResult(provider, meta, this));
                    if (result.metaInfo) {
                        result.activate = () => {
                            source.activateResult(meta.id, this._terms);
                            if (meta.clipboardText)
                                St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, meta.clipboardText);
                            this.emit('activated');
                        };
                    } else {
                        const activate = result.activate;
                        result.activate = (...args) => {
                            activate.apply(result, args);
                            this.emit('activated');
                        };
                    }
                    result._nextileResultId = meta.id;
                    return result;
                };
                const display = source.appInfo
                    ? new Search.ListSearchResults(provider, this)
                    : new Search.GridSearchResults(provider, this);
                section.display = display;
                provider.display = display;
                if (display.providerInfo) {
                    // The native header toggles Overview after launching. This
                    // privately owned header closes our search instead.
                    const handler = GObject.signal_handler_find(display.providerInfo, {signalId: 'clicked'});
                    GObject.signal_handler_block(display.providerInfo, handler);
                    display.providerInfo.connect('clicked', () => {
                        source.launchSearch(this._terms);
                        this.emit('activated');
                    });
                }
                display.connect('notify::focus-child', () => {
                    if (display.focusChild)
                        ensureActorVisibleInScrollView(this._scrollView, display.focusChild);
                });
                this._content.add_child(display);
                this._sections.set(source, section);
            }
            this._content.set_child_at_index(this._sections.get(source).display, index);
        }
        return providers.map(source => this._sections.get(source));
    }

    _search() {
        const generation = this._generation;
        const sections = this._syncProviders();
        this._pending = sections.length;
        for (const section of sections)
            this._searchProvider(section, generation);
        if (!sections.length)
            this._update();
    }

    async _searchProvider(section, generation) {
        const {source, display} = section;
        const request = new Gio.Cancellable();
        this._requests.push(request);
        const current = () => !this._disposed && generation === this._generation && !request.is_cancelled();
        try {
            const ids = await source.getInitialResultSet(this._terms, request);
            if (!current())
                return;
            const max = display._getMaxDisplayedResults();
            const shown = max < 0 ? ids : source.filterResults(ids, max);
            const metas = shown.length ? await source.getResultMetas(shown, request) : [];
            if (!current())
                return;
            if (metas.length !== shown.length || metas.some(meta => !meta.id || !meta.name))
                throw new Error('Invalid result metadata');
            section.metas = new Map(metas.map(meta => [meta.id, meta]));
            // All external async work finishes before native widgets render.
            // Cached metadata resolves in this microtask turn; late remote
            // replies can never repopulate a closed/destroyed search.
            let completed = false;
            await updateSearch(display, ids, this._terms, () => {
                if (current()) {
                    if (!completed)
                        this._pending--;
                    completed = true;
                    this._update();
                }
            });
        } catch (error) {
            if (current()) {
                this._pending--;
                this._update();
                console.warn(`NexTile provider ${source.id}: ${error.message}`);
            }
        }
    }

    _update() {
        this._rows = [];
        for (const display of this._content.get_children()) {
            if (!display.visible)
                continue;
            const container = display._grid ?? display._content;
            for (const button of container.get_children()) {
                if (button.visible && button._nextileResultId)
                    this._rows.push({id: button._nextileResultId, button});
            }
        }
        this._status.visible = !this._rows.length;
        this._status.text = this._pending ? _('Searching…') : _('No results');
        this.select(Math.max(0, this._selected));
        this.emit('updated');
        if (this._activateWhenReady && this._rows.length) {
            this._activateWhenReady = false;
            this.activateSelected();
        }
    }

    select(index) {
        if (!this._rows.length)
            return;
        this._selected = (index + this._rows.length) % this._rows.length;
        this._rows.forEach(({button}, i) => {
            if (i === this._selected)
                button.add_style_pseudo_class('selected');
            else
                button.remove_style_pseudo_class('selected');
        });
        ensureActorVisibleInScrollView(this._scrollView, this._rows[this._selected].button);
    }

    activateSelected() {
        if (this._rows[this._selected]) {
            this._rows[this._selected].button.activate();
            return;
        }
        if (this._timeout || this._pending) {
            this._activateWhenReady = true;
            if (this._timeout) {
                GLib.Source.remove(this._timeout);
                this._timeout = 0;
                this._search();
            }
            return;
        }
        this._rows[this._selected]?.button.activate();
    }
});
