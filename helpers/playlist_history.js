﻿'use strict';
//11/03/23

include('helpers_xxx.js');
include('helpers_xxx_playlists.js');
include('menu_xxx.js');
include('callbacks_xxx.js');

function PlsHistory({size = 11, bAutoInit = true} = {}) {
	this.pls = [];
	
	this.init = delayFn(() => {
		if (plman.ActivePlaylist !== -1) {
			this.pls.push({name: plman.GetPlaylistName(plman.ActivePlaylist), idx: plman.ActivePlaylist});
		}
		addEventListener('on_playlist_switch', this.onPlaylistSwitch);
		addEventListener('on_playlists_changed', this.onPlaylistsChanged);
		addEventListener('on_selection_changed', this.onSelectionChanged);
	}, 300);
	
	// Utilities
	this.getPrevPls = () => {
		const idx = this.pls.length >= 2 ? getPlaylistIndexArray(this.pls[1].name) : [];
		const len = idx.length;
		let prevPls = -1;
		if (len) {
			if (len === 1 && idx[0] !== -1) {
				prevPls = idx[0];
			} else if (idx.indexOf(this.pls[1].idx) !== -1) {
				prevPls = this.pls[1].idx;
			}
		}
		return prevPls;
	};
	
	this.goPrevPls = () => {
		const prevPls = this.getPrevPls();
		if (prevPls !== -1 && prevPls!== plman.ActivePlaylist) {plman.ActivePlaylist = prevPls;}
		return prevPls;
	};
	
	
	this.getPrevPlsName = () => {
		const prevPls = this.getPrevPls();
		return prevPls !== -1 ? plman.GetPlaylistName(prevPls) : '-None-';
	}
	
	this.getAll = () => {
		return this.pls;
	}
	
	this.getLast = () => {
		return this.pls[0];
	}

	this.getFirst = () => {
		const len = this.size();
		return len ? this.pls[len - 1] : null;
	}
	
	this.size = () => {
		return this.pls.length;
	}
	
	// Callbacks: append to any previously existing callback
	this.onPlaylistSwitch = () => {
		if (this.pls.length) {
			if (this.pls.length >= size) {this.pls.pop();}
			this.pls.unshift({name: plman.GetPlaylistName(plman.ActivePlaylist), idx: plman.ActivePlaylist});
		} else {initplsHistory();}
	};
	
	this.onPlaylistsChanged = () => {
		if (this.pls.length) {
			// Track idx change for playlist already added (when reordering for ex.)
			this.pls.forEach( (pls) => {
				const idx = getPlaylistIndexArray(pls.name); // Only non duplicated playlists can be tracked
				if (idx.length === 1 && idx[0] !== pls.idx) {pls.idx = idx[0];}
			});
			// Add new playlist if needed
			if (plman.ActivePlaylist !== this.pls[0].idx) {
				if (this.pls.length >= size) {this.pls.pop();}
				this.pls.unshift({name: plman.GetPlaylistName(plman.ActivePlaylist), idx: plman.ActivePlaylist});
			}
		} else {initplsHistory();}
	};
	
	this.onSelectionChanged =() => {
		if (!this.pls.length) {initplsHistory();}
	};
	
	// Menus
	this.menu = () => {
		const menu = new _menu(); // To avoid collisions with other buttons and check menu
		menu.newEntry({entryText: 'Switch to previous playlists:', func: null, flags: MF_GRAYED});
		menu.newEntry({entryText: 'sep'});
		menu.newEntry({entryText: 'Previous playlist', func: this.goPrevPls, flags: () => {return (this.size() >= 2 ? MF_STRING : MF_GRAYED);}});
		menu.newCondEntry({entryText: 'Playlist History... (cond)', condFunc: () => {
			const [, ...list] = this.pls;
			menu.newEntry({entryText: 'sep'});
			if (!list.length) {menu.newEntry({entryText: '-None-', func: null, flags: MF_GRAYED});}
			list.forEach((pls, idx) => {
				menu.newEntry({entryText: pls.name, func: () => {
					const idx = getPlaylistIndexArray(pls.name);
					if (idx.length) {
						if (idx.length === 1 && idx[0] !== -1) {
							plman.ActivePlaylist = idx[0];
						} else if (idx.indexOf(pls.idx) !== -1) {
							plman.ActivePlaylist = pls.idx;
						}
					}
				}});
			});
		}, flags: () => {return (this.size() >= 2 ? MF_STRING : MF_GRAYED);}});
		return menu;
	};
	
	if (bAutoInit) {this.init();}
}