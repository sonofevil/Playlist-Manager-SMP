﻿'use strict';
//04/07/23

include('..\\..\\helpers\\helpers_xxx.js');
include('..\\..\\helpers\\helpers_xxx_properties.js');
include('..\\..\\helpers\\helpers_xxx_prototypes.js');
include('..\\..\\helpers\\menu_xxx.js');
include('..\\..\\helpers\\helpers_xxx_input.js');
include('playlist_manager_helpers.js');
include('playlist_manager_listenbrainz.js');
include('playlist_manager_youtube.js');

// Menus
const menuRbtn = new _menu();
menuRbtn.cache = {};
const menuLbtn = new _menu();
const menuLbtnMult = new _menu();
const menuRbtnTop = new _menu();
const menuRbtnSort = new _menu();
const menuSearch = new _menu();

// on callbacks
function createMenuLeft(forcedIndex = -1) {
	// Constants
	const z = (forcedIndex === -1) ? list.index : forcedIndex; // When delaying menu, the mouse may move to other index...
	list.tooltip.SetValue(null);
	const menu = menuLbtn;
	menu.clear(true); // Reset on every call
	if (z === -1) {
		fb.ShowPopupMessage('Selected index was -1 on createMenuLeft() when it shouldn\'t.\nPlease report bug with the steps you followed before this popup.', window.Name);
		return menu;
	}
	const pls = list.data[z];
	if (!pls) {
		fb.ShowPopupMessage('Selected playlist was null when it shouldn\'t.\nPlease report bug with the steps you followed before this popup.', window.Name);
		return menu;
	}
	const autoTags = ['bAutoLoad', 'bAutoLock', 'bMultMenu', 'bSkipMenu', 'bPinnedFirst', 'bPinnedLast'];
	const lb = listenBrainz;
	// Helpers
	const isPlsLoaded = () => {return plman.FindPlaylist(pls.nameId) !== -1;};
	const isPlsActive = () => {return plman.GetPlaylistName(plman.ActivePlaylist) !== pls.nameId;};
	const isAutoPls = () => {return pls.isAutoPlaylist || pls.query || isPlsUI() && plman.IsAutoPlaylist(plman.FindPlaylist(pls.nameId));};
	const isLockPls = () => {return pls.isLocked;};
	const isPlsEditable = () => {return pls.extension === '.m3u' || pls.extension === '.m3u8' || pls.extension === '.xspf' || pls.extension === '.fpl'  || pls.extension === '.xsp' || pls.isAutoPlaylist || pls.extension === '.ui';};
	const isPlsLockable = () => {return isPlsEditable() || pls.extension === '.strm';};
	const isPlsUI = () => {return pls.extension === '.ui';};
	// Evaluate
	const uiIdx = plman.FindPlaylist(pls.nameId);
	const bIsPlsLoaded = uiIdx !== -1;
	const bIsPlsActive = isPlsActive();
	const bIsAutoPls = isAutoPls();
	const bIsValidXSP = pls.extension !== '.xsp' || pls.hasOwnProperty('type') && pls.type === 'songs';
	const bIsLockPls = isLockPls();
	const bIsLockPlsRename = bIsPlsLoaded && (plman.GetPlaylistLockedActions(uiIdx) || []).includes('RenamePlaylist');
	const bIsPlsEditable = isPlsEditable();
	const bIsPlsLockable = isPlsLockable();
	const bIsPlsUI = isPlsUI();
	const bWritableFormat = writablePlaylistFormats.has(pls.extension);
	const bListenBrainz = list.properties.lBrainzToken[1].length > 0;
	const bManualSorting = list.methodState === list.manualMethodState();
	// Enabled menus
	const showMenus = JSON.parse(list.properties.showMenus[1]);
	// Header
	if (list.bShowMenuHeader) {
		menu.newEntry({entryText: '--- ' + (bIsAutoPls ? (pls.extension === '.xsp' ? 'Smart Playlist' :'AutoPlaylist'): pls.extension + ' Playlist') + ': ' + pls.name + ' ---' + (bIsValidXSP ? '' : ' (invalid type)'), flags: MF_GRAYED});
		menu.newEntry({entryText: 'sep'});
	}
	// Entries
	{	// Load
		// Load playlist within foobar2000. Only 1 instance allowed
		!list.bLiteMode && menu.newEntry({entryText: bIsPlsLoaded ? 'Reload playlist (overwrite)' : 'Load playlist', func: () => {
			if (pls.isAutoPlaylist) {
				const idx = getPlaylistIndexArray(pls.nameId);
				if (idx.length) {
					plman.RemovePlaylistSwitch(idx[0]);
				}
			}
			list.loadPlaylist(z);
		}, flags: bIsPlsUI ? MF_GRAYED : MF_STRING});
		// Show binded playlist
		menu.newEntry({entryText: (bIsPlsLoaded && bIsPlsActive) ? 'Show binded playlist' : (bIsPlsLoaded ? 'Show binded playlist (active playlist)' : 'Show binded playlist (not loaded)'), func: () => {list.showBindedPlaylist(z);}, flags: bIsPlsLoaded && bIsPlsActive ? MF_STRING : MF_GRAYED});
		// Contextual menu
		if (bIsPlsLoaded && showMenus['Playlist\'s items menu']) {
			menu.newMenu('Items...', void(0), void(0), {type: 'handlelist', playlistIdx: plman.FindPlaylist(pls.nameId)});
		}
		menu.newEntry({entryText: 'sep'});
		const selItems = plman.GetPlaylistSelectedItems(plman.ActivePlaylist);
		menu.newEntry({entryText: 'Copy selection to playlist', func: () => {
			if (selItems && selItems.Count) {
				list.sendSelectionToPlaylist({playlistIndex: z, bCheckDup: true});
			}
		}, flags: !bIsAutoPls && !bIsLockPls && (bWritableFormat || bIsPlsUI) && selItems.Count ? MF_STRING : MF_GRAYED});
		menu.newEntry({entryText: 'sep'});
		// Renames both playlist file and playlist within foobar2000. Only 1 instance allowed
		menu.newEntry({entryText: (!bIsLockPls && !bIsLockPlsRename ? 'Rename...' : (bIsAutoPls || bIsPlsUI ? 'Rename...' : 'Rename... (only filename)')), func: () => {
			const input = Input.string('string', pls.name, 'Enter playlist name:', window.Name, 'My playlist', void(0), true);
			if (input === null) {return;}
			renamePlaylist(list, z, input);
		}, flags: bIsPlsUI && bIsLockPlsRename ? MF_GRAYED : MF_STRING});
	}
	{	// Edit and update
		if (isAutoPls()) {
			// Change AutoPlaylist sort
			menu.newEntry({entryText: 'Edit sort pattern...', func: () => {
				let bDone = false;
				const input = Input.string('string', pls.sort, 'Enter sort pattern (optional):\n\nStart with \'SORT BY\', \'SORT ASCENDING BY\', ...', window.Name, 'SORT BY GENRE', [(s) => !s.length || s.match(/SORT.*$/)], false);
				if (input === null && !Input.isLastEqual) {return;}
				if (input !== null) {
					list.editData(pls, {
						sort: input,
					});
					bDone = true;
				}
				if (pls.sort.length) { // And force sorting
					const bSortForced = pls.extension === '.xsp' ? false : WshShell.Popup('Force sort?\n(currently ' + pls.bSortForced + ')', 0, window.Name, popup.question + popup.yes_no) === popup.yes;
					if (bSortForced !== pls.bSortForced) {
						list.editData(pls, {
							bSortForced,
						});
						bDone = true;
					}
				}
				if (bDone) {bDone = pls.extension === '.xsp' ? rewriteXSPSort(pls, input) : true;}
				if (bDone) {
					list.update(true, true);
					list.filter();
				}
			}, flags: !bIsLockPls && bIsValidXSP ? MF_STRING : MF_GRAYED});
			// Change AutoPlaylist query
			menu.newEntry({entryText: 'Edit query...', func: () => {
				let newQuery = '';
				try {newQuery = utils.InputBox(window.ID, 'Enter autoplaylist query', window.Name, pls.query);}
				catch(e) {return;}
				const bPlaylist = newQuery.indexOf('#PLAYLIST# IS') !== -1;
				if (!bPlaylist && !checkQuery(newQuery, false, true)) {fb.ShowPopupMessage('Query not valid:\n' + newQuery, window.Name); return;}
				if (newQuery !== pls.query) {
					const bDone = pls.extension === '.xsp' ? rewriteXSPQuery(pls, newQuery) : true;
					if (bDone) {
						list.editData(pls, {
							query: newQuery,
							size: bPlaylist ? '?' : fb.GetQueryItems(fb.GetLibraryItems(), stripSort(newQuery)).Count,
						});
						list.update(true, true);
						list.filter();
					}
				}
			}, flags: !bIsLockPls && bIsValidXSP ? MF_STRING : MF_GRAYED});
			if (pls.extension === '.xsp') {
				menu.newEntry({entryText: 'Edit limit...', func: () => {
					let input = Input.number('int positive', pls.limit, 'Enter number of tracks:', window.Name, 50);
					if (input === null) {return;}
					if (!Number.isFinite(input)) {input = 0;}
					const bDone = rewriteXSPLimit(pls, input);
					if (bDone) {
						list.editData(pls, {
							limit: input,
						});
						list.update(true, true);
						list.filter();
					}
				}, flags: !bIsLockPls && bIsValidXSP ? MF_STRING : MF_GRAYED});
			}
		} else if (!list.bLiteMode) {
			// Updates playlist file with any new changes on the playlist binded within foobar2000
			menu.newEntry({entryText: !bIsLockPls ? 'Update playlist file' : 'Force playlist file update', func: () => {
				if (_isFile(pls.path)) {
					const oldNameId = pls.nameId;
					const oldName = pls.name;
					const duplicated = getPlaylistIndexArray(oldNameId);
					if (duplicated.length > 1) { // There is more than 1 playlist with same name
						fb.ShowPopupMessage('You have more than one playlist with the same name: ' + oldName + '\n' + 'Please delete any duplicates and leave only the one you want.'  + '\n' + 'The playlist file will be updated according to that unique playlist.', window.Name);
					} else {
						let answer = popup.yes;
						if (pls.isLocked) { // Safety check for locked files (but can be overridden)
							answer = WshShell.Popup('Are you sure you want to update a locked playlist?\nIt will continue being locked afterwards.', 0, window.Name, popup.question + popup.yes_no);
						}
						if (answer === popup.yes) {list.updatePlaylist({playlistIndex: z, bForceLocked: true});}
					}
				} else {fb.ShowPopupMessage('Playlist file does not exist: ' + pls.name + '\nPath: ' + pls.path, window.Name);}
			}, flags: bIsPlsLoaded && !bIsPlsUI ? MF_STRING : MF_GRAYED});
			// Updates active playlist name to the name set on the playlist file so they get binded and saves playlist content to the file.
			menu.newEntry({entryText: bIsPlsActive ? 'Bind active playlist to this file' : 'Already binded to active playlist', func: () => {
				if (_isFile(pls.path)) {
					const oldNameId = plman.GetPlaylistName(plman.ActivePlaylist);
					const newNameId = pls.nameId;
					const newName = pls.name;
					var duplicated = plman.FindPlaylist(newNameId);
					if (duplicated !== -1) {
						fb.ShowPopupMessage('You already have a playlist loaded on foobar2000 binded to the selected file: ' + newName + '\n' + 'Please delete that playlist first within foobar2000 if you want to bind the file to a new one.' + '\n' + 'If you try to re-bind the file to its already binded playlist this error will appear too. Use \'Update playlist file\' instead.', window.Name);
					} else {
						list.updatePlman(newNameId, oldNameId);
						const bDone = list.updatePlaylist({playlistIndex: z});
						if (!bDone) {list.updatePlman(oldNameId, newNameId);} // Reset change
					}
				} else {fb.ShowPopupMessage('Playlist file does not exist: ' + pls.name + '\nPath: ' + pls.path, window.Name);}
			}, flags: bIsPlsActive  && !bIsLockPls && bWritableFormat ? MF_STRING : MF_GRAYED});
		}
	}
	if (showMenus['Category'] || showMenus['Tags']) {
		menu.newEntry({entryText: 'sep'});
	}
	{	// Tags and category
		if (showMenus['Category']) {
			{	// Set category
				const menuName = menu.newMenu('Set category...', void(0), !bIsLockPls && bIsPlsEditable || bIsPlsUI ? MF_STRING : MF_GRAYED);
				menu.newEntry({menuName, entryText: 'New category...', func: () => {
					const input = Input.string('string', pls.category !== null ? pls.category : '', 'Category name (only 1):', window.Name, 'My category');
					if (input === null) {return;}
					setCategory(input, list, z);
				}});
				menu.newEntry({menuName, entryText: 'sep'});
				list.categories().forEach((category, i) => {
					menu.newEntry({menuName, entryText: category, func: () => {
						if (pls.category !== category) {setCategory(i ? category : '', list, z);}
					}});
					menu.newCheckMenu(menuName, category, void(0), () => {return (pls.category === (i ? category : ''));});
				});
			}
		}
		if (showMenus['Tags']) {
			{	// Set tag(s)
				const menuName = menu.newMenu('Set playlist tag(s)...', void(0), !bIsLockPls && bIsPlsEditable || bIsPlsUI ? MF_STRING : MF_GRAYED);
				menu.newEntry({menuName, entryText: 'New tag(s)...', func: () => {
					const input = Input.json('array strings', pls.tags, 'Tag(s) Name(s):\n(JSON)', window.Name, '["TagA","TagB"]', void(0), true);
					if (input === null) {return;}
					setTag(input, list, z);
				}});
				menu.newEntry({menuName, entryText: 'sep'});
				let bAddInvisibleIds = false;
				list.tags().concat(['sep', ...autoTags]).forEach((tag, i) => {
					if (tag === 'sep') {menu.newEntry({menuName, entryText: 'sep'}); bAddInvisibleIds = true; return;} // Add invisible id for entries after separator to duplicate check marks
					const entry = menu.newEntry({menuName, entryText: tag, func: () => {
						let tags;
						if (i === 0) {tags = [];}
						else if (pls.tags.indexOf(tag) !== -1) {tags = [...new Set(pls.tags).difference(new Set([tag]))];} 
						else {tags = [...pls.tags, tag];}
						setTag(tags, list, z);
					}, bAddInvisibleIds});
					menu.newCheckMenu(menuName, entry.entryText, void(0), () => {return (i ? pls.tags.indexOf(tag) !== -1 : pls.tags.length === 0);});
				});
			}
			// Adds track tag(s)
			menu.newEntry({entryText: 'Automatically add tag(s) to tracks...', func: () => {
				let tags = '';
				const currValue = pls.trackTags && pls.trackTags.length ? JSON.stringify(pls.trackTags) : '';
				try {tags = utils.InputBox(window.ID, 'Enter data json-formatted: [{"TAGNAME":"tagValue"},...]\n\nTagValue may be:\n- String (with quotes) or number (doesn\'t need quotes).\n- Value list separated by comma (,).\n- TF expression applied to added track.\n- JS:+Function name (see helpers_xxx_utils.js).\n\nValues will be split by comma in any case.\n\nFor ex:\n \t[{"MOOD":"Chill"}]\n\t[{"ADDEDDATE":"JS:todayDate"}, {"ENERGY":5}]\n\t[{"PLAYLISTNAME":"JS:playlistName"}]', window.Name, currValue, true);} 
				catch(e) {return;}
				const tagsString = tags;
				if (tags.length) {
					tags = tags.replaceAll('\'\'','"'); // Replace quotes
					try {tags = JSON.parse(tags);} catch(e){fb.ShowPopupMessage('Input is not a valid JSON:\n' + tags, window.Name); return;}
				}
				if (tagsString !== currValue) {setTrackTags(tags, list, z);}
			}, flags: !bIsLockPls && bIsPlsEditable && bIsValidXSP || bIsPlsUI ? MF_STRING : MF_GRAYED});
		}
	}
	menu.newEntry({entryText: 'sep'});
	{	// Export and clone
		//	AutoPlaylists clone
		if (bIsAutoPls) { // For XSP playlists works the same as being an AutoPlaylist!
			!list.bLiteMode && menu.newEntry({entryText: 'Clone as standard playlist...', func: () => {
				const remDupl = (pls.isAutoPlaylist && list.bRemoveDuplicatesAutoPls) || (pls.extension === '.xsp' && list.bRemoveDuplicatesSmartPls) ? list.removeDuplicatesAutoPls : [];
				cloneAsStandardPls(list, z, remDupl, list.bAdvTitle);
			}, flags: bIsAutoPls && bIsValidXSP ? MF_STRING : MF_GRAYED});
			menu.newEntry({entryText: 'Clone as AutoPlaylist and edit...', func: () => { // Here creates a foobar2000 autoplaylist no matter the original format
				cloneAsAutoPls(list, z);
			}, flags: bIsAutoPls && bIsValidXSP ? MF_STRING : MF_GRAYED});
			!list.bLiteMode && menu.newEntry({entryText: 'Clone as Smart Playlist and edit...', func: () => { // Here creates a Kodi XSP smart no matter the original format
				cloneAsSmartPls(list, z);
			}, flags: bIsAutoPls && bIsValidXSP ? MF_STRING : MF_GRAYED});
			if (showMenus['Export and copy']) {
				!list.bLiteMode && menu.newEntry({entryText: 'Export as json file...', func: () => {
					const path = list.exportJson({idx: z, bAllExt: true});
					if (_isFile(path)) {_explorer(path);}
				}, flags: bIsAutoPls ? MF_STRING : MF_GRAYED});
				if (pls.extension === '.xsp') {
					// Copy
					!list.bLiteMode && menu.newEntry({entryText: 'Copy playlist file to...', func: () => {
						exportPlaylistFile(list, z);
					}, flags: loadablePlaylistFormats.has(pls.extension) ? MF_STRING : MF_GRAYED});
				}
			}
		} else if (!list.bLiteMode) {	// Export and Rel. Paths handling
			if (showMenus['Relative paths handling']) {
				// Rel Paths
				menu.newEntry({entryText: 'Force relative paths...', func: () => {
					convertToRelPaths(list, z);
				}, flags: bWritableFormat && !bIsLockPls ? MF_STRING : MF_GRAYED});
			}
			// Clone as
			{
				const presets = [...writablePlaylistFormats, 'sep', '.ui'];
				const subMenuName = menu.newMenu('Clone as...');
				menu.newEntry({menuName: subMenuName, entryText: 'Select a format:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				presets.forEach((ext) => {
					const entryText = ext === '.ui' ? 'Clone in UI' : ext;
					if (ext === 'sep') {menu.newEntry({menuName: subMenuName, entryText, flags: MF_GRAYED}); return;}
					menu.newEntry({menuName: subMenuName, entryText, func: () => {
						clonePlaylistFile(list, z, ext);
					}});
				});
			}
			if (showMenus['Export and copy']) {
				// Copy
				menu.newEntry({entryText: 'Copy playlist file to...', func: () => {
					exportPlaylistFile(list, z);
				}, flags: loadablePlaylistFormats.has(pls.extension) ? MF_STRING : MF_GRAYED});
				// Export and copy
				menu.newEntry({entryText: 'Export and Copy Tracks to...', func: () => {
					exportPlaylistFileWithTracks({list, z, bAsync: list.properties.bCopyAsync[1]});
				}, flags: bWritableFormat ? MF_STRING : MF_GRAYED});
			}
		} else { // Lite mode
			// Clone as
			menu.newEntry({entryText: 'Clone in UI', func: () => {
				clonePlaylistFile(list, z, '.ui');
			}});
		}
		if (showMenus['Export and copy']) {
			{	// Export and Convert
				const presets = JSON.parse(list.properties.converterPreset[1]);
				const flags = bWritableFormat || bIsPlsUI || bIsAutoPls && bIsValidXSP ? MF_STRING : MF_GRAYED;
				const subMenuName = menu.newMenu('Export and Convert Tracks to...', void(0), presets.length ? flags : MF_GRAYED);
				menu.newEntry({menuName: subMenuName, entryText: 'Select a preset:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				presets.forEach((preset) => {
					const path = preset.path;
					let pathName = (path.length ? '(' + path.split('\\')[0] +'\\) ' + path.split('\\').slice(-2, -1) : '(Folder)');
					const dsp = preset.dsp;
					let dspName = (dsp !== '...' ? dsp  : '(DSP)');
					const tf = preset.tf;
					let tfName = preset.hasOwnProperty('name') && preset.name.length ? preset.name : preset.tf;
					const extension = preset.hasOwnProperty('extension') && preset.extension.length ? preset.extension : '';
					const extensionName = extension.length ? '[' + extension + ']' : '';
					if (pathName.length > 20) {pathName = pathName.substr(0, 20) + '...';}
					if (dspName.length > 20) {dspName = dspName.substr(0, 20) + '...';}
					if (tfName.length > 40) {tfName = tfName.substr(0, 40) + '...';}
					menu.newEntry({menuName: subMenuName, entryText: pathName + extensionName + ': ' + dspName + ' ---> ' + tfName, func: () => {
						const remDupl = (pls.isAutoPlaylist && list.bRemoveDuplicatesAutoPls) || (pls.extension === '.xsp' && list.bRemoveDuplicatesSmartPls) ? list.removeDuplicatesAutoPls : [];
						if (!pls.isAutoPlaylist) {
							exportPlaylistFileWithTracksConvert(list, z, tf, dsp, path, extension, remDupl, list.bAdvTitle); // Include remDupl for XSP playlists
						} else {
							exportAutoPlaylistFileWithTracksConvert(list, z, tf, dsp, path, extension, remDupl, list.bAdvTitle);
						}
					}, flags});
				});
			}
		}
		if (showMenus['Online sync']) {
			{	// Export to ListenBrainz
				const subMenuName = menu.newMenu('Online sync...', void(0), bIsValidXSP ? MF_STRING : MF_GRAYED);
				menu.newEntry({menuName: subMenuName, entryText: 'Export to ListenBrainz' + (bListenBrainz ? '' : '\t(token not set)'), func: async () => {
					if (!await checkLBToken()) {return false;}
					let bUpdateMBID = false;
					let playlist_mbid = '';
					const bLookupMBIDs = list.properties.bLookupMBIDs[1];
					const token = bListenBrainz ? lb.decryptToken({lBrainzToken: list.properties.lBrainzToken[1], bEncrypted: list.properties.lBrainzEncrypt[1]}) : null;
					if (!token) {return false;}
					if (pls.playlist_mbid.length) {
						console.log('Syncing playlist with MusicBrainz: ' + pls.name);
						playlist_mbid = await lb.syncPlaylist(pls, list.playlistsPath, token, bLookupMBIDs);
						if (playlist_mbid.length && pls.playlist_mbid !== playlist_mbid) {bUpdateMBID = true; fb.ShowPopupMessage('Playlist had an MBID but no playlist was found with such MBID on server.\nA new one has been created. Check console.', window.Name);}
					} else {
						console.log('Exporting playlist to MusicBrainz: ' + pls.name);
						playlist_mbid = await lb.exportPlaylist(pls, list.playlistsPath, token, bLookupMBIDs);
						if (playlist_mbid && typeof playlist_mbid === 'string' && playlist_mbid.length) {bUpdateMBID = true;} 
					}
					if (!playlist_mbid || typeof playlist_mbid !== 'string' || !playlist_mbid.length) {lb.consoleError('Playlist was not exported.');}
					if (list.properties.bSpotify[1]) {
						lb.retrieveUser(token).then((user) => lb.getUserServices(user, token)).then((services) => {
							if (services.indexOf('spotify') !== -1) {
								console.log('Exporting playlist to Spotify: ' + pls.name);
								lb.exportPlaylistToService({playlist_mbid}, 'spotify', token);
							}
						});
					}
					if (bUpdateMBID && bWritableFormat) {setPlaylist_mbid(playlist_mbid, list, pls);}
				}, flags: bListenBrainz ? MF_STRING : MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'Import from ListenBrainz' + (bListenBrainz ? '' : '\t(token not set)'), func: async () => {
					if (!pls.playlist_mbid.length) {return Promise.resolve(false);}
					if (!await checkLBToken()) {return Promise.resolve(false);}
					let bDone = false;
					if (_isFile(pls.path)) {
						const token = bListenBrainz ? lb.decryptToken({lBrainzToken: list.properties.lBrainzToken[1], bEncrypted: list.properties.lBrainzEncrypt[1]}) : null;
						if (!token) {return false;}
						lb.importPlaylist(pls, token)
							.then((jspf) => {
								if (jspf) {
									const data = lb.contentResolver(jspf);
									const handleArr = data.handleArr;
									const notFound = data.notFound;
									const bXSPF = pls.extension === '.xspf';
									if (!bXSPF) {
										let bYouTube = false;
										if (notFound.length && isYouTube) {
											const answer = WshShell.Popup('Some imported tracks have not been found on library (see console).\nDo you want to replace them with YouTube links?\n(Pressing \'No\' will omit not found items)?', 0, window.Name, popup.question + popup.yes_no);
											if (answer === popup.yes) {bYouTube = true;}
										}
										if (pls.isLocked) { // Safety check for locked files (but can be overridden)
											let answer = WshShell.Popup('Are you sure you want to update a locked playlist?\nIt will continue being locked afterwards.', 0, window.Name, popup.question + popup.yes_no);
											if (answer === popup.no) {return false;}
										}
										const backPath = pls.path + '.back';
										// Find missing tracks on youtube
										if (bYouTube) {
											// Add MBIDs to youtube track metadata
											notFound.forEach((track) => track.tags = {musicbrainz_trackid: track.identifier});
											// Send request in parallel every x ms and process when all are done
											return Promise.parallel(notFound, youtube.searchForYoutubeTrack, 5).then((results) => {
												let j = 0;
												const itemsLen = handleArr.length;
												let foundLinks = 0;
												results.forEach((result, i) => {
													for (void(0); j <= itemsLen; j++) {
														if (result.status !== 'fulfilled') {break;}
														const link = result.value;
														if (!link || !link.length) {break;}
														if (!handleArr[j]) {
															handleArr[j] = link.url;
															foundLinks++;
															break;
														}
													}
												});
												list.disableAutosaveForPls(pls.nameId);
												const bLoaded = plman.FindPlaylist(pls.nameId) !== -1;
												const idx = plman.FindOrCreatePlaylist(pls.nameId, true);
												plman.ClearPlaylist(idx);
												return plman.AddPlaylistItemsOrLocations(idx, handleArr.filter(Boolean), true)
													.then(() => {
														plman.ActivePlaylist = idx;
														const handleList = plman.GetPlaylistItems(idx);
														console.log('Found ' + foundLinks + ' tracks on YouTube');
														const delay = setInterval(delayAutoUpdate, list.autoUpdateDelayTimer);
														if (_isFile(pls.path)) {_renameFile(pls.path, backPath);}
														bDone = savePlaylist({handleList, playlistPath: pls.path, ext: pls.extension, playlistName: pls.name, UUID: (pls.id || null), bLocked: pls.isLocked, category: pls.category, tags: pls.tags, trackTags: pls.trackTags, playlist_mbid: pls.playlist_mbid, author: pls.author, description: pls.description, bBOM: list.bBOM, relPath: (list.bRelativePath ? list.playlistsPath : '')});
														// Restore backup in case something goes wrong
														if (!bDone) {console.log('Failed saving playlist: ' + pls.path); _deleteFile(pls.path); _renameFile(backPath, pls.path);}
														else if (_isFile(backPath)) {_deleteFile(backPath);}
														if (bDone) {list.update(false, true, list.lastIndex); list.filter();}
														if (bDone && !bLoaded) {plman.RemovePlaylist(idx);}
														clearInterval(delay);
														list.enableAutosaveForPls(pls.nameId);
														return bDone;
													});
											});
										} else {
											const handleList = data.handleList;
											const delay = setInterval(delayAutoUpdate, list.autoUpdateDelayTimer);
											if (_isFile(pls.path)) {_renameFile(pls.path, backPath);}
											bDone = savePlaylist({handleList, playlistPath: pls.path, ext: pls.extension, playlistName: pls.name, UUID: (pls.id || null), bLocked: pls.isLocked, category: pls.category, tags: pls.tags, trackTags: pls.trackTags, playlist_mbid: pls.playlist_mbid, author: pls.author, description: pls.description, bBOM: list.bBOM, relPath: (list.bRelativePath ? list.playlistsPath : '')});
											// Restore backup in case something goes wrong
											if (!bDone) {console.log('Failed saving playlist: ' + pls.path); _deleteFile(pls.path); _renameFile(backPath, pls.path);}
											else if (_isFile(backPath)) {_deleteFile(backPath);}
											const bLoaded = plman.FindPlaylist(pls.nameId) !== -1;
											if (bDone && bLoaded) {
												list.disableAutosaveForPls(pls.nameId);
												sendToPlaylist(handleList, pls.nameId);
												list.enableAutosaveForPls(pls.nameId);
											}
											clearInterval(delay);
										}
									} else {
										const playlist = jspf.playlist;
										const author = playlist.extension['https://musicbrainz.org/doc/jspf#playlist'].creator;
										let totalDuration = 0;
										playlist.creator = author + ' - Playlist-Manager-SMP';
										playlist.info = 'https://listenbrainz.org/user/' + author + '/playlists/';
										playlist.location = playlist.identifier;
										playlist.meta = [
											{uuid: pls.id},
											{locked: pls.isLocked},
											{category: pls.category},
											{tags: (isArrayStrings(pls.tags) ? pls.tags.join(';') : '')},
											{trackTags: (isArrayStrings(pls.trackTags) ? pls.tags.join(';') : '')},
											{playlistSize: playlist.track.length},
											{duration: totalDuration},
											{playlist_mbid: pls.playlist_mbid}
										];
										// Tracks text
										handleArr.forEach((handle, i) => {
											if (!handle) {return;}
											const relPath = '';
											const tags = getTagsValuesV4(new FbMetadbHandleList(handle), ['TITLE', 'ARTIST', 'ALBUM', 'TRACK', 'LENGTH_SECONDS_FP', '_PATH_RAW', 'SUBSONG', 'MUSICBRAINZ_TRACKID']);
											const title = tags[0][0][0];
											const creator = tags[1][0].join(', ');
											const album = tags[2][0][0];
											const trackNum = Number(tags[3][0][0]);
											const duration = Math.round(Number(tags[4][0][0] * 1000)); // In ms
											totalDuration += Math.round(Number(tags[4][0][0])); // In s
											const location = [relPath.length && !_isLink(tags[5][0][0]) ? getRelPath(tags[5][0][0], relPathSplit) : tags[5][0][0]]
												.map((path) => {
													return encodeURI(path.replace('file://', 'file:///').replace(/\\/g,'/').replace(/&/g,'%26'));
												});
											const subSong = Number(tags[6][0][0]);
											const meta = location[0].endsWith('.iso') ? [{subSong}] : [];
											const identifier = [tags[7][0][0]];
											playlist.track[i] = {
												location,
												annotation: void(0),
												title,
												creator,
												info: void(0),
												image: void(0),
												album,
												duration,
												trackNum,
												identifier,
												extension: {},
												link: [],
												meta
											};
										});
										// Fix JSPF identifiers as array
										playlist.track.forEach((track) => {
											if (!Array.isArray(track.identifier)) {track.identifier = [track.identifier];}
										});
										// Update total duration of playlist
										playlist.meta.find((obj) => {return obj.hasOwnProperty('duration');}).duration = totalDuration;
										const playlistPath = list.playlistsPath + sanitize(playlist.title) + '.xspf';
										let xspf = XSPF.toXSPF(jspf);
										const delay = setInterval(delayAutoUpdate, list.autoUpdateDelayTimer);
										xspf = xspf.join('\r\n');
										bDone = _save(pls.path, xspf, list.bBOM);
										// Check
										if (_isFile(pls.path) && bDone) {bDone = (_open(pls.path, utf8) === xspf);}
										// Restore backup in case something goes wrong
										if (!bDone) {console.log('Failed saving playlist: ' + pls.path); _deleteFile(pls.path); _renameFile(backPath, pls.path);}
										else if (_isFile(backPath)) {_deleteFile(backPath);}
										if (bDone && plman.FindPlaylist(pls.nameId) !== -1) {sendToPlaylist(new FbMetadbHandleList(handleArr.filter((n) => n)), pls.nameId);}
										if (bDone) {list.update(false, true, list.lastIndex); list.filter()}
										clearInterval(delay);
										return bDone;
									}
								} else {return bDone;}
							})
							.finally(() => {
								if (!bDone) {lb.consoleError('Playlist was not imported.');}
								return bDone;
							});
					} else {
						console.log('Playlist file not found: ' + pls.path); 
						return Promise.resolve(bDone);
					}
				}, flags: pls.playlist_mbid.length && bWritableFormat ? (bListenBrainz ? MF_STRING : MF_GRAYED) : MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'Get URL...' + (pls.playlist_mbid ? '' : '\t(no MBID)'), func: async () => {
					console.popup('Playlist URL: \n' + lb.getPlaylistURL(pls), window.Name);
				}, flags: pls.playlist_mbid.length ? MF_STRING : MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'Open on Web...' + (pls.playlist_mbid ? '' : '\t(no MBID)'), func: async () => {
					const url = lb.getPlaylistURL(pls);
					if (lb.regEx.test(url)) {_run(lb.getPlaylistURL(pls));}
				}, flags: pls.playlist_mbid.length ? MF_STRING : MF_GRAYED});
			}
		}
	}
	if (showMenus['File locks'] || showMenus['UI playlist locks'] && bIsPlsLoaded || showMenus['Sorting'] && bManualSorting) {menu.newEntry({entryText: 'sep'});}
	{	// File management
		// Locks playlist file
		if (showMenus['File locks']) {
			if (!bIsPlsUI) {
				menu.newEntry({entryText: !bIsLockPls ? 'Lock Playlist (read only)' : 'Unlock Playlist (writable)', func: () => {
					switchLock(list, z);
				}, flags: bIsPlsLockable ? MF_STRING : MF_GRAYED});
			}
		}
		// Locks UI playlist
		if (showMenus['UI playlist locks']) {
			if (bIsPlsUI || bIsPlsLoaded) {
				const lockTypes = [
					{type: 'AddItems', entryText: 'Adding items'},
					{type: 'RemoveItems', entryText: 'Removing items'},
					{type: 'ReplaceItems', entryText: 'Replacing items'},
					{type: 'ReorderItems', entryText: 'Sorting items'},
					{type: 'RenamePlaylist', entryText: 'Renaming playlist'},
					{type: 'RemovePlaylist', entryText: 'Deleting playlist'},
					{type: 'ExecuteDefaultAction', entryText: 'Default action'}
				];
				const index = plman.FindPlaylist(pls.nameId);
				const currentLocks = new Set(plman.GetPlaylistLockedActions(index) || []);
				const lockName = plman.GetPlaylistLockName(index);
				const bSMPLock = lockName === 'foo_spider_monkey_panel' || !lockName;
				const flags = bSMPLock ? MF_STRING: MF_GRAYED;
				const subMenuName = menu.newMenu('Edit UI Playlist lock...');
				menu.newEntry({menuName: subMenuName, entryText: 'Lock by action:' + (!bSMPLock ? '\t' + _p(lockName) : ''), flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				lockTypes.forEach((lock) => {
					menu.newEntry({menuName: subMenuName, entryText: lock.entryText, func: () => {
						if (currentLocks.has(lock.type)) {
							currentLocks.delete(lock.type);
						} else {
							currentLocks.add(lock.type);
						}
						plman.SetPlaylistLockedActions(index, [...currentLocks]);
					}, flags});
					menu.newCheckMenu(subMenuName, lock.entryText, void(0), () => {return currentLocks.has(lock.type);});
				});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'All locks', func: () => {
					plman.SetPlaylistLockedActions(index, lockTypes.map((lock) => lock.type));
				}, flags});
				menu.newEntry({menuName: subMenuName, entryText: 'None', func: () => {
					plman.SetPlaylistLockedActions(index, []);
				}, flags});
			}
		}
		if (showMenus['Sorting'] && bManualSorting) {
			menu.newEntry({entryText: 'sep'});
			const subMenuName = menu.newMenu('Sorting...');
			menu.newEntry({menuName: subMenuName, entryText: 'Manual sorting:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			const options = [
				{name: 'Up', idx: (i) => i - 1},
				{name: 'Down', idx: (i) => i + 1},
				{name: 'sep'},
				{name: 'Send to top', idx: 0},
				{name: 'Send to bottom', idx: Infinity},
				
			];
			options.forEach((opt) => {
				if (opt.name === 'sep') {menu.newEntry({menuName: subMenuName, entryText: 'sep', flags: MF_GRAYED}); return;}
				menu.newEntry({menuName: subMenuName, entryText: opt.name, func: () => list.setManualSortingForPls([pls], opt.idx)});
			});
		}
		if (showMenus['File management']) {
			menu.newEntry({entryText: 'sep'});
			// Deletes playlist file and playlist loaded
			menu.newEntry({entryText: 'Delete', func: () => {list.removePlaylist(z);}});
			!list.bLiteMode && menu.newEntry({entryText: 'Open file on explorer', func: () => {
				if (pls.isAutoPlaylist) {_explorer(list.filename);} // Open AutoPlaylist json file
				else {_explorer(_isFile(pls.path) ? pls.path : list.playlistsPath);} // Open playlist path
			}, flags: !bIsPlsUI ? MF_STRING : MF_GRAYED});
		}
	}
	return menu;
}

// on callbacks
function createMenuLeftMult(forcedIndexes = []) {
	// Constants
	const indexes = forcedIndexes.length === 0 ? [...list.indexes] : [...forcedIndexes]; // When delaying menu, the mouse may move to other index...
	list.tooltip.SetValue(null);
	const menu = menuLbtnMult;
	menu.clear(true); // Reset on every call
	if (indexes.length === 0) {
		fb.ShowPopupMessage('Selected indexes wwere empty on createMenuLeftMult() when it shouldn\'t.\nPlease report bug with the steps you followed before this popup.', window.Name);
		return menu;
	}
	const playlists = [];
	for (let z of indexes) {
		playlists.push(list.data[z]);
		if (!playlists.slice(-1)[0]) {
			fb.ShowPopupMessage('Selected playlist was null when it shouldn\'t.\nPlease report bug with the steps you followed before this popup.\n\nInfo:\nIndexes:' + indexes + '\nPlaylists:' + playlists, window.Name);
			return menu;
		}
	}
	const autoTags = ['bAutoLoad', 'bAutoLock', 'bMultMenu', 'bSkipMenu', 'bPinnedFirst', 'bPinnedLast'];
	// Helpers
	const isPlsLoaded = (pls) => {return plman.FindPlaylist(pls.nameId) !== -1;};
	const isPlsActive = (pls) => {return plman.GetPlaylistName(plman.ActivePlaylist) !== pls.nameId;};
	const isAutoPls = (pls) => {return pls.isAutoPlaylist || pls.query;};
	const isLockPls = (pls) => {return pls.isLocked;};
	const isPlsEditable = (pls) => {return pls.extension === '.m3u' || pls.extension === '.m3u8' || pls.extension === '.xspf' || pls.extension === '.fpl'  || pls.extension === '.xsp' || pls.isAutoPlaylist || pls.extension === '.ui';};
	const isPlsLockable = (pls) => {return isPlsEditable(pls) || pls.extension === '.strm';};
	const isPlsUI = (pls) => {return pls.extension === '.ui';};
	const nonPlsUI = playlists.filter((pls) => {return pls.extension !== '.ui';});
	// Pls
	const playlistsUI = playlists.filter((pls) => {return pls.extension === '.ui';});
	const playlistsLoaded = playlists.filter((pls) => {return isPlsLoaded(pls);});
	// Evaluate
	const bIsPlsLoadedEvery = playlists.every((pls) => {return isPlsLoaded(pls);});
	const bIsPlsLoadedSome = bIsPlsLoadedEvery || playlists.some((pls) => {return isPlsLoaded(pls);});
	const bIsAutoPlsEvery = playlists.every((pls) => {return isAutoPls(pls);});
	const bIsValidXSPEveryOnly = playlists.every((pls) => {return (pls.extension === '.xsp' && pls.hasOwnProperty('type') && pls.type === 'songs') || true;});
	const bIsValidXSPEvery = !bIsAutoPlsEvery || playlists.every((pls) => {return (pls.extension === '.xsp' && pls.hasOwnProperty('type') && pls.type === 'songs');});
	const bIsAutoPlsSome = bIsAutoPlsEvery || playlists.some((pls) => {return isAutoPls(pls);});
	const bIsLockPlsEvery = nonPlsUI.length && nonPlsUI.every((pls) => {return isLockPls(pls);});
	const bIsPlsEditable = playlists.some((pls) => {return isPlsEditable(pls);});
	const bIsPlsLockable = playlists.some((pls) => {return isPlsLockable(pls);});
	const bIsPlsUIEvery = playlistsUI.length === playlists.length;
	const bIsPlsUISome = playlistsUI.length ? true : false;
	const bWritableFormat = playlists.some((pls) => {return writablePlaylistFormats.has(pls.extension);});
	const bManualSorting = list.methodState === list.manualMethodState();
	// Enabled menus
	const showMenus = JSON.parse(list.properties.showMenus[1]);
	// Header
	if (list.bShowMenuHeader) {
		menu.newEntry({entryText: '--- ' +  playlists.length + ' playlists: ' + playlists.map((pls) => {return pls.name;}).joinUpToChars(', ', 20) + ' ---', flags: MF_GRAYED});
		menu.newEntry({entryText: 'sep'});
	}
	// Entries
	{	// Load
		// Load playlist within foobar2000. Only 1 instance allowed
		menu.newEntry({entryText: 'Load playlists', func: () => {
			indexes.forEach((z, i) => {
				const pls = playlists[i];
				if (!isPlsUI(pls)) {list.loadPlaylist(z);}
			});
		}, flags: bIsPlsLoadedEvery ? MF_GRAYED : MF_STRING});
		// Merge load
		menu.newEntry({entryText: 'Merge-load playlists', func: () => {
			const zArr = [...indexes];
			if (zArr.length) {
				const remDupl = [];
				clonePlaylistMergeInUI(list, zArr);
			}
		}, flags: playlists.length < 2 || !bIsValidXSPEveryOnly ? MF_GRAYED : MF_STRING});
		menu.newEntry({entryText: 'Merge-load (no duplicates)', func: () => {
			const zArr = [...indexes];
			if (zArr.length) {
				const remDupl = list.removeDuplicatesAutoPls;
				clonePlaylistMergeInUI(list, zArr, remDupl, list.bAdvTitle);
			}
		}, flags: !bIsValidXSPEveryOnly ? MF_GRAYED : MF_STRING});
		// Clone in UI
		menu.newEntry({entryText: 'Clone playlists in UI', func: () => {
			indexes.forEach((z, i) => {
				const pls = playlists[i];
				if (pls.extension === '.xsp' && pls.hasOwnProperty('type') && pls.type !== 'songs') {return;}
				if (!isPlsUI(pls)) {
					if (pls.isAutoPlaylist) {
						const remDupl = (pls.isAutoPlaylist && list.bRemoveDuplicatesAutoPls) || (pls.extension === '.xsp' && list.bRemoveDuplicatesSmartPls) ? list.removeDuplicatesAutoPls : [];
						cloneAsStandardPls(list, z, remDupl, list.bAdvTitle, false);
					} else {
						clonePlaylistFile(list, z, '.ui');
					}
				}
			});
		}, flags: bIsPlsLoadedEvery || !bIsValidXSPEveryOnly ? MF_GRAYED : MF_STRING});
	}
	if (showMenus['Category'] || showMenus['Tags']) {menu.newEntry({entryText: 'sep'});}
	{	// Tags and category
		if (showMenus['Category']) {	// Set category
			const menuName = menu.newMenu('Set category...', void(0), !bIsLockPlsEvery && bIsPlsEditable ? MF_STRING : MF_GRAYED);
			menu.newEntry({menuName, entryText: 'New category...', func: () => {
				let category = '';
				try {category = utils.InputBox(window.ID, 'Category name (only 1):', window.Name, playlists[0].category !== null ? playlists[0].category : '', true);} 
				catch(e) {return;}
				indexes.forEach((z, i) => {
					const pls = playlists[i];
					if (!isLockPls(pls) && isPlsEditable(pls)) {
						if (pls.category !== category) {setCategory(category, list, z);}
					}
				});
			}});
			menu.newEntry({menuName, entryText: 'sep'});
			list.categories().forEach((category, i) => {
				const count =  playlists.reduce((total, pls) => {return (pls.category === (i === 0 ? '' : category) ? total + 1 : total);}, 0);
				const entryText = category + '\t' + _b(count);
				menu.newEntry({menuName, entryText, func: () => {
					indexes.forEach((z, j) => {
						const pls = playlists[j];
						if (!isLockPls(pls) && isPlsEditable(pls)) {
							if (pls.category !== category) {setCategory(i ? category : '', list, z);}
						}
					});
				}});
				menu.newCheckMenu(menuName, entryText, void(0), () => {return (playlists.length === count);});
			});
		}
		if (showMenus['Tags']) {	// Set tag(s)
			const menuName = menu.newMenu('Set playlist tag(s)...', void(0), !bIsLockPlsEvery &&  bIsPlsEditable ? MF_STRING : MF_GRAYED);
			menu.newEntry({menuName, entryText: 'New tag(s)...', func: () => {
				let tags = '';
				try {tags = utils.InputBox(window.ID, 'Tag(s) Name(s), multiple values separated by \';\' :', window.Name, playlists[0].tags.join(';'), true);} 
				catch(e) {return;}
				tags = tags.split(';').filter(Boolean); // This filters blank values
				indexes.forEach((z, i) => {
					const pls = playlists[i];
					if (!isLockPls(pls) && isPlsEditable(pls)) {
						if (!isArrayEqual(pls.tags, tags)) {setTag(tags, list, z);}
					}
				});
			}});
			menu.newEntry({menuName, entryText: 'sep'});
			let bAddInvisibleIds = false;
			list.tags().concat(['sep', ...autoTags]).forEach((tag, i) => {
				const count =  playlists.reduce((total, pls) => {return ((i === 0 ? pls.tags.length === 0 : pls.tags.includes(tag)) ? total + 1 : total);}, 0);
				if (tag === 'sep') {menu.newEntry({menuName, entryText: 'sep'}); bAddInvisibleIds = true; return;} // Add invisible id for entries after separator to duplicate check marks
				const entry = menu.newEntry({menuName, entryText: tag + '\t' + _b(count), func: () => {
					let tags;
					indexes.forEach((z, j) => {
						const pls = playlists[j];
						if (!isLockPls(pls) && isPlsEditable(pls)) {
							if (i === 0) {tags = [];}
							else if (pls.tags.indexOf(tag) !== -1) {tags = [...new Set(pls.tags).difference(new Set([tag]))];} 
							else {tags = [...pls.tags, tag];}
							setTag(tags, list, z);
						}
					});
				}, bAddInvisibleIds});
				menu.newCheckMenu(menuName, entry.entryText, void(0), () => {return (playlists.length === count);});
			});
		}
		if (showMenus['Tags']) {	// Adds track tag(s)
			menu.newEntry({entryText: 'Automatically add tag(s) to tracks...', func: () => {
				let tags = '';
				const currValue = playlists[0].trackTags && playlists[0].trackTags.length ? JSON.stringify(playlists[0].trackTags) : '';
				try {tags = utils.InputBox(window.ID, 'Enter data json-formatted: [{"tagName":"tagValue"}]\n\nTagValue may be:\n- String or number (doesn\'t need quotes).\n- TF expression applied to added track.\n- JS:+Function name (see helpers_xxx_utils.js).\n\nFor ex: [{"Mood":"Chill"}] or [{"Rating":5}]', window.Name, currValue, true);} 
				catch(e) {return;}
				const tagsString = tags;
				if (tags.length) {
					tags = tags.replaceAll('\'\'','"'); // Replace quotes
					try {tags = JSON.parse(tags);} catch(e){fb.ShowPopupMessage('Input is not a valid JSON:\n' + tags, window.Name); return;}
				}
				indexes.forEach((z, i) => {
					const pls = playlists[i];
					if (!isLockPls(pls) && isPlsEditable(pls)) {
						if (tagsString !== JSON.stringify(pls.trackTags)) {setTrackTags(tags, list, z);}
					}
				});
			}, flags: !bIsLockPlsEvery && bIsPlsEditable ? MF_STRING : MF_GRAYED});
		}
	}
	if (showMenus['Export and copy']) {menu.newEntry({entryText: 'sep'});}
	if (showMenus['Export and copy']) { // Export and Convert
		const flags = (bWritableFormat || bIsPlsUISome || bIsAutoPlsSome) && bIsValidXSPEvery ? MF_STRING : MF_GRAYED;
		{	// Copy
			menu.newEntry({entryText: 'Copy playlist files to...', func: () => {
				exportPlaylistFiles(list, indexes.filter((z) => list.data[z].path.length));
			}, flags});
		}
		{	// Export and copy
			menu.newEntry({entryText: 'Export and Copy Tracks to...', func: () => {
				let path = '';
				try {path = sanitizePath(utils.InputBox(window.ID, 'Enter destination path:\n(don\'t forget adding \\ to copy to subfolder)', window.Name, list.playlistsPath + 'Export\\', true));} 
				catch(e) {return;}
				if (!path.length) {return;}
				if (path === list.playlistsPath) {console.log('Playlist Manager: can\'t export playlist(s) to original path.'); return;}
				const bSubFolder = WshShell.Popup('Create a subfolder per playlist?', 0, window.Name, popup.question + popup.yes_no) === popup.yes;
				indexes.forEach((z, i) => {
					const plsPath = path + (bSubFolder ? list.data[z].name + '\\' : '');
					exportPlaylistFileWithTracks({list, z, bAsync: list.properties.bCopyAsync[1], bNoInput: true, defPath: plsPath, bOpenOnExport: false});
				});
				if (list.properties.bOpenOnExport[1]) {_explorer(path);}
			}, flags});
		}
		{	// Export
			const presets = JSON.parse(list.properties.converterPreset[1]);
			const subMenuName = menu.newMenu('Export and Convert Tracks to...', void(0), presets.length ? flags : MF_GRAYED);
			menu.newEntry({menuName: subMenuName, entryText: 'Select a preset:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			presets.forEach((preset) => {
				const path = preset.path;
				let pathName = (path.length ? '(' + path.split('\\')[0] +'\\) ' + path.split('\\').slice(-2, -1) : '(Folder)');
				const dsp = preset.dsp;
				let dspName = (dsp !== '...' ? dsp  : '(DSP)');
				const tf = preset.tf;
				let tfName = preset.hasOwnProperty('name') && preset.name.length ? preset.name : preset.tf;
				const extension = preset.hasOwnProperty('extension') && preset.extension.length ? preset.extension : '';
				const extensionName = extension.length ? '[' + extension + ']' : '';
				if (pathName.length > 20) {pathName = pathName.substr(0, 20) + '...';}
				if (dspName.length > 20) {dspName = dspName.substr(0, 20) + '...';}
				if (tfName.length > 40) {tfName = tfName.substr(0, 40) + '...';}
				menu.newEntry({menuName: subMenuName, entryText: pathName + extensionName + ': ' + dspName + ' ---> ' + tfName, func: () => {
					indexes.forEach((z, i) => {
						const pls = playlists[i];
						if (pls.extension === '.xsp' && pls.hasOwnProperty('type') && pls.type !== 'songs') {return;}
						if (writablePlaylistFormats.has(pls.extension) || isPlsUI(pls) || isAutoPls(pls)) {
							const remDupl = (pls.isAutoPlaylist && list.bRemoveDuplicatesAutoPls) || (pls.extension === '.xsp' && list.bRemoveDuplicatesSmartPls) ? list.removeDuplicatesAutoPls : [];
							if (!pls.isAutoPlaylist) {exportPlaylistFileWithTracksConvert(list, z, tf, dsp, path, extension, remDupl, list.bAdvTitle);} 
							else {exportAutoPlaylistFileWithTracksConvert(list, z, tf, dsp, path, extension, remDupl, list.bAdvTitle);}
						}
					});
				}, flags});
			});
		}
	}
	if (showMenus['File locks'] || showMenus['UI playlist locks'] || showMenus['Sorting'] && bManualSorting) {menu.newEntry({entryText: 'sep'});}
	{	// File management
		// Locks playlist file
		if (showMenus['File locks']) {
			menu.newEntry({entryText: !bIsLockPlsEvery ? 'Lock Playlist (read only)' : 'Unlock Playlist (writable)', func: () => {
				indexes.forEach((z, i) => {
					const pls = playlists[i];
					if (!isPlsUI(pls) && isLockPls(pls) === bIsLockPlsEvery) {switchLock(list, z);}
				});
			}, flags: bIsPlsLockable && !bIsPlsUIEvery ? MF_STRING : MF_GRAYED});
		}
		// Locks UI playlist
		if (showMenus['UI playlist locks']) {
			if (bIsPlsUISome || bIsPlsLoadedSome) {
				const lockTypes = [
					{type: 'AddItems', entryText: 'Adding items'},
					{type: 'RemoveItems', entryText: 'Removing items'},
					{type: 'ReplaceItems', entryText: 'Replacing items'},
					{type: 'ReorderItems', entryText: 'Sorting items'},
					{type: 'RenamePlaylist', entryText: 'Renaming playlist'},
					{type: 'RemovePlaylist', entryText: 'Deleting playlist'},
					{type: 'ExecuteDefaultAction', entryText: 'Default action'}
				];
				let bSMPLock = false, lockName = new Set();
				playlistsLoaded.forEach((pls, i) => {
					const index = plman.FindPlaylist(pls.nameId);
					const currentLocks = new Set(plman.GetPlaylistLockedActions(index) || []);
					const lockNamePls = plman.GetPlaylistLockName(index);
					if (!bSMPLock) {bSMPLock = (lockNamePls === 'foo_spider_monkey_panel' || !lockNamePls);}
					if (!bSMPLock) {lockName.add(lockNamePls);}
				});
				lockName =  [...lockName][0] + (lockName.size > 1 ?  ' & ...' : '');
				const flags = bSMPLock ? MF_STRING: MF_GRAYED;
				const subMenuName = menu.newMenu('Edit UI Playlist lock...');
				menu.newEntry({menuName: subMenuName, entryText: 'Lock by action:' + (!bSMPLock ? '\t' + _p(lockName) : ''), flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				lockTypes.forEach((lock) => {
					menu.newEntry({menuName: subMenuName, entryText: lock.entryText, func: () => {
						const report = [];
						playlistsLoaded.forEach((pls, i) => {
							const index = plman.FindPlaylist(pls.nameId);
							const currentLocks = new Set(plman.GetPlaylistLockedActions(index) || []);
							const lockName = plman.GetPlaylistLockName(index);
							const bSMPLock = lockName === 'foo_spider_monkey_panel' || !lockName;
							if (bSMPLock) {
								if (currentLocks.has(lock.type)) {
									currentLocks.delete(lock.type);
								} else {
									currentLocks.add(lock.type);
								}
								plman.SetPlaylistLockedActions(index, [...currentLocks]);
							} else {
								report.push('\t- ' + pls.nameId + ': ' + lockName)
							}
						});
						if (report.length) {
							fb.ShowPopupMessage('These playlists can not be changed since lock is set by another component:\n' + report.join('\n'), window.Name);
						}
					}, flags});
					menu.newCheckMenu(subMenuName, lock.entryText, void(0), () => {
						return playlistsLoaded.every((pls, i) => {
							const index = plman.FindPlaylist(pls.nameId);
							const currentLocks = new Set(plman.GetPlaylistLockedActions(index) || []);
							return currentLocks.has(lock.type);
						});
					});
				});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'All locks', func: () => {
					const report = [];
					playlistsLoaded.forEach((pls, i) => {
						const index = plman.FindPlaylist(pls.nameId);
						const currentLocks = new Set(plman.GetPlaylistLockedActions(index) || []);
						const lockName = plman.GetPlaylistLockName(index);
						const bSMPLock = lockName === 'foo_spider_monkey_panel' || !lockName;
						if (bSMPLock) {
							plman.SetPlaylistLockedActions(index, lockTypes.map((lock) => lock.type));
						} else {
							report.push('\t- ' + pls.nameId + ': ' + lockName)
						}
					});
					if (report.length) {
						fb.ShowPopupMessage('These playlists can not be changed since lock is set by another component:\n' + report.join('\n'), window.Name);
					}
				}, flags});
				menu.newEntry({menuName: subMenuName, entryText: 'None', func: () => {
					const report = [];
					playlistsLoaded.forEach((pls, i) => {
						const index = plman.FindPlaylist(pls.nameId);
						const currentLocks = new Set(plman.GetPlaylistLockedActions(index) || []);
						const lockName = plman.GetPlaylistLockName(index);
						const bSMPLock = lockName === 'foo_spider_monkey_panel' || !lockName;
						if (bSMPLock) {
							plman.SetPlaylistLockedActions(index, []);
						} else {
							report.push('\t- ' + pls.nameId + ': ' + lockName)
						}
					});
					if (report.length) {
						fb.ShowPopupMessage('These playlists can not be changed since lock is set by another component:\n' + report.join('\n'), window.Name);
					}
				}, flags});
			}
		}
		
		if (showMenus['Sorting'] && bManualSorting) {
			menu.newEntry({entryText: 'sep'});
			const subMenuName = menu.newMenu('Sorting...');
			menu.newEntry({menuName: subMenuName, entryText: 'Manual sorting:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			const options = [
				{name: 'Up', idx: (i) => i - 1},
				{name: 'Down', idx: (i) => i + 1},
				{name: 'sep'},
				{name: 'Send to top', idx: 0},
				{name: 'Send to bottom', idx: Infinity},
				
			];
			options.forEach((opt) => {
				if (opt.name === 'sep') {menu.newEntry({menuName: subMenuName, entryText: 'sep', flags: MF_GRAYED}); return;}
				menu.newEntry({menuName: subMenuName, entryText: opt.name, func: () => list.setManualSortingForPls(playlists, opt.idx)});
			});
		}
		if (showMenus['File management']) {
			menu.newEntry({entryText: 'sep'});
			// Deletes playlist file and playlist loaded
			menu.newEntry({entryText: 'Delete', func: () => {
				playlists.forEach((pls, i) => {
					// Index change on every removal so it has to be recalculated
					const z = list.data.indexOf(pls);
					if (z !== -1) {list.removePlaylist(z);}
				});
				this.indexes.length = 0; // Reset selection since there is no playlists now
			}});
		}
	}
	return menu;
}

function createMenuRight() {
	// Constants
	const menu = menuRbtn;
	menu.clear(true); // Reset one every call
	const bListenBrainz = list.properties.lBrainzToken[1].length > 0;
	const lb = listenBrainz;
	// Enabled menus
	const showMenus = JSON.parse(list.properties.showMenus[1]);
	// Entries
	{ // New Playlists
		!list.bLiteMode && menu.newEntry({entryText: 'New Playlist File...', func: () => {list.add({bEmpty: true});}});
			menu.newEntry({entryText: 'New AutoPlaylist...', func: () => {list.addAutoplaylist();}});
		!list.bLiteMode && menu.newEntry({entryText: 'New Smart Playlist...', func: () => {list.addSmartplaylist();}});
		menu.newEntry({entryText: 'New UI-only Playlist...', func: () => {list.addUIplaylist({bInputName: true});}});
		if (showMenus['Folders']) {
			menu.newEntry({entryText: 'sep'});
			menu.newEntry({entryText: 'New Folder...', func: () => {list.addFolder();}});
		}
		menu.newEntry({entryText: 'sep'});
		menu.newEntry({entryText: 'New playlist from active...', func: () => {list.add({bEmpty: false});}, flags: plman.ActivePlaylist !== -1 ? MF_STRING : MF_GRAYED});
		if (plman.ActivePlaylist !== -1 && plman.IsAutoPlaylist(plman.ActivePlaylist)) {
			menu.newEntry({entryText: 'New AutoPlaylist from active ...', func: () => {
				const pls = {name: plman.GetPlaylistName(plman.ActivePlaylist)};
				plman.ShowAutoPlaylistUI(plman.ActivePlaylist); // Workaround to not being able to access AutoPlaylist data... user must copy/paste
				list.addAutoplaylist(pls, true);
			}, flags: plman.ActivePlaylist !== -1 ? MF_STRING : MF_GRAYED});
		}
		menu.newEntry({entryText: 'New playlist from selection...', func: () => {
			const oldIdx = plman.ActivePlaylist;
			if (oldIdx === -1) {return;}
			const pls = list.add({bEmpty: true, name: list.generateTitleFromSelection(), bInputName: true});
			if (pls) {
				const playlistIndex = list.getPlaylistsIdxByObj([pls])[0];
				const newIdx = plman.ActivePlaylist;
				plman.ActivePlaylist = oldIdx;
				const bSucess = list.sendSelectionToPlaylist({playlistIndex, bCheckDup: true, bAlsoHidden: true, bPaint: false, bDelSource: false});
				// Don't reload the list but just paint with changes to avoid jumps
				plman.ActivePlaylist = newIdx;
				list.showCurrPls();
			}
		}, flags: plman.ActivePlaylist !== -1 ? MF_STRING : MF_GRAYED});
		if (showMenus['Online sync']) {
			menu.newEntry({entryText: 'Import from ListenBrainz...' + (bListenBrainz ? '' : '\t(token not set)'), func: async () => {
				if (!await checkLBToken()) {return Promise.resolve(false);}
				let bDone = false;
				let playlist_mbid = '';
				try {playlist_mbid = utils.InputBox(window.ID, 'Enter Playlist MBID:', window.Name, menu.cache.playlist_mbid || '', true);}
				catch (e) {bDone = true;}
				playlist_mbid = playlist_mbid.replace(lb.regEx, ''); // Allow web link too
				if (playlist_mbid.length) {
					menu.cache.playlist_mbid = playlist_mbid;
					const token = bListenBrainz ? lb.decryptToken({lBrainzToken: list.properties.lBrainzToken[1], bEncrypted: list.properties.lBrainzEncrypt[1]}) : null;
					if (!token) {return Promise.resolve(false);}
					pop.enable(true, 'Importing...', 'Importing tracks from ListenBrainz...\nPanel will be disabled during the process.');
					lb.importPlaylist({playlist_mbid}, token)
						.then((jspf) => {
							if (jspf) {
								let bXSPF = false;
								if (list.playlistsExtension !== '.xspf') {
									const answer = WshShell.Popup('Save as .xspf format?\n(Items not found on library will be kept)', 0, window.Name, popup.question + popup.yes_no);
									if (answer === popup.yes) {bXSPF = true;}
								} else {bXSPF = true;}
								const data = lb.contentResolver(jspf);
								const handleArr = data.handleArr;
								const notFound = data.notFound;
								const playlist = jspf.playlist;
								const useUUID = list.optionsUUIDTranslate();
								const playlistName = playlist.title;
								const playlistNameId = playlistName + (list.bUseUUID ? nextId(useUUID, false) : '');
								const category = list.categoryState.length === 1 && list.categoryState[0] !== list.categories(0) ? list.categoryState[0] : '';
								const tags = ['ListenBrainz'];
								const author = playlist.extension['https://musicbrainz.org/doc/jspf#playlist'].creator;
								if (list.bAutoLoadTag) {tags.push('bAutoLoad');}
								if (list.bAutoLockTag) {tags.push('bAutoLock');}
								if (list.bMultMenuTag) {tags.push('bMultMenu');}
								if (list.bAutoCustomTag) {list.autoCustomTag.forEach((tag) => {if (! new Set(tags).has(tag)) {tags.push(tag);}});}
								if (!bXSPF) {
									let bYouTube = false;
									if (notFound.length && isYouTube) {
										const answer = WshShell.Popup('Some imported tracks have not been found on library (see console).\nDo you want to replace them with YouTube links?\n(Pressing \'No\' will omit not found items)?', 0, window.Name, popup.question + popup.yes_no);
										if (answer === popup.yes) {bYouTube = true;}
									}
									const playlistPath = list.playlistsPath + sanitize(playlistName) + list.playlistsExtension;
									const backPath = playlistPath + '.back';
									// Find missing tracks on youtube
									if (bYouTube) {
										pop.enable(false, 'YouTube...', 'Importing tracks from YouTube...\nPanel will be disabled during the process.');
										list.disableAutosaveForPls(playlistNameId);
										// Add MBIDs to youtube track metadata
										notFound.forEach((track) => track.tags = {musicbrainz_trackid: track.identifier});
										// Send request in parallel every x ms and process when all are done
										return Promise.parallel(notFound, youtube.searchForYoutubeTrack, 5).then((results) => {
											let j = 0;
											const itemsLen = handleArr.length;
											let foundLinks = 0;
											results.forEach((result, i) => {
												for (void(0); j <= itemsLen; j++) {
													if (result.status !== 'fulfilled') {break;}
													const link = result.value;
													if (!link || !link.length) {break;}
													if (!handleArr[j]) {
														handleArr[j] = link.url;
														foundLinks++;
														break;
													}
												}
											});
											const bLoaded = plman.FindPlaylist(playlistNameId) !== -1;
											const idx = plman.FindOrCreatePlaylist(playlistNameId, true);
											plman.ClearPlaylist(idx);
											return plman.AddPlaylistItemsOrLocations(idx, handleArr.filter(Boolean), true)
												.finally(() => {
													plman.ActivePlaylist = idx;
													const handleList = plman.GetPlaylistItems(idx);
													console.log('Found ' + foundLinks + ' tracks on YouTube');
													const delay = setInterval(delayAutoUpdate, list.autoUpdateDelayTimer);
													if (_isFile(playlistPath)) {
														let answer = WshShell.Popup('There is a playlist with same name/path.\nDo you want to overwrite it?.', 0, window.Name, popup.question + popup.yes_no);
														if (answer === popup.no) {return false;}
														_renameFile(playlistPath, backPath);
													}
													bDone = savePlaylist({handleList, playlistPath, ext: list.playlistsExtension, playlistName, category, tags, playlist_mbid, author: author + ' - Playlist-Manager-SMP', description: playlist.description, useUUID, bBOM: list.bBOM, relPath: (list.bRelativePath ? list.playlistsPath : '')});
													// Restore backup in case something goes wrong
													if (!bDone) {console.log('Failed saving playlist: ' + playlistPath); _deleteFile(playlistPath); _renameFile(backPath, playlistPath);}
													else if (_isFile(backPath)) {_deleteFile(backPath);}
													if (bDone) {list.update(false, true, list.lastIndex); list.filter();}
													if (bDone && !bLoaded) {plman.RemovePlaylist(idx);}
													clearInterval(delay);
													list.enableAutosaveForPls(playlistNameId);
													return bDone;
												});
										});
									} else {
										const handleList = data.handleList;
										const delay = setInterval(delayAutoUpdate, list.autoUpdateDelayTimer);
										if (_isFile(playlistPath)) {
											let answer = WshShell.Popup('There is a playlist with same name/path.\nDo you want to overwrite it?.', 0, window.Name, popup.question + popup.yes_no);
											if (answer === popup.no) {return false;}
											_renameFile(playlistPath, backPath);
										}
										bDone = savePlaylist({handleList, playlistPath, ext: list.playlistsExtension, playlistName, category, tags, playlist_mbid, author: author + ' - Playlist-Manager-SMP', description: playlist.description, useUUID, bBOM: list.bBOM, relPath: (list.bRelativePath ? list.playlistsPath : '')});
										// Restore backup in case something goes wrong
										if (!bDone) {console.log('Failed saving playlist: ' + playlistPath); _deleteFile(playlistPath); _renameFile(backPath, playlistPath);}
										else if (_isFile(backPath)) {_deleteFile(backPath);}
										list.disableAutosaveForPls(playlistNameId);
										const idx = bDone ? plman.FindOrCreatePlaylist(playlistNameId, true) : -1;
										if (bDone && idx !== -1) {sendToPlaylist(handleList, playlistNameId);}
										if (bDone) {list.update(false, true, list.lastIndex); list.filter();}
										clearInterval(delay);
										list.enableAutosaveForPls(playlistNameId);
										return bDone;
									}
								} else {
									let totalDuration = 0;
									playlist.creator = author + ' - Playlist-Manager-SMP';
									playlist.info = 'https://listenbrainz.org/user/' + author + '/playlists/';
									playlist.location = playlist.identifier;
									playlist.meta = [
										{uuid: (useUUID ? nextId(useUUID) : '')},
										{locked: true},
										{category},
										{tags: (isArrayStrings(tags) ? tags.join(';') : '')},
										{trackTags: ''},
										{playlistSize: playlist.track.length},
										{duration: totalDuration},
										{playlist_mbid}
									];
									// Tracks text
									handleArr.forEach((handle, i) => {
										if (!handle) {return;}
										const relPath = '';
										const tags = getTagsValuesV4(new FbMetadbHandleList(handle), ['TITLE', 'ARTIST', 'ALBUM', 'TRACK', 'LENGTH_SECONDS_FP', '_PATH_RAW', 'SUBSONG', 'MUSICBRAINZ_TRACKID']);
										const title = tags[0][0][0];
										const creator = tags[1][0].join(', ');
										const album = tags[2][0][0];
										const trackNum = Number(tags[3][0][0]);
										const duration = Math.round(Number(tags[4][0][0] * 1000)); // In ms
										totalDuration += Math.round(Number(tags[4][0][0])); // In s
										const location = [relPath.length && !_isLink(tags[5][0][0]) ? getRelPath(tags[5][0][0], relPathSplit) : tags[5][0][0]]
											.map((path) => {
												return encodeURI(path.replace('file://', 'file:///').replace(/\\/g,'/').replace(/&/g,'%26'));
											});
										const subSong = Number(tags[6][0][0]);
										const meta = location[0].endsWith('.iso') ? [{subSong}] : [];
										const identifier = [tags[7][0][0]];
										playlist.track[i] = {
											location,
											annotation: void(0),
											title,
											creator,
											info: void(0),
											image: void(0),
											album,
											duration,
											trackNum,
											identifier,
											extension: {},
											link: [],
											meta
										};
									});
									// Fix JSPF identifiers as array
									playlist.track.forEach((track) => {
										if (!Array.isArray(track.identifier)) {track.identifier = [track.identifier];}
									});
									// Update total duration of playlist
									playlist.meta.find((obj) => {return obj.hasOwnProperty('duration');}).duration = totalDuration;
									const playlistPath = list.playlistsPath + sanitize(playlist.title) + '.xspf';
									const playlistNameId = playlist.title + (list.bUseUUID ? nextId(useUUID, false) : '');
									let xspf = XSPF.toXSPF(jspf);
									const delay = setInterval(delayAutoUpdate, list.autoUpdateDelayTimer);
									xspf = xspf.join('\r\n');
									bDone = _save(playlistPath, xspf, list.bBOM);
									// Check
									if (_isFile(playlistPath) && bDone) {bDone = (_open(playlistPath, utf8) === xspf);}
									// Restore backup in case something goes wrong
									const backPath = playlistPath + '.back';
									if (!bDone) {console.log('Failed saving playlist: ' + playlistPath); _deleteFile(playlistPath); _renameFile(backPath, playlistPath);}
									else if (_isFile(backPath)) {_deleteFile(backPath);}
									if (bDone && plman.FindPlaylist(playlistNameId) !== -1) {sendToPlaylist(new FbMetadbHandleList(handleArr.filter((n) => n)), playlistNameId);}
									if (bDone) {list.update(false, true, list.lastIndex); list.filter()}
									clearInterval(delay);
									return bDone;
								}
							} else {return bDone;}
						})
						.finally(() => {
							if (!bDone) {lb.consoleError('Playlist was not imported.');}
							if (pop.isEnabled()) {pop.disable(true);}
							return bDone;
						});
				} else {return Promise.resolve(true);}
			}, flags: bListenBrainz ? MF_STRING : MF_GRAYED});
		}
	}
	menu.newEntry({entryText: 'sep'});
	{	// File management
		if (!list.bLiteMode) {	// Refresh
			menu.newEntry({entryText: 'Manual refresh', func: list.manualRefresh});
		}
		{	// Restore
			const bBin = _hasRecycleBin(list.playlistsPath.match(/^(.+?:)/g)[0]);
			const bItems = (list.deletedItems.length + plman.PlaylistRecycler.Count) > 0;
			const subMenuName = menu.newMenu('Restore...' + (!bBin ? ' [missing recycle bin]' : ''), void(0), bItems ? MF_STRING : MF_GRAYED);
			menu.newEntry({menuName: subMenuName, entryText: 'Restore UI-only playlists or files:', flags: MF_GRAYED});
			if (list.deletedItems.length > 0 && bBin) {
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				list.deletedItems.slice(0, 8).forEach((item, i) => {
					if (item.extension === '.ui') {return;}
					menu.newEntry({menuName: subMenuName, entryText: item.name + '\t(file)', func: () => {
						list.addToData(item);
						// Add new category to current view! (otherwise it gets filtered)
						// Easy way: intersect current view + new one with refreshed list
						const categoryState = [...new Set(list.categoryState.concat(item.category)).intersection(new Set(list.categories()))];
						if (item.isAutoPlaylist) {
							list.update(true, true); // Only paint and save to json
						} else if(item.extension === '.ui') {
							for (let j = 0; j < plman.PlaylistRecycler.Count; j++) { // First pls is the last one deleted
								if (plman.PlaylistRecycler.GetName(j) === item.nameId) {
									const size = plman.PlaylistRecycler.GetContent(j).Count;
									if (size === item.size) { // Must match on size and name to avoid restoring another pls with same name
										plman.PlaylistRecycler.Restore(j);
										break;
									}
								}
							}
							list.update(true, true); // Only paint and save to json
						} else {
							_restoreFile(item.path);
							// Revert timestamps
							let newPath = item.path.split('.').slice(0,-1).join('.').split('\\');
							const newName = newPath.pop().split('_ts_')[0];
							newPath = newPath.concat([newName]).join('\\') + item.extension;
							_renameFile(item.path, newPath);
							list.update(false, true); // Updates path..
						}
						list.filter({categoryState});
						list.deletedItems.splice(i, 1);
					}});
				});
			}
			if (bItems) {menu.newEntry({menuName: subMenuName, entryText: 'sep'});}
			if (plman.PlaylistRecycler.Count > 0) {
				const deletedItems = [];
				for (let i = 0; i < plman.PlaylistRecycler.Count; i++) {deletedItems.push(plman.PlaylistRecycler.GetName(i));}
				deletedItems.slice(0, 8).forEach((entryText, i) => {
					menu.newEntry({menuName: subMenuName, entryText: entryText + '\t(UI)', func: () => {
						plman.PlaylistRecycler.Restore(i);
					}});
				});
			}
		}
		menu.newEntry({entryText: 'sep'});
		{	// Import json
			menu.newEntry({entryText: 'Add playlists from json file...', func: () => {
				list.bUpdateAutoplaylist = true; // Forces AutoPlaylist size update according to query and tags
				list.loadExternalJson();
			}});
			menu.newEntry({entryText: 'Export playlists as json file...', func: () => {
				let answer = WshShell.Popup('Export only AutoPlaylists (yes) or both AutoPlaylists and other playlists -.fpl & .xsp- (no)?', 0, window.Name, popup.question + popup.yes_no);
				const path = list.exportJson({idx: -1, bAllExt: answer === popup.yes ? false : true},); // All
				if (_isFile(path)) {_explorer(path);}
			}});
		}
	}
	menu.newEntry({entryText: 'sep'});
	{	// Maintenance tools
		const subMenuName = menu.newMenu('Playlists maintenance tools');
		menu.newEntry({menuName: subMenuName, entryText: 'Perform checks on all playlists:', flags: MF_GRAYED});
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		if (!list.bLiteMode) {	// Absolute/relative paths consistency
			menu.newEntry({menuName: subMenuName, entryText: 'Absolute/relative paths...', func: () => {
				let answer = WshShell.Popup('Scan all playlists to check if any of them has absolute and relative paths in the same file. That probably leads to unexpected results when using those playlists in other enviroments.\nDo you want to continue?', 0, window.Name, popup.question + popup.yes_no);
				if (answer !== popup.yes) {return;}
				if (!pop.isEnabled()) {pop.enable(true, 'Checking...', 'Checking absolute/relative paths...\nPanel will be disabled during the process.');}
				findMixedPaths().then(({found, report}) => {
					if (found.length) {list.filter({plsState: found});}
					fb.ShowPopupMessage('Found these playlists with mixed relative and absolute paths:\n\n' + (report.length ? report.join('\n') : 'None.'), window.Name);
					pop.disable(true);
				});
			}});
		}
		if (!list.bLiteMode) {	// External items
			menu.newEntry({menuName: subMenuName, entryText: 'External items...', func: () => {
				let answer = WshShell.Popup('Scan all playlists to check for external items (i.e. items not found on library but present on their paths).\nDo you want to continue?', 0, window.Name, popup.question + popup.yes_no);
				if (answer !== popup.yes) {return;}
				if (!pop.isEnabled()) {pop.enable(true, 'Searching...', 'Searching external items...\nPanel will be disabled during the process.');}
				findExternal().then(({found, report}) => {
					if (found.length) {list.filter({plsState: found});}
					fb.ShowPopupMessage('Found these playlists with items not present on library:\n\n' + (report.length ? report.join('\n') : 'None.'), window.Name);
					pop.disable(true);
				});
			}});
		}
		{	// Dead items
			menu.newEntry({menuName: subMenuName, entryText: 'Dead items...', func: () => {
				let answer = WshShell.Popup('Scan all playlists to check for dead items (i.e. items that don\'t exist in their path).\nDo you want to continue?', 0, window.Name, popup.question + popup.yes_no);
				if (answer !== popup.yes) {return;}
				if (!pop.isEnabled()) {pop.enable(true, 'Searching...', 'Searching dead items...\nPanel will be disabled during the process.');}
				findDead().then(({found, report}) => {
					if (found.length) {list.filter({plsState: found});}
					fb.ShowPopupMessage('Found these playlists with dead items:\n\n' + (report.length ? report.join('\n') : 'None.'), window.Name);
					pop.disable(true);
				});
			}});
		}
		{	// Duplicates
			menu.newEntry({menuName: subMenuName, entryText: 'Duplicated items...', func: () => {
				let answer = WshShell.Popup('Scan all playlists to check for duplicated items (i.e. items that appear multiple times in a playlist).\nDo you want to continue?', 0, window.Name, popup.question + popup.yes_no);
				if (answer !== popup.yes) {return;}
				if (!pop.isEnabled()) {pop.enable(true, 'Searching...', 'Searching duplicated items...\nPanel will be disabled during the process.');}
				findDuplicates().then(({found, report}) => {
					if (found.length) {list.filter({plsState: found});}
					fb.ShowPopupMessage('Found these playlists with duplicated items:\n\n' + (report.length ? report.join('\n') : 'None.'), window.Name);
					pop.disable(true);
				});
			}});
		}
		if (!list.bLiteMode) {	// Size mismatch
			menu.newEntry({menuName: subMenuName, entryText: 'Playlist size mismatch...', func: () => {
				let answer = WshShell.Popup('Scan all playlists to check for reported playlist size not matching number of tracks.', 0, window.Name, popup.question + popup.yes_no);
				if (answer !== popup.yes) {return;}
				if (!pop.isEnabled()) {pop.enable(true, 'Checking...', 'Checking playlist size mismatch...\nPanel will be disabled during the process.');}
				findSizeMismatch().then(({found, report}) => {
					if (found.length) {list.filter({plsState: found});}
					fb.ShowPopupMessage('Found these playlists with size mismatch:\n\n' + (report.length ? report.join('\n') : 'None.'), window.Name);
					pop.disable(true);
				});
			}});
		}
		if (!list.bLiteMode) {	// Duration mismatch
			menu.newEntry({menuName: subMenuName, entryText: 'Playlist duration mismatch...', func: () => {
				let answer = WshShell.Popup('Scan all playlists to check for reported playlist duration not matching duration of tracks.', 0, window.Name, popup.question + popup.yes_no);
				if (answer !== popup.yes) {return;}
				if (!pop.isEnabled()) {pop.enable(true, 'Checking...', 'Checking playlist duration mismatch...\nPanel will be disabled during the process.');}
				findDurationMismatch().then(({found, report}) => {
					if (found.length) {list.filter({plsState: found});}
					fb.ShowPopupMessage('Found these playlists with duration mismatch:\n\n' + (report.length ? report.join('\n') : 'None.'), window.Name);
					pop.disable(true);
				});
			}});
		}
		if (!list.bLiteMode) {	// Blank Lines
			menu.newEntry({menuName: subMenuName, entryText: 'Blank lines...', func: () => {
				let answer = WshShell.Popup('Scan all playlists to check for blank lines (it may break playlist on other players).', 0, window.Name, popup.question + popup.yes_no);
				if (answer !== popup.yes) {return;}
				if (!pop.isEnabled()) {pop.enable(true, 'Checking...', 'Checking blank lines...\nPanel will be disabled during the process.');}
				findBlank().then(({found, report}) => {
					if (found.length) {list.filter({plsState: found});}
					fb.ShowPopupMessage('Found these playlists with blank lines:\n\n' + (report.length ? report.join('\n') : 'None.'), window.Name);
					pop.disable(true);
				});
			}});
		}
		{	// Subsong items
			menu.newEntry({menuName: subMenuName, entryText: 'Subsong items...', func: () => {
				let answer = WshShell.Popup('Scan all playlists to check for items associated by \'Subsong index\' -for ex. ISO files- (it may break playlist on other players).', 0, window.Name, popup.question + popup.yes_no);
				if (answer !== popup.yes) {return;}
				if (!pop.isEnabled()) {pop.enable(true, 'Checking...', 'Checking subsong items...\nPanel will be disabled during the process.');}
				findSubSongs().then(({found, report}) => {
					if (found.length) {list.filter({plsState: found});}
					fb.ShowPopupMessage('Found these playlists with subsong items:\n\n' + (report.length ? report.join('\n') : 'None.'), window.Name);
					pop.disable(true);
				});
			}});
		}
		if (!list.bLiteMode) {	// Format specific errors
			menu.newEntry({menuName: subMenuName, entryText: 'Format specific errors...', func: () => {
				let answer = WshShell.Popup('Scan all playlists to check for errors on playlist structure or format.', 0, window.Name, popup.question + popup.yes_no);
				if (answer !== popup.yes) {return;}
				if (!pop.isEnabled()) {pop.enable(true, 'Checking...', 'Checking fprmat errors...\nPanel will be disabled during the process.');}
				findFormatErrors().then(({found, report}) => {
					if (found.length) {list.filter({plsState: found});}
					fb.ShowPopupMessage('Found these playlists with format errors:\n\n' + (report.length ? report.join('\n') : 'None.'), window.Name);
					pop.disable(true);
				});
			}});
		}
	}
	menu.newEntry({entryText: 'sep'});
	{	// Find selection
		menu.newEntry({entryText: 'Find current selection...', func: () => {
			const found = [];
			for (let i = 0; i < list.itemsAll; i++) {
				if (list.checkSelectionDuplicatesPlaylist({playlistIndex: i, bAlsoHidden: true})) {
					found.push({name: list.dataAll[i].name, category: list.dataAll[i].category});
				}
			}
			found.sort((a, b) => a.category.localeCompare(b.category));
			for (let i = 0, prevCat = null; i < found.length; i++) {
				if (prevCat !== found[i].category) {prevCat = found[i].category; found.splice(i, 0, found[i].category);}
			}
			for (let i = 0; i < found.length; i++) {
				if (found[i].name) {
					found[i] = '\t- ' + found[i].name;
				} else {
					found[i] = (found[i] || 'No category') + ':';
				}
			}
			fb.ShowPopupMessage('In case of multiple selection, a single track match will be enough\nto show a playlist. So not all results will contain all tracks.\n\nHint: Use playlist search (Ctrl + F) to find items on loaded playlists.\n\nSelected tracks found on these playlists: [Category:] - Playlist\n\n' + (found.length ? found.join('\n') : 'None.'), window.Name);
		}});
	}
	return menu;
}

function createMenuRightTop() {
	// Constants
	const z = (list.index !== -1) ? list.index : list.getCurrentItemIndex();
	const menu = menuRbtnTop;
	menu.clear(true); // Reset one every call
	const bListenBrainz = list.properties.lBrainzToken[1].length > 0;
	const lb = listenBrainz;
	// Enabled menus
	const showMenus = JSON.parse(list.properties.showMenus[1]);
	// Entries
	if (!list.bLiteMode) {	// Playlist folder
		menu.newEntry({entryText: 'Set playlists folder...', func: () => {
			let input = '';
			try {input = sanitizePath(utils.InputBox(window.ID, 'Enter path of tracked folder:', window.Name, list.properties['playlistPath'][1], true));}
			catch (e) {return;}
			if (!input.length) {return;}
			if (input === list.playlistsPath) {return;}
			if (!input.endsWith('\\')) {input += '\\';}
			let bDone = _isFolder(input);
			if (!bDone) {bDone = _createFolder(input);}
			if (!bDone) {
				fb.ShowPopupMessage('Path can not be found or created:\n\'' + input + '\'', window.Name);
				return;
			}
			// Update property to save between reloads
			list.properties['playlistPath'][1] = input;
			list.playlistsPath = input.startsWith('.') ? findRelPathInAbsPath(input) : input;
			list.playlistsPathDirName = list.playlistsPath.split('\\').filter(Boolean).pop();
			list.playlistsPathDisk = list.playlistsPath.split('\\').filter(Boolean)[0].replace(':','').toUpperCase();
			if (mappedDrives.indexOf(list.playlistsPath.match(/^(.+?:)/g)[0]) !== -1) {
				if (!list.properties['bNetworkPopup'][1]) {list.properties['bNetworkPopup'][1] = true;}
				const file = folders.xxx + 'helpers\\readme\\playlist_manager_network.txt';
				const readme = _open(file, utf8);
				fb.ShowPopupMessage(readme, window.Name);
			} else {list.properties['bNetworkPopup'][1] = false;}
			overwriteProperties(list.properties);
			bDone = list.checkConfig();
			let test = new FbProfiler(window.Name + ': ' + 'Manual refresh');
			list.headerTextUpdate();
			list.bUpdateAutoplaylist = true; 
			list.update(void(0), true, z); // Forces AutoPlaylist size update according to query and tags
			list.checkConfigPostUpdate(bDone);
			list.filter();
			test.Print();
			// Tracking network drive?
			window.Repaint();
			window.Reload();
		}});
		menu.newEntry({entryText: 'Open playlists folder', func: () => {_explorer(list.playlistsPath);}});
		menu.newEntry({entryText: 'sep'});
	}
	if (showMenus['Category']) {	// Category Filter
		const subMenuName = menu.newMenu('Categories shown...');
		const options = list.categories();
		const defOpt = options[0];
		const optionsLength = options.length;
		menu.newEntry({menuName: subMenuName, entryText: 'Toogle (click) / Single (Shift + click):', func: null, flags: MF_GRAYED});
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		menu.newEntry({menuName: subMenuName, entryText: 'Restore all', func: () => {
			list.filter({categoryState: options});
		}});
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		const iInherit = (list.categoryState.length === 1 && list.categoryState[0] !== defOpt ? options.indexOf(list.categoryState[0]) : -1);
		options.forEach((item, i) => {
			const count =  list.data.reduce((total, pls) => {return (pls.category === (i === 0 ? '' : item) ? total + 1 : total);}, 0);
			menu.newEntry({menuName: subMenuName, entryText: item + '\t' + (i === iInherit ? '-inherit- ' : '') + _b(count), func: () => {
				let categoryState;
				// Disable all other tags when pressing shift
				if (utils.IsKeyPressed(VK_SHIFT)) {
					categoryState = [item];
				} else {
					categoryState = list.categoryState.indexOf(item) !== -1 ? list.categoryState.filter((categ) => {return categ !== item;}) : (item === defOpt ? [defOpt, ...list.categoryState] : list.categoryState.concat([item]).sort());
				}
				list.filter({categoryState});
			}});
			menu.newCheckMenu(subMenuName, item, void(0), () => {return list.categoryState.indexOf(item) !== -1;});
		});
	}
	if (showMenus['Tags']) {	// Tag Filter
		const subMenuName = menu.newMenu('Tags shown...');
		const options = list.tags();
		const defOpt = options[0];
		const optionsLength = options.length;
		menu.newEntry({menuName: subMenuName, entryText: 'Toogle (click) / Single (Shift + click):', func: null, flags: MF_GRAYED});
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		menu.newEntry({menuName: subMenuName, entryText: 'Restore all', func: () => {
			list.filter({tagState: options});
		}});
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		const bDef = list.tagState.indexOf(defOpt) !== -1;
		options.forEach((item, i) => {
			const bInherit = !bDef && list.tagState.indexOf(item) !== -1;
			const count =  list.data.reduce((total, pls) => {return ((i === 0 ? pls.tags.length === 0 : pls.tags.includes(item)) ? total + 1 : total);}, 0);
			menu.newEntry({menuName: subMenuName, entryText: item + '\t' + (bInherit && i !== 0 ? '-inherit- ' : '') + _b(count), func: () => {
				let tagState;
				// Disable all other categories when pressing shift
				if (utils.IsKeyPressed(VK_SHIFT)) {
					tagState = [item];
				} else {
					tagState = list.tagState.indexOf(item) !== -1 ? list.tagState.filter((tag) => {return tag !== item;}) : (item === defOpt ? [defOpt, ...list.tagState] : list.tagState.concat([item]).sort());
				}
				list.filter({tagState});
			}});
			menu.newCheckMenu(subMenuName, item, void(0), () => {return list.tagState.indexOf(item) !== -1;});
		});
	}
	if (showMenus['Category'] || showMenus['Tags']) {menu.newEntry({entryText: 'sep'});}
	if (!list.bLiteMode) {	// Playlist saving
		const menuName = menu.newMenu('Playlist saving');
		{
			if (!list.bLiteMode) {	// Relative folder
				const subMenuName = menu.newMenu('Save paths relative to folder...', menuName);
				const options = ['Yes: Relative to playlists folder', 'No: Use absolute paths (default)'];
				const optionsLength = options.length;
				menu.newEntry({menuName: subMenuName, entryText: 'How track\'s paths are written:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				if (optionsLength) {
					options.forEach((item, i) => {
						menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
							list.bRelativePath = (i === 0) ? true : false;
							list.properties['bRelativePath'][1] = list.bRelativePath;
							overwriteProperties(list.properties);
							if (i === 0) {fb.ShowPopupMessage('All new playlists (and those saved from now on) will have their tracks\' paths edited to be relative to:\n\'' + list.playlistsPath + '\'\n\nFor example, for a file like this:\n' + list.playlistsPath + 'Music\\Artist A\\01 - hjk.mp3\n' + '--> .\\Music\\Artist A\\01 - hjk.mp3\n' + '\n\nBeware adding files which are not in a relative path to the playlist folder, they will be added \'as is\' no matter this setting:\n' + 'A:\\OTHER_FOLDER\\Music\\Artist A\\01 - hjk.mp3\n' + '-->A:\\OTHER_FOLDER\\Music\\Artist A\\01 - hjk.mp3\n\nAny playlist using absolute paths will be converted as soon as it gets updated/saved; appart from that, their usage remains the same.\nIf you want to mix relative and absolute playlists on the same tracked folder, you can do it locking the absolute playlists (so they never get overwritten).', window.Name);}
							else {fb.ShowPopupMessage('All new playlists (and those saved from now on) will use absolute paths.\n\nAny playlist using relative paths will be converted as soon as it gets updated/saved; appart from that, their usage remains the same.\nIf you want to mix relative and absolute playlists on the same tracked folder, you can do it locking the relative playlists (so they never get overwritten).', window.Name);}
						}});
					});
					menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.bRelativePath ? 0 : 1);});
				}
			}
			if (!list.bLiteMode) {	// Playlist extension
				const subMenuName = menu.newMenu('Default playlist extension...', menuName);
				const options = [...writablePlaylistFormats];
				const optionsLength = options.length;
				menu.newEntry({menuName: subMenuName, entryText: 'Writable formats:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				if (optionsLength) {
					options.forEach((item) => {
						menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
							if (item === '.pls') {
								let answer = WshShell.Popup('Are you sure you want to change extension?\n.pls format does not support UUIDs, Lock status, Categories nor Tags.\nUUID will be set to none for all playlists.', 0, window.Name, popup.question + popup.yes_no);
								if (answer !== popup.yes) {return;}
								menu.btn_up(void(0), void(0), void(0), 'Use UUIDs for playlist names...\\' + list.optionsUUID().pop()); // Force UUID change to no UUID using the menu routine
							}
							list.playlistsExtension = item;
							list.properties['extension'][1] = list.playlistsExtension;
							overwriteProperties(list.properties);
						}});
					});
					menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return options.indexOf(list.playlistsExtension);});
				}
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'Force on (auto)saving', func: () => {
					const answer = WshShell.Popup('Apply default format in any case, not only to new playlists created.\n\nFormat of existing playlists will be changed to the default format whenever they are saved: Manually or on Auto-saving.\n\nOther saving related configuration may apply (like Smart Playlists being skipped or warning popups whenever format will be changed).', 0, window.Name, popup.question + popup.yes_no);
					list.bSavingDefExtension = (answer === popup.yes);
					if (list.properties['bSavingDefExtension'][1] !== list.bSavingDefExtension) {
						list.properties['bSavingDefExtension'][1] = list.bSavingDefExtension;
						overwriteProperties(list.properties);
					}
				}});
				menu.newCheckMenu(subMenuName, 'Force on (auto)saving', null,  () => {return list.bSavingDefExtension;});
			}
			if (!list.bLiteMode) {	// BOM
				const subMenuName = menu.newMenu('Save files with BOM...', menuName);
				const options = ['Yes: UTF8-BOM', 'No: UTF8'];
				const optionsLength = options.length;
				menu.newEntry({menuName: subMenuName, entryText: 'Playlists and json:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				if (optionsLength) {
					options.forEach((item, i) => {
						menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
							list.bBOM = (i === 0);
							list.properties['bBOM'][1] = list.bBOM;
							overwriteProperties(list.properties);
						}});
					});
				}
				menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return list.bBOM ? 0 : 1;});
			}
			if (!list.bLiteMode) {	// Saving warnings
				const subMenuName = menu.newMenu('Warnings about format change...', menuName);
				const options = ['Yes: If format will be changed', 'No: Never'];
				const optionsLength = options.length;
				menu.newEntry({menuName: subMenuName, entryText: 'Warns when updating a file:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				if (optionsLength) {
					options.forEach((item, i) => {
						menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
							list.bSavingWarnings = (i === 0);
							list.properties['bSavingWarnings'][1] = list.bSavingWarnings;
							overwriteProperties(list.properties);
						}});
					});
				}
				menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return list.bSavingWarnings ? 0 : 1;});
			}
			if (!list.bLiteMode) {	// Smart Playlist saving
				const subMenuName = menu.newMenu('Skip Smart Playlists on Auto-saving...', menuName);
				const options = ['Yes: Original format will be maintained', 'No: Format will change on Auto-saving'];
				const optionsLength = options.length;
				menu.newEntry({menuName: subMenuName, entryText: 'Treat Smart Playlists as AutoPlaylists:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				if (optionsLength) {
					options.forEach((item, i) => {
						menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
							list.bSavingXsp = (i === 1);
							list.properties['bSavingXsp'][1] = list.bSavingXsp;
							overwriteProperties(list.properties);
							if (list.bSavingXsp) {fb.ShowPopupMessage('Auto-saving Smart Playlists involves, by design, not having an Smart Playlist anymore but just a list of files (originated from their query).\n\nEnabling this option will allow Smart Playlists to be overwritten as an standard playlist whenever they are updated. Note this goes agains their intended aim (like Auto-playlists) and therefore the query and other related data will be lost as soon as it\'s converted to a list of paths (*).\n\nOption not recommended for most users, use it at your own responsibility.\n\n(*) If this happens, remember the original playlist could still be found at the Recycle Bin.', window.Name);}
						}});
					});
				}
				menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return list.bSavingXsp ? 1 : 0;});
			}
		}
	}
	{	// Panel behavior
		const menuName = menu.newMenu('Panel behavior');
		{	// Filtering
			const subMenuName = menu.newMenu('Save filtering between sessions...', menuName);
			const options = ['Yes: Always restore last used','No: Reset on startup'];
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'Sorting, category and Playlists view:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.bSaveFilterStates = (i === 0) ? true : false;
					list.properties['bSaveFilterStates'][1] = list.bSaveFilterStates;
					overwriteProperties(list.properties);
				}});
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.bSaveFilterStates ? 0 : 1);});
		}
		if (!list.bLiteMode) {	// UI-only playlists
			const subMenuName = menu.newMenu('Track UI-only playlists...', menuName);
			const options = ['Yes: also show UI-only playlists','No: Only playlist files on tracked folder'];
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'Use manager as native organizer:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.bAllPls = (i === 0) ? true : false;
					list.properties['bAllPls'][1] = list.bAllPls;
					overwriteProperties(list.properties);
					if (list.bAllPls) {
						fb.ShowPopupMessage('UI-only playlists are non editable but they can be renamed, deleted or restored. Sending current selection to a playlist is also allowed.\nUI-only playlists have their own custom colour to be easily identified.\n\nTo be able to use all the other features of the manager, consider creating playlist files instead. At any point you may use \'Create new playlist from Active playlist...\' to save UI-only playlists as tracked files.', window.Name);
					}
					createMenuRight().btn_up(-1,-1, null, 'Manual refresh');
				}});
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.bAllPls ? 0 : 1);});
		}
		menu.newEntry({menuName, entryText: 'sep'});
		{	// Duplicated pls handling
			const subMenuName = menu.newMenu('Duplicated playlists handling...', menuName);
			const options = ['Warn about playlists with duplicated names', 'Ignore it'];
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'Only for tracked playlists within the manager:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.bCheckDuplWarnings = (i === 0) ? true : false;
					list.properties['bCheckDuplWarnings'][1] = list.bCheckDuplWarnings;
					overwriteProperties(list.properties);
				}});
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.bCheckDuplWarnings ? 0 : 1);});
		}
		{	// Duplicated tracks handling
			const subMenuName = menu.newMenu('Duplicated tracks handling...', menuName);
			const options = ['Skip duplicates when adding new tracks', 'Only warn about it on tooltip'];
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'When sending selection to a playlist:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.bForbidDuplicates = (i === 0) ? true : false;
					list.properties['bForbidDuplicates'][1] = list.bForbidDuplicates;
					overwriteProperties(list.properties);
				}});
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.bForbidDuplicates ? 0 : 1);});
		}
		{	// Dead items handling
			const subMenuName = menu.newMenu('Dead items handling...', menuName);
			const options = ['Also check for dead items on auto-saving', 'Only on manual saving or when adding tracks'];
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'Dead items warnings (streams are skipped):', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.bDeadCheckAutoSave = (i === 0) ? true : false;
					list.properties['bDeadCheckAutoSave'][1] = list.bDeadCheckAutoSave;
					overwriteProperties(list.properties);
				}});
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.bDeadCheckAutoSave ? 0 : 1);});
		}
		menu.newEntry({menuName, entryText: 'sep'});
		{	// Auto-Saving
			menu.newEntry({menuName, entryText: 'Auto-saving interval...\t(' + list.properties['autoSave'][1] + ' ms)', func: () => {
				let input = 0;
				try {input = Number(utils.InputBox(window.ID, 'Save changes within foobar2000 playlists into tracked files periodically.\nEnter integer number > ' + list.properties['autoSave'][2].range[1][0] + ' (ms):\n(0 to disable it)', window.Name, Number(list.properties['autoSave'][1]), true));}
				catch(e) {return;}
				if (isNaN(input)) {return;}
				if (!checkProperty(list.properties['autoSave'], input)) {return;}
				list.properties['autoSave'][1] = input;
				overwriteProperties(list.properties);
				window.Reload();
			}});
			menu.newCheckMenu(menuName, 'Auto-saving interval...', void(0),  () => {return Number(list.properties['autoSave'][1]) !== 0;});
		}
		{	// Auto-Loading
			menu.newEntry({menuName, entryText: 'Auto-loading interval...\t(' + list.properties['autoUpdate'][1] + ' ms)', func: () => {
				let input = 0;
				try {input = Number(utils.InputBox(window.ID, 'Check periodically the tracked folder for changes and update the list.\nEnter integer number > ' + list.properties['autoUpdate'][2].range[1][0] + ' (ms):\n(0 to disable it)', window.Name, Number(list.properties['autoUpdate'][1]), true));}
				catch(e) {return;}
				if (isNaN(input)) {return;}
				if (!checkProperty(list.properties['autoUpdate'], input)) {return;}
				list.properties['autoUpdate'][1] = input;
				overwriteProperties(list.properties);
				window.Reload();
			}});
			menu.newCheckMenu(menuName, 'Auto-loading interval...', void(0),  () => {return Number(list.properties['autoUpdate'][1]) !== 0;});
		}
		{	// Auto-Backup
			menu.newEntry({menuName, entryText: 'Auto-backup interval...\t(' + (isInt(list.properties['autoBack'][1]) ? list.properties['autoBack'][1] : '\u221E') + ' ms)', func: () => {
				let input = 0;
				try {input = Number(utils.InputBox(window.ID, 'Backup to zip periodically the tracked folder.\nEnter integer number > ' + list.properties['autoBack'][2].range[1][0] + ' (ms):\n(0 to disable it)\n(\'Infinity\' only on script unloading / playlist loading)', window.Name, Number(list.properties['autoBack'][1]), true));}
				catch(e) {return;}
				if (isNaN(input)) {return;}
				if (!checkProperty(list.properties['autoBack'], input)) {return;}
				list.properties['autoBack'][1] = input;
				overwriteProperties(list.properties);
				window.Reload();
			}});
			menu.newCheckMenu(menuName, 'Auto-backup interval...', void(0),  () => {return Number(list.properties['autoBack'][1]) !== 0;});
		}
		if (!list.bLiteMode) {	// Stop tracking library paths
			menu.newEntry({menuName, entryText: 'sep'});
			menu.newEntry({menuName, entryText: 'Don\'t track library (until next startup)', func: () => {
				list.switchTracking(void(0), true);
			}});
			menu.newCheckMenu(menuName, 'Don\'t track library (until next startup)', void(0),  () => {return !list.bTracking;});
		}
	}
	{	// Playlists behavior
		const menuName = menu.newMenu('Playlists behavior');
		if (!list.bLiteMode) {	// UUID
			const subMenuName = menu.newMenu('Use UUIDs for playlist names...', menuName);
			const options = list.optionsUUID();
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'For playlists tracked by Manager:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.optionUUID = item;
					list.properties['optionUUID'][1] = list.optionUUID;
					list.bUseUUID = (i === optionsLength - 1) ? false : true;
					list.properties['bUseUUID'][1] = list.bUseUUID;
					overwriteProperties(list.properties);
					list.updateAllUUID();
				}, flags: (i !== optionsLength - 1 && list.properties['extension'][1] === '.pls') ? MF_GRAYED : MF_STRING}); // Disable UUID for .pls playlists
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return options.indexOf(list.optionUUID);});
			menu.newEntry({menuName, entryText: 'sep'});
		}
		{	// Playlist Size
			const subMenuName = menu.newMenu('Update AutoPlaylists size...', menuName);
			const options = ['Yes: Automatically on every startup', 'No: Only when loading them'];
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'Track count on parenthesis:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.properties['bUpdateAutoplaylist'][1] = (i === 0) ? true : false; // True will force a refresh on script loading
					overwriteProperties(list.properties);
					if (list.properties['bUpdateAutoplaylist'][1]) {
						fb.ShowPopupMessage('Enabling this option will also load -internally- all queries from AutoPlaylists at startup to retrieve their tag count.(*)(**)\n\nIt\'s done asynchronously so it should not take more time to load the script at startup as consequence.\n\n(*) Note enabling this option will not incur on additional processing if you already enabled Tracks Auto-tagging on startup for AutoPlaylists.\n(**) For the same reasons, AutoPlaylists which perform tagging will always get their size updated no matter what this config is.', window.Name);
					}
				}});
			});
			//list.bUpdateAutoplaylist changes to false after firing, but the property is constant unless the user changes it...
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.properties['bUpdateAutoplaylist'][1] ? 0 : 1);});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'Block panel while updating?', func: () => {
				list.properties.bBlockUpdateAutoPls[1] = !list.properties.bBlockUpdateAutoPls[1];
				overwriteProperties(list.properties);
			}, flags: list.bAutoTrackTagAutoPlsInit ? MF_STRING: MF_GRAYED});
			menu.newCheckMenu(subMenuName, 'Block panel while updating?', void(0),  () => {return list.properties.bBlockUpdateAutoPls[1];});
		}
		{	// AutoPlaylist / Smart Playlists loading duplicates
			const subMenuName = menu.newMenu('Duplicates filter...', menuName);
			menu.newEntry({menuName: subMenuName, entryText: 'Removes duplicates after loading:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'On AutoPlaylist cloning', func: () => {
				list.bRemoveDuplicatesAutoPls = !list.bRemoveDuplicatesAutoPls;
				list.properties.bRemoveDuplicatesAutoPls[1] = list.bRemoveDuplicatesAutoPls;
				overwriteProperties(list.properties);
			}});
			menu.newCheckMenu(subMenuName, 'On AutoPlaylist cloning', void(0), () => {return list.bRemoveDuplicatesAutoPls;});
			if (!list.bLiteMode) {
				menu.newEntry({menuName: subMenuName, entryText: 'On Smart Playlist loading & cloning', func: () => {
					list.bRemoveDuplicatesSmartPls = !list.bRemoveDuplicatesSmartPls;
					list.properties.bRemoveDuplicatesSmartPls[1] = list.bRemoveDuplicatesSmartPls;
					overwriteProperties(list.properties);
				}});
				menu.newCheckMenu(subMenuName, 'On Smart Playlist loading & cloning', void(0), () => {return list.bRemoveDuplicatesSmartPls;});
			}
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'Use RegExp for title matching?', func: () => {
				list.bAdvTitle = !list.bAdvTitle;
				list.properties.bAdvTitle[1] = list.bAdvTitle;
				if (list.bAdvTitle) {fb.ShowPopupMessage(globRegExp.title.desc, window.Name);}
				overwriteProperties(list.properties);
			}});
			menu.newCheckMenu(subMenuName, 'Use RegExp for title matching?', void(0), () => {return list.bAdvTitle;});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'Configure Tags or TF expression...', func: () => {
				const input = Input.json('array strings', list.removeDuplicatesAutoPls, 'Enter tag(s) or TF expression(s):\n(JSON)', window.Name, '["$ascii($lower($trim(%TITLE%)))","ARTIST","$year(%DATE%)"]', void(0), true);
				if (input === null) {return;}
				list.removeDuplicatesAutoPls = input;
				list.properties.removeDuplicatesAutoPls[1] = JSON.stringify(list.removeDuplicatesAutoPls);
				overwriteProperties(list.properties);
			}});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'Restore defaults...', func: () => {
				list.bRemoveDuplicatesAutoPls = list.properties.bRemoveDuplicatesAutoPls[3];
				list.properties.bRemoveDuplicatesAutoPls[1] = list.bRemoveDuplicatesAutoPls;
				list.bRemoveDuplicatesSmartPls = list.properties.bRemoveDuplicatesSmartPls[3];
				list.properties.bRemoveDuplicatesSmartPls[1] = list.bRemoveDuplicatesSmartPls;
				list.bAdvTitle = list.properties.bAdvTitle[3];
				list.properties.bAdvTitle[1] = list.bAdvTitle;
				list.removeDuplicatesAutoPls = JSON.parse(list.properties.removeDuplicatesAutoPls[3]);
				list.properties.removeDuplicatesAutoPls[1] = JSON.stringify(list.removeDuplicatesAutoPls);
				overwriteProperties(list.properties);
			}});
		}
		if (showMenus['Tags']) {menu.newEntry({menuName, entryText: 'sep'});}
		if (showMenus['Tags']) {	// Playlist AutoTags & Actions
			const subMenuName = menu.newMenu('Playlist AutoTags and actions', menuName);
			menu.newEntry({menuName: subMenuName, entryText: 'Playlist file\'s Tags relatad actions:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			{
				const subMenuNameTwo = menu.newMenu('Automatically tag loaded playlists with...', subMenuName);
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Set tags:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep', flags: MF_GRAYED});
				const options = ['bAutoLoad', 'bAutoLock', 'bMultMenu', 'bSkipMenu'];
				const optionsLength = options.length;
				options.forEach((item, i) => {
					const itemKey = item + 'Tag';
					menu.newEntry({menuName: subMenuNameTwo, entryText: item, func: () => {
						list[itemKey] = !list[itemKey];
						list.properties[itemKey][1] = list[itemKey];
						overwriteProperties(list.properties);
					}});
					menu.newCheckMenu(subMenuNameTwo, item, void(0),  () => {return list[itemKey];});
				});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Custom tag...', func: () => {
					let tag = '';
					try {tag = utils.InputBox(window.ID, 'Enter tag(s) to be added to playlists on load:\nLeave it blank to deactivate auto-tagging.\n(sep by comma)', window.Name, options.join(','), true);}
					catch(e) {return;}
					tag = tag.trim();
					list.bAutoCustomTag = tag.length ? true : false;
					list.properties.bAutoCustomTag[1] = list.bAutoCustomTag;
					list.autoCustomTag = tag.split(',');
					list.properties.autoCustomTag[1] = tag;
					overwriteProperties(list.properties);
				}});
				menu.newCheckMenu(subMenuNameTwo, 'Custom tag...', void(0),  () => {return list.bAutoCustomTag;});
			}
			{
				const subMenuNameTwo = menu.newMenu('Apply actions according to AutoTags...', subMenuName);
				const options = ['Yes: At playlist loading', 'No: Ignore them'];
				const optionsLength = options.length;
				options.forEach((item, i) => {
					menu.newEntry({menuName: subMenuNameTwo, entryText: item, func: () => {
						list.bApplyAutoTags = (i === 0) ? true : false;
						list.properties.bApplyAutoTags[1] = list.bApplyAutoTags;
						overwriteProperties(list.properties);
						fb.ShowPopupMessage('Note in the case of \'bMultMenu\' and \'bSkipMenu\', actions are always applied at dynamic menu usage (the former) and creation (the latter).\n\n\'bMultMenu\': Associates playlist to menu entries applied to multiple playlists.\n\n\'bSkipMenu\': Skips dynamic menu creation for tagged playlist.\n\nUsage of \'bPinnedFirst\' and \'bPinnedLast\', to pin playlists at top/bottom, require automatic actions to be enabled.', window.Name);
						if (list.data.some((pls) => pls.tags.includes('bPinnedFirst') || pls.tags.includes('bPinnedLast'))) {list.sort();} // For pinned recordings
					}});
				});
				menu.newCheckMenu(subMenuNameTwo, options[0], options[optionsLength - 1],  () => {return (list.bApplyAutoTags ? 0 : 1);});
			}
		}
		if (showMenus['Tags']) {	// Tracks AutoTags
			const subMenuName = menu.newMenu('Tracks AutoTags and actions', menuName);
			menu.newEntry({menuName: subMenuName, entryText: 'Track\'s Tags related actions:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			{
				const subMenuNameTwo = menu.newMenu('Automatically tag added tracks on...', subMenuName);
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Switch for different playlist types:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Standard playlists', func: () => {
					if (!list.bAutoTrackTagPls) {fb.ShowPopupMessage('Tracks added to non-locked playlist will be automatically tagged.', window.Name);}
					list.bAutoTrackTagPls = !list.bAutoTrackTagPls;
					list.properties['bAutoTrackTagPls'][1] = list.bAutoTrackTagPls;
					overwriteProperties(list.properties);
				}, flags: list.bAutoTrackTag ? MF_STRING: MF_GRAYED});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Locked playlists', func: () => {
					if (!list.bAutoTrackTagLockPls) {fb.ShowPopupMessage('Changes on playlist will not be (automatically) saved to the playlist file since it will be locked, but tracks added to it (on foobar2000) will be automatically tagged.\n\nEnabling this option may allow to use a playlist only for tagging purposes (for ex. native playlists), not caring at all about saving the changes to the associated files.', window.Name);}
					list.bAutoTrackTagLockPls = !list.bAutoTrackTagLockPls;
					list.properties['bAutoTrackTagLockPls'][1] = list.bAutoTrackTagLockPls;
					overwriteProperties(list.properties);
				}, flags: list.bAutoTrackTag ? MF_STRING: MF_GRAYED});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'AutoPlaylists', func: () => {
					if (!list.bAutoTrackTagAutoPls) {fb.ShowPopupMessage('Enabling this option will automatically tag all tracks retrieved by the AutoPlaylists\' queries.\n\nNote AutoPlaylists only load the tracks when they are loaded within foobar2000, therefore tagging only happens at that point. AutoPlaylists in the Playlist Manager but not loaded within foobar2000 are omitted.\n\nAlternatively, using the manual refresh menu entry will force AutoPlaylists tagging (and size updating) on all of them.\n\nIt may allow to automatically tag tracks according to some query or other tags (for ex. adding a tag \'Instrumental\' to all \'Jazz\' tracks automatically).\n\nUsing it in a creative way, AutoPlaylists may be used as pools which send tracks to other AutoPlaylists. For ex:\n- AutoPlaylist (A) which tags all \'Surf Rock\' or \'Beat Music\' tracks with \'Summer\'.\n- AutoPlaylist (B) which tags all tracks with from 2021 and rating 4 with \'Summer\'.\n- AutoPlaylist (C) filled with all tracks with a \'playlist\' tag equal to \'Summer\'. As result, this playlist will be filled with tracks from (A) and (C).', window.Name);}
					list.bAutoTrackTagAutoPls = !list.bAutoTrackTagAutoPls;
					list.properties['bAutoTrackTagAutoPls'][1] = list.bAutoTrackTagAutoPls;
					overwriteProperties(list.properties);
				}, flags: list.bAutoTrackTag ? MF_STRING: MF_GRAYED});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'AutoPlaylists (at startup)', func: () => {
					if (!list.bAutoTrackTagAutoPlsInit) {fb.ShowPopupMessage('Enabling this option will also load -internally- all queries from AutoPlaylists at startup to tag their tracks (*)(**)(***).\n\nThis bypasses the natural limit of tagging only applying to loaded AutoPlaylists within foobar2000; it\'s done asynchronously so it should not take more time to load the script at startup as consequence.\n\n(*) Only those with tagging set, the rest are not loaded to optimize processing time.\n(**) Note enabling this option will not incur on additional proccessing if you already set AutoPlaylists size updating on startup too (both will be done asynchronously).\n(***) For the same reasons, AutoPlaylists which perform tagging will always get their size updated no matter what the \'Update AutoPlaylists size...\' config is.', window.Name);}
					list.bAutoTrackTagAutoPlsInit = !list.bAutoTrackTagAutoPlsInit;
					list.properties['bAutoTrackTagAutoPlsInit'][1] = list.bAutoTrackTagAutoPlsInit;
					overwriteProperties(list.properties);
				}, flags: list.bAutoTrackTag && list.bAutoTrackTagAutoPls ? MF_STRING: MF_GRAYED});
				menu.newCheckMenu(subMenuNameTwo, 'Standard playlists', void(0),  () => {return list.bAutoTrackTagPls;});
				menu.newCheckMenu(subMenuNameTwo, 'Locked playlists', void(0),  () => {return list.bAutoTrackTagLockPls;});
				menu.newCheckMenu(subMenuNameTwo, 'AutoPlaylists', void(0),  () => {return list.bAutoTrackTagAutoPls;});
				menu.newCheckMenu(subMenuNameTwo, 'AutoPlaylists (at startup)', void(0),  () => {return list.bAutoTrackTagAutoPlsInit;});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Block panel while updating (at startup)?', func: () => {
					list.properties.bBlockUpdateAutoPls[1] = !list.properties.bBlockUpdateAutoPls[1];
					overwriteProperties(list.properties);
				}, flags: list.bAutoTrackTagAutoPlsInit ? MF_STRING: MF_GRAYED});
				menu.newCheckMenu(subMenuNameTwo, 'Block panel while updating (at startup)?', void(0),  () => {return list.properties.bBlockUpdateAutoPls[1];});
			}
			{
				const subMenuNameTwo = menu.newMenu('Enable auto-tagging...', subMenuName);
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'When saving and loading pls', func: () => {
					if (!list.bAutoTrackTag) {fb.ShowPopupMessage('Enables or disables the feature globally (all other options require this one to be switched on).\n\nEnabling this will automatically tag tracks added to playlist according to their set \'Track Tags\'. By default new playlist have none assigned, they must be configured per playlist (*).\n\nAutotagging is done while autosaving, on manual load (AutoPlaylists) and/or save. Also on manual refresh (AutoPlaylists).\n\n(*) Use contextual menu.', window.Name);}
					list.bAutoTrackTag = !list.bAutoTrackTag;
					list.properties['bAutoTrackTag'][1] = list.bAutoTrackTag;
					overwriteProperties(list.properties);
				}});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Also adding tracks without autosave', func: () => {
					if (!list.bAutoTrackTagAlways) {fb.ShowPopupMessage('Auto-tagging is usually done at autosaving step. If autosave is disabled, playlist files will not reflect the changes done within foobar2000 and by default auto-tagging is skipped in that case.\n\nEnabling this option will make the changes to track\'s tags even if automatic playlist saving is disabled.', window.Name);}
					list.bAutoTrackTagAlways = !list.bAutoTrackTagAlways;
					list.properties['bAutoTrackTagAlways'][1] = list.bAutoTrackTagAlways;
					overwriteProperties(list.properties);
				}, flags: list.bAutoTrackTag ? MF_STRING: MF_GRAYED});
				menu.newCheckMenu(subMenuNameTwo, 'When saving and loading pls', void(0),  () => {return list.bAutoTrackTag;});
				menu.newCheckMenu(subMenuNameTwo, 'Also adding tracks without autosave', void(0),  () => {return list.bAutoTrackTagAlways;});
			}
		}
		menu.newEntry({menuName, entryText: 'sep'});
		{	// Export and Converter settings
			if (!list.bLiteMode) {	//Export and copy
				const subMenuName = menu.newMenu('Export and copy...', menuName);
				menu.newEntry({menuName: subMenuName, entryText: 'Configuration of copy tools:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'Copy files asynchronously (on background)', func: () => {
					list.properties['bCopyAsync'][1] = !list.properties['bCopyAsync'][1];
					overwriteProperties(list.properties);
				}});
				menu.newCheckMenu(subMenuName, 'Copy files asynchronously (on background)', void(0),  () => {return list.properties['bCopyAsync'][1];});
			}
			{	//Export and convert
				const subMenuName = menu.newMenu('Export and convert...', menuName);
				menu.newEntry({menuName: subMenuName, entryText: 'Configuration of exporting presets:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				const presets = JSON.parse(list.properties.converterPreset[1]);
				presets.forEach((preset, i) => {
					const path = preset.path;
					let pathName = (path.length ? '(' + path.split('\\')[0] +'\\) ' + path.split('\\').slice(-2, -1) : '(Folder)');
					const dsp = preset.dsp;
					let dspName = (dsp !== '...' ? dsp  : '(DSP)');
					const tf = preset.tf;
					let tfName = preset.hasOwnProperty('name') && preset.name.length ? preset.name : preset.tf;
					const extension = preset.hasOwnProperty('extension') && preset.extension.length ? preset.extension : '';
					const extensionName = extension.length ? '[' + extension + ']' : '';
					if (pathName.length > 20) {pathName = pathName.substr(0, 20) + '...';}
					if (dspName.length > 20) {dspName = dspName.substr(0, 20) + '...';}
					if (tfName.length > 40) {tfName = tfName.substr(0, 40) + '...';}
					const subMenuNameTwo = menu.newMenu('Preset ' + (i + 1) + ': ' + pathName + extensionName +': ' + dspName + ' ---> ' + tfName, subMenuName);
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'Set default export folder...', func: () => {
						let input = '';
						try {input = sanitizePath(utils.InputBox(window.ID, 'Enter destination path:\n(Left it empty to set output folder at execution)', window.Name, preset.path, true));}
						catch(e) {return;}
						if (input.length && !input.endsWith('\\')) {input += '\\';}
						if (input !== preset.path) {
							preset.path = input;
							list.properties['converterPreset'][1] = JSON.stringify(presets);
							overwriteProperties(list.properties);
							if (list.bDynamicMenus) {list.createMainMenuDynamic().then(() => {list.exportPlaylistsInfo(); list.checkPanelNames();});}
						}
					}});
					{
						const subMenuNameThree = menu.newMenu('Set playlist format...', subMenuNameTwo);
						const options = ['', ...writablePlaylistFormats];
						options.forEach((extension) => {
							menu.newEntry({menuName: subMenuNameThree, entryText: extension.length ? extension : '(original)', func: () => {
								if (extension !== preset.extension) {
									preset.extension = extension;
									list.properties['converterPreset'][1] = JSON.stringify(presets);
									overwriteProperties(list.properties);
									if (list.bDynamicMenus) {list.createMainMenuDynamic().then(() => {list.exportPlaylistsInfo(); list.checkPanelNames();});}
								}
							}});
						});
						menu.newCheckMenu(subMenuNameThree, '(original)', options[options.length - 1],  () => {return options.indexOf(preset.extension || '');});
					}
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'Set DSP preset...', func: () => {
						let input = '';
						try {input = utils.InputBox(window.ID, 'Enter DSP preset name:\n(empty or ... will show converter window)', window.Name, preset.dsp, true);}
						catch(e) {return;}
						if (!input.length) {input = '...';}
						if (input !== preset.dsp) {
							preset.dsp = input;
							list.properties['converterPreset'][1] = JSON.stringify(presets);
							overwriteProperties(list.properties);
							if (list.bDynamicMenus) {list.createMainMenuDynamic().then(() => {list.exportPlaylistsInfo(); list.checkPanelNames();});}
						}
					}});
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'Set track filename expression...', func: () => {
						let input = '';
						try {input = utils.InputBox(window.ID, 'Enter TF expression:\n(it should match the one at the converter preset)', window.Name, preset.tf, true);}
						catch(e) {return;}
						if (!input.length) {return;}
						if (input !== preset.tf) {
							preset.tf = input;
							list.properties['converterPreset'][1] = JSON.stringify(presets);
							overwriteProperties(list.properties);
							if (list.bDynamicMenus) {list.createMainMenuDynamic().then(() => {list.exportPlaylistsInfo(); list.checkPanelNames();});}
						}
					}});
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'Set name...', func: () => {
						const hasName = preset.hasOwnProperty('name') ? true : false;
						let input = '';
						try {input = utils.InputBox(window.ID, 'Enter preset name:\n(Left it empty to use TF expression instead)', window.Name, preset.hasOwnProperty('name') ? preset.name : '', true);}
						catch(e) {return;}
						if (!input.length) {return;}
						if (!hasName  || hasName && input !== preset.name) {
							preset.name = input;
							list.properties['converterPreset'][1] = JSON.stringify(presets);
							overwriteProperties(list.properties);
							if (list.bDynamicMenus) {list.createMainMenuDynamic().then(() => {list.exportPlaylistsInfo(); list.checkPanelNames();});}
						}
					}});
				});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'Add new preset', func: () => {
					presets.push({dsp: '...', tf: '.\\%filename%.mp3', path: ''});
					list.properties['converterPreset'][1] = JSON.stringify(presets);
					overwriteProperties(list.properties);
					if (list.bDynamicMenus) {list.createMainMenuDynamic().then(() => {list.exportPlaylistsInfo(); list.checkPanelNames();});}
				}});
				const subMenuNameTwo = menu.newMenu('Remove preset...', subMenuName);
				presets.forEach((preset, i) => {
					const path = preset.path;
					let pathName = (path.length ? '(' + path.split('\\')[0] +'\\) ' + path.split('\\').slice(-2, -1) : '(Folder)');
					const dsp = preset.dsp;
					let dspName = (dsp !== '...' ? dsp  : '(DSP)');
					const tf = preset.tf;
					let tfName = preset.hasOwnProperty('name') && preset.name.length ? preset.name : preset.tf;
					if (pathName.length > 20) {pathName = pathName.substr(0, 20) + '...';}
					if (dspName.length > 20) {dspName = dspName.substr(0, 20) + '...';}
					if (tfName.length > 40) {tfName = tfName.substr(0, 40) + '...';}
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'Preset ' + (i + 1) + ': ' + pathName + ': ' + dspName + ' ---> ' + tfName, func: () => {
						presets.splice(i, 1);
						list.properties['converterPreset'][1] = JSON.stringify(presets);
						overwriteProperties(list.properties);
						if (list.bDynamicMenus) {list.createMainMenuDynamic().then(() => {list.exportPlaylistsInfo(); list.checkPanelNames();});}
					}});
				});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Restore defaults', func: () => {
					list.properties['converterPreset'][1] = list.defaultProperties['converterPreset'][3];
					overwriteProperties(list.properties);
					if (list.bDynamicMenus) {list.createMainMenuDynamic().then(() => {list.exportPlaylistsInfo(); list.checkPanelNames();});}
				}});
			}
		}
	}
	menu.newEntry({entryText: 'sep'});
	{	// UI
		const menuName = menu.newMenu('UI');
		{	// Playlist Size
			const subMenuName = menu.newMenu('Show Playlist size...', menuName);
			const options = ['Yes: Shown along the playlist name', 'No: Only shown on tooltip/columns'];
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'Track count on parenthesis:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.bShowSize = (i === 0) ? true : false;
					list.properties['bShowSize'][1] = list.bShowSize;
					overwriteProperties(list.properties);
				}});
			});
			//list.bUpdateAutoplaylist changes to false after firing, but the property is constant unless the user changes it...
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.bShowSize ? 0 : 1);});
		}
		{	// Name/category sep
			const subMenuName = menu.newMenu('Show name/category separators...', menuName);
			const options = ['Yes: Dotted line and initials','No: Only shown on tooltip'];
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'When sorting by name/category:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.bShowSep = (i === 0) ? true : false;
					list.properties['bShowSep'][1] = list.bShowSep;
					overwriteProperties(list.properties);
				}});
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.bShowSep ? 0 : 1);});
		}
		{	// Playlist icons
			const subMenuName = menu.newMenu('Set playlist icons...', menuName);
			const options = ['Yes: icons + playlist name','No: only playlist name'];
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'Show playlist icons?', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.bShowIcons = (i === 0) ? true : false;
					list.properties['bShowIcons'][1] = list.bShowIcons;
					overwriteProperties(list.properties);
				}});
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.bShowIcons ? 0 : 1);});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'Personalize playlist icons...', func: () => {
				let input;
				try {input = utils.InputBox(window.ID, 'Edit Unicode values: {".ext": {"icon": "fxxx", "iconBg": "fxxx"}, ...}\n\nNull will disable the icon or background.\nSee also: https://fontawesome.com/v5/cheatsheet\n\nExample: {".m3u8":{"icon":"f15c","iconBg":null}}', window.Name, list.properties['playlistIcons'][1], true);} 
				catch(e) {return;}
				if (!input.length) {input = '{}';}
				if (input === list.properties['playlistIcons'][1]) {return;}
				try {JSON.parse(input)} catch(e) {return;}
				list.playlistIcons = JSON.parse(input);
				list.properties['playlistIcons'][1] = input;
				overwriteProperties(list.properties);
				list.updatePlaylistIcons();
				window.Repaint();
			}});
		}
		menu.newEntry({menuName, entryText: 'sep'});
		{	// Tooltips
			const subMenuName = menu.newMenu('Show usage info on tooltips...', menuName);
			const options = ['Yes: Show shortcuts','No: Only show basic info'];
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'On playlist and header tooltips:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.bShowTips = (i === 0) ? true : false;
					list.properties['bShowTips'][1] = list.bShowTips;
					overwriteProperties(list.properties);
				}});
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.bShowTips ? 0 : 1);});
		}
		{	// Playlist header menu
			const subMenuName = menu.newMenu('Show playlist header on menus...', menuName);
			const options = ['Yes: Show playlist format and name','No: Only the contextual menu'];
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'On playlist contextual menu:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.bShowMenuHeader = (i === 0) ? true : false;
					list.properties['bShowMenuHeader'][1] = list.bShowMenuHeader;
					overwriteProperties(list.properties);
				}});
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.bShowMenuHeader ? 0 : 1);});
		}
		menu.newEntry({menuName, entryText: 'sep'});
		{	// Font size
			const subMenuName = menu.newMenu('Font size...', menuName);
			if (panel.listObjects.length || panel.textObjects.length) {
				const options = [...panel.fonts.sizes, 'Other...'];
				const optionsLength = options.length;
				options.forEach((item, index) => {
					menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
						if (index !== optionsLength - 1) {
							if (panel.fonts.size !== item) {
								panel.fonts.size = item;
								// Update property to save between reloads
								panel.properties['fontSize'][1] = item;
								overwriteProperties(panel.properties);
								panel.fontChanged();
								window.Repaint();
							}
						} else {
							let input;
							try {input = Number(utils.InputBox(window.ID, 'Input a number:', window.Name, panel.fonts.size, true));} 
							catch(e) {return;}
							if (input === panel.fonts.size) {return;}
							if (!Number.isSafeInteger(input)) {return;}
							panel.fonts.size = input;
							// Update property to save between reloads
							panel.properties['fontSize'][1] = input;
							overwriteProperties(panel.properties);
							panel.fontChanged();
							window.Repaint();
						}
					}});
				});
				menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1], () => {
					let idx = options.indexOf(panel.fonts.size);
					return idx !== -1 ? idx : optionsLength - 1;
				});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'Use bold version', func: () => {
					panel.colors.bBold = !panel.colors.bBold;
					panel.properties.bBold[1] = panel.colors.bBold;
					overwriteProperties(panel.properties);
					window.Repaint();
				}});
				menu.newCheckMenu(subMenuName, 'Use bold version', void(0), () => {return panel.colors.bBold;});
			}
		}
		{	// List colours
			const subMenuName = menu.newMenu('Set custom colours...', menuName);
			const options = ['AutoPlaylists...','Smart playlists...','UI-only playlists...','Locked Playlists...','Selection rectangle...'];
			const optionsLength = options.length;
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					if (i === 0) {list.colors.autoPlaylistColor = utils.ColourPicker(window.ID, list.colors.autoPlaylistColor);}
					if (i === 1) {list.colors.smartPlaylistColor = utils.ColourPicker(window.ID, list.colors.smartPlaylistColor);}
					if (i === 2) {list.colors.uiPlaylistColor = utils.ColourPicker(window.ID, list.colors.uiPlaylistColor);}
					if (i === 3) {list.colors.lockedPlaylistColor = utils.ColourPicker(window.ID, list.colors.lockedPlaylistColor);}
					if (i === 4) {list.colors.selectedPlaylistColor = utils.ColourPicker(window.ID, list.colors.selectedPlaylistColor);}
					// Update property to save between reloads
					list.properties.listColors[1] = convertObjectToString(list.colors);
					overwriteProperties(list.properties);
					list.checkConfigPostUpdate(list.checkConfig()); // Ensure related config is set properly
					window.Repaint();
				}});
			});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			{	// Text colour
				const subMenuSecondName = menu.newMenu('Standard text...', subMenuName);
				const options = [(window.InstanceType ? 'Use default UI setting' : 'Use columns UI setting'), 'Custom'];
				const optionsLength = options.length;
				options.forEach((item, i) => {
					menu.newEntry({menuName: subMenuSecondName, entryText: item, func: () => {
						panel.colors.bCustomText = i !== 0;
						// Update property to save between reloads
						panel.properties.bCustomText[1] = panel.colors.bCustomText;
						overwriteProperties(panel.properties);
						panel.colorsChanged();
						list.checkConfigPostUpdate(list.checkConfig()); // Ensure related config is set properly
						window.Repaint();
					}});
				});
				menu.newCheckMenu(subMenuSecondName, options[0], options[optionsLength - 1], () => {return panel.colors.bCustomText ? 1 : 0;});
				menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuSecondName, entryText: 'Set custom colour...', func: () => {
					panel.colors.customText = utils.ColourPicker(window.ID, panel.colors.customText);
					// Update property to save between reloads
					panel.properties.customText[1] = panel.colors.customText;
					overwriteProperties(panel.properties);
					panel.colorsChanged();
					list.checkConfigPostUpdate(list.checkConfig()); // Ensure related config is set properly
					window.Repaint();
				}, flags: panel.colors.bCustomText ? MF_STRING : MF_GRAYED,});
				menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuSecondName, entryText: 'Add shadows to font', func: () => {
					panel.colors.bFontOutline = !panel.colors.bFontOutline;
					panel.properties.bFontOutline[1] = panel.colors.bFontOutline;
					overwriteProperties(panel.properties);
					window.Repaint();
				}});
				menu.newCheckMenu(subMenuSecondName, 'Add shadows to font', void(0), () => {return panel.colors.bFontOutline;});
			}
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			{	// Buttons' toolbar
				const defaultCol = invert(panel.getColorBackground());
				const subMenuSecondName = menu.newMenu('Button toolbar...', subMenuName);
				const options = ['Use default', 'Custom'];
				const optionsLength = options.length;
				options.forEach((item, i) => {
					menu.newEntry({menuName: subMenuSecondName, entryText: item, func: () => {
						panel.colors.buttonsToolbarColor = i ? utils.ColourPicker(window.ID, panel.colors.buttonsToolbarColor) : defaultCol;
						panel.properties.buttonsToolbarColor[1] = panel.colors.buttonsToolbarColor;
						// Update property to save between reloads
						overwriteProperties(panel.properties);
						panel.colorsChanged();
						list.checkConfigPostUpdate(list.checkConfig()); // Ensure related config is set properly
						window.Repaint();
					}});
				});
				menu.newCheckMenu(subMenuSecondName, options[0], options[optionsLength - 1], () => {return (panel.colors.buttonsToolbarColor === defaultCol ? 0 : 1);});
				menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuSecondName, entryText: 'Set transparency...', func: () => {
					const input = Input.number('int positive', panel.colors.buttonsToolbarTransparency, 'Enter value:\n(0 to 100)', window.Name, 50);
					if (input === null) {return;}
					panel.properties.buttonsToolbarTransparency[1] = panel.colors.buttonsToolbarTransparency = input;
					// Update property to save between reloads
					overwriteProperties(panel.properties);
					panel.colorsChanged();
					list.checkConfigPostUpdate(list.checkConfig()); // Ensure related config is set properly
					window.Repaint();
				}});
			}
			{	// Buttons' Text colour
				const defaultCol = panel.colors.bButtonsBackground ? panel.colors.default.buttonsTextColor : invert(panel.getColorBackground());
				const subMenuSecondName = menu.newMenu('Buttons\' text...', subMenuName);
				const options = ['Use default', 'Custom'];
				const optionsLength = options.length;
				options.forEach((item, i) => {
					menu.newEntry({menuName: subMenuSecondName, entryText: item, func: () => {
						panel.colors.buttonsTextColor = i ? utils.ColourPicker(window.ID, panel.colors.buttonsTextColor) : defaultCol;
						panel.properties.buttonsTextColor[1] = panel.colors.buttonsTextColor;
						// Update property to save between reloads
						overwriteProperties(panel.properties);
						panel.colorsChanged();
						list.checkConfigPostUpdate(list.checkConfig()); // Ensure related config is set properly
						window.Repaint();
					}});
				});
				menu.newCheckMenu(subMenuSecondName, options[0], options[optionsLength - 1], () => {return (panel.colors.buttonsTextColor === defaultCol ? 0 : 1);});
			}
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			{	// Background colour
				const defaultButtonsCol = invert(panel.getColorBackground());
				const subMenuSecondName = menu.newMenu('Background...', subMenuName);
				if (panel.customBackground) {
					const options = [(window.InstanceType ? 'Use default UI setting' : 'Use columns UI setting'), 'Splitter', 'Custom'];
					const optionsLength = options.length;
					options.forEach((item, i) => {
						menu.newEntry({menuName: subMenuSecondName, entryText: item, func: () => {
							panel.colors.mode = i;
							// Update property to save between reloads
							panel.properties.colorsMode[1] = panel.colors.mode;
							overwriteProperties(panel.properties);
							panel.colorsChanged();
							list.checkConfigPostUpdate(list.checkConfig()); // Ensure related config is set properly
							// Set defaults again
							if (panel.setDefault({oldColor: defaultButtonsCol})) {overwriteProperties(panel.properties);}
							window.Repaint();
						}});
					});
					menu.newCheckMenu(subMenuSecondName, options[0], options[optionsLength - 1], () => {return panel.colors.mode;});
					menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
					menu.newEntry({menuName: subMenuSecondName, entryText: 'Set custom colour...', func: () => {
						panel.colors.customBackground = utils.ColourPicker(window.ID, panel.colors.customBackground);
						// Update property to save between reloads
						panel.properties.customBackground[1] = panel.colors.customBackground;
						overwriteProperties(panel.properties);
						panel.colorsChanged();
						list.checkConfigPostUpdate(list.checkConfig()); // Ensure related config is set properly
						// Set defaults again
						if (panel.setDefault({oldColor: defaultButtonsCol})) {overwriteProperties(panel.properties);}
						window.Repaint();
					}, flags: panel.colors.mode === 2 ? MF_STRING : MF_GRAYED,});
				}
				menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuSecondName, entryText: 'Alternate rows background colour', func: () => {
					panel.colors.bAltRowsColor = !panel.colors.bAltRowsColor;
					panel.properties['bAltRowsColor'][1] = panel.colors.bAltRowsColor;
					overwriteProperties(panel.properties);
					panel.colorsChanged();
					list.checkConfigPostUpdate(list.checkConfig()); // Ensure related config is set properly
					window.Repaint();
				}});
				menu.newCheckMenu(subMenuSecondName, 'Alternate rows background colour', void(0), () => {return panel.colors.bAltRowsColor;});
			}
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			{	// Presets
				const subMenuSecondName = menu.newMenu('Presets...', subMenuName);
				const presets = [ /*[autoPlaylistColor, smartPlaylistColor, uiPlaylistColor, lockedPlaylistColor, selectedPlaylistColor, standard text, buttons, background ]*/
					{name: 'Colour Blindness (light)', colors: [colorBlind.yellow[2], colorBlind.yellow[2], colorBlind.blue[0], colorBlind.blue[1], colorBlind.blue[1], colorBlind.black[2], colorBlind.white[0]]},
					{name: 'Colour Blindness (dark)', colors: [colorBlind.yellow[1], colorBlind.yellow[1], colorBlind.yellow[2], colorBlind.blue[1], colorBlind.blue[2], colorBlind.white[1], colorBlind.black[2]]},
					{name: 'sep'},
					{name: 'Gray Scale (dark)', colors: [colorBlind.black[1], colorBlind.black[1], colorBlind.white[0], colorBlind.black[2], colorBlind.black[2], colorBlind.white[0], colorBlind.black[0]]},
					{name: 'Gray Scale (light)', colors: [colorBlind.black[1], colorBlind.black[1], colorBlind.black[0], colorBlind.black[1], colorBlind.black[2], colorBlind.black[2], colorBlind.white[0]]},
					{name: 'sep'},
					{name: 'Dark theme', colors: [blendColors(RGB(157, 158, 163), RGB(...toRGB(0xFFFF629B)), 0.6), blendColors(RGB(157, 158, 163), RGB(...toRGB(0xFF65CC32)), 0.6), blendColors(RGB(157, 158, 163), RGB(...toRGB(0xFF00AFFD)), 0.8), RGB(...toRGB(0xFFDC143C)), RGB(...toRGB(0xFF0080C0)), RGB(170, 170, 170), RGB(30, 30, 30)]},
					{name: 'Dark theme (red)', colors: [blendColors(RGB(157, 158, 163), RGB(...toRGB(0xFFFF629B)), 0.6), blendColors(RGB(157, 158, 163), RGB(...toRGB(0xFF65CC32)), 0.6), blendColors(RGB(157, 158, 163), RGB(...toRGB(0xFF00AFFD)), 0.8), RGB(...toRGB(0xFFDC143C)), RGB(236,47,47), blendColors(RGB(236,47,47), RGB(170, 170, 170), 0.2), RGB(30, 30, 30)], buttonColors: [blendColors(RGB(236,47,47), invert(RGB(30, 30, 30)), 0.2), RGB(236,47,47)]},
					{name: 'sep'},
					{name: 'Default'}
				];
				presets.forEach((preset) => {
					if (preset.name.toLowerCase() === 'sep') {menu.newEntry({menuName: subMenuSecondName, entryText: 'sep'}); return;}
					menu.newEntry({menuName: subMenuSecondName, entryText: preset.name, func: () => {
						// Panel and list
						if (preset.name.toLowerCase() === 'default') {
							panel.properties.colorsMode[1] = panel.colors.mode = 0;
							panel.properties.bCustomText[1] = panel.colors.bCustomText = false;
							list.colors = {};
						}
						else {
							panel.properties.colorsMode[1] = panel.colors.mode = 2;
							panel.properties.customBackground[1] = panel.colors.customBackground = preset.colors[6];
							panel.properties.bCustomText[1] = panel.colors.bCustomText = true;
							panel.properties.customText[1] = panel.colors.customText = preset.colors[5];
							list.colors.autoPlaylistColor = preset.colors[0];
							list.colors.smartPlaylistColor = preset.colors[1];
							list.colors.uiPlaylistColor = preset.colors[2];
							list.colors.lockedPlaylistColor = preset.colors[3];
							list.colors.selectedPlaylistColor = preset.colors[4];
						}
						list.properties.listColors[1] = convertObjectToString(list.colors);
						panel.colorsChanged();
						panel.setDefault({all: true});
						// Buttons
						if (preset.hasOwnProperty('buttonColors') && preset.buttonColors.length) {
							if (preset.buttonColors[0] !== null) {panel.properties.buttonsTextColor[1] = panel.colors.buttonsTextColor = preset.buttonColors[0];}
							if (preset.buttonColors[1] !== null) {panel.properties.buttonsToolbarColor[1] = panel.colors.buttonsToolbarColor = preset.buttonColors[1];}
							panel.colorsChanged();
						}
						overwriteProperties(list.properties);
						overwriteProperties(panel.properties);
						list.checkConfigPostUpdate(list.checkConfig()); // Ensure related config is set properly
						window.Repaint();
					}});
					menu.newCheckMenu(subMenuSecondName, preset.name, void(0), () => {
						return preset.name.toLowerCase() === 'default' 
							? panel.colors.mode === 0
								&& panel.colors.buttonsTextColor === panel.colors.bButtonsBackground ? panel.colors.default.buttonsTextColor : invert(panel.getColorBackground())
								&& panel.colors.buttonsTextColor === invert(panel.getColorBackground())
								&& panel.colors.bCustomText === false
								&& list.colors.autoPlaylistColor === blendColors(panel.colors.text, RGB(...toRGB(0xFFFF629B)), 0.6) // At list.checkConfig
								&& list.colors.smartPlaylistColor === blendColors(panel.colors.text, RGB(...toRGB(0xFF65CC32)), 0.6)
								&& list.colors.uiPlaylistColor === blendColors(panel.colors.text, RGB(...toRGB(0xFF00AFFD)), 0.8)
								&& list.colors.lockedPlaylistColor === RGB(...toRGB(0xFFDC143C))
								&& list.colors.selectedPlaylistColor === RGB(...toRGB(0xFF0080C0))
							: panel.colors.mode === 2
								&& panel.colors.customBackground === preset.colors[6] 
								&& panel.colors.bCustomText === true
								&& panel.colors.customText === preset.colors[5]
								&& list.colors.autoPlaylistColor === preset.colors[0]
								&& list.colors.smartPlaylistColor === preset.colors[1]
								&& list.colors.uiPlaylistColor === preset.colors[2]
								&& list.colors.lockedPlaylistColor === preset.colors[3]
								&& list.colors.selectedPlaylistColor === preset.colors[4]
								&& (
									preset.hasOwnProperty('buttonColors') && preset.buttonColors.length 
									&& (
										(preset.buttonColors[0] !== null && panel.colors.buttonsTextColor === preset.buttonColors[0] || preset.buttonColors[0] === null)
										&& 
										(preset.buttonColors[1] !== null && panel.colors.buttonsToolbarColor === preset.buttonColors[1] || preset.buttonColors[1] === null)
									) 
									|| !preset.hasOwnProperty('buttonColors')
								);
					});
				});
			}
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'Reset all to default', func: () => {
				list.colors = {};
				list.properties.listColors[1] = convertObjectToString(list.colors);
				panel.properties.colorsMode[1] = panel.colors.mode = 0;
				panel.properties.bCustomText[1] = panel.colors.bCustomText = false;
				panel.colorsChanged();
				panel.setDefault({all: true});
				overwriteProperties(list.properties);
				overwriteProperties(panel.properties);
				list.checkConfigPostUpdate(list.checkConfig()); // Ensure related config is set properly
				window.Repaint();
			}});
		}
		{	// Buttons' toolbar
			const defaultButtonsCol = panel.colors.bButtonsBackground ? panel.colors.default.buttonsTextColor : invert(panel.getColorBackground());
			const subMenuName = menu.newMenu('Button toolbar...', menuName);
			const options = ['Use default (toolbar)', 'Use no background buttons', 'Use background buttons (theme manager)'];
			const optionsLength = options.length;
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					panel.properties.bToolbar[1] = panel.colors.bToolbar = i === 0 ? true : false;
					panel.properties.bButtonsBackground[1] = panel.colors.bButtonsBackground = i === 2 ? true : false;
					// Update property to save between reloads
					overwriteProperties(panel.properties);
					panel.colorsChanged();
					if (panel.setDefault({oldColor: defaultButtonsCol})) {overwriteProperties(panel.properties);}
					window.Repaint();
				}});
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1], () => {return (panel.colors.bToolbar ? 0 : (panel.colors.bButtonsBackground ? 2 : 1));});
		}
		{	// Panel background
			const subMenuName = menu.newMenu('Panel background...', menuName);
			const options = ['Use front cover', 'Use color background'];
			const optionsLength = options.length;
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					panel.imageBackground.enabled = i === 0 ? true : false;
					panel.properties.imageBackground[1] = JSON.stringify(panel.imageBackground);
					if (panel.imageBackground.enabled) { // Add shadows by default
						panel.colors.bFontOutline = true;
					}
					overwriteProperties(panel.properties);
					panel.updateImageBg(true);
					window.Repaint();
				}});
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1], () => {return (panel.imageBackground.enabled ? 0 : 1);});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			{
				const subMenuNameTwo = menu.newMenu('Selection mode...', subMenuName);
				const options = ['Follow selection', 'Follow now playing', 'External file...'];
				const optionsLength = options.length;
				options.forEach((item, i) => {
					menu.newEntry({menuName: subMenuNameTwo, entryText: item, func: () => {
						if (i === 2) {
							const input = Input.string('string', panel.imageBackground.mode === 2 ? panel.imageBackground.art.path : '', 'Set file path:\n(relative paths have as root the foobar2000 folder with the exe)', window.Name, 'myfile.jpg');
							if (input === null) {return;}
							panel.imageBackground.art.path = input;
						}
						panel.imageBackground.mode = i;
						panel.properties.imageBackground[1] = JSON.stringify(panel.imageBackground);
						overwriteProperties(panel.properties);
						panel.updateImageBg(true);
						window.Repaint();
					}});
				});
				menu.newCheckMenu(subMenuNameTwo, options[0], options[optionsLength - 1], () => {return panel.imageBackground.mode;});
			}
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			{
				const subMenuNameTwo = menu.newMenu('Display mode...', subMenuName);
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Maintain proportions', func: () => {
					panel.imageBackground.bProportions = !panel.imageBackground.bProportions;
					if (panel.imageBackground.bProportions) {panel.imageBackground.bFill = false;}
					panel.properties.imageBackground[1] = JSON.stringify(panel.imageBackground);
					overwriteProperties(panel.properties);
					panel.updateImageBg();
					window.Repaint();
				}});
				menu.newCheckMenu(subMenuNameTwo, 'Maintain proportions', void(0), () => {return panel.imageBackground.bProportions;});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Fill panel', func: () => {
					panel.imageBackground.bFill = !panel.imageBackground.bFill;
					if (panel.imageBackground.bFill) {panel.imageBackground.bProportions = false;}
					panel.properties.imageBackground[1] = JSON.stringify(panel.imageBackground);
					overwriteProperties(panel.properties);
					panel.updateImageBg();
					window.Repaint();
				}});
				menu.newCheckMenu(subMenuNameTwo, 'Fill panel', void(0), () => {return panel.imageBackground.bFill;});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Tint all UI elements', func: () => {
					panel.imageBackground.bTint = !panel.imageBackground.bTint;
					panel.properties.imageBackground[1] = JSON.stringify(panel.imageBackground);
					overwriteProperties(panel.properties);
					window.Repaint();
				}});
				menu.newCheckMenu(subMenuNameTwo, 'Tint all UI elements', void(0), () => {return panel.imageBackground.bTint;});
			}
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'Set transparency...\t' + _b(panel.imageBackground.transparency), func: () => {
				let input = Input.number('int positive', panel.imageBackground.transparency, 'Set transparency:\n(0-100)', window.Name, 50, [(n) => n >= 0 && n <= 100]);
				if (input === null) {return;}
				panel.imageBackground.transparency = input;
				panel.properties.imageBackground[1] = JSON.stringify(panel.imageBackground);
				overwriteProperties(panel.properties);
				panel.updateImageBg();
				window.Repaint();
			}});
			menu.newEntry({menuName: subMenuName, entryText: 'Set blur...\t' + _b(panel.imageBackground.blur), func: () => {
				let input = Input.number('int positive', panel.imageBackground.blur, 'Set blur:\n(>= 0)', window.Name, 10);
				if (input === null) {return;}
				panel.imageBackground.blur = input;
				panel.properties.imageBackground[1] = JSON.stringify(panel.imageBackground);
				overwriteProperties(panel.properties);
				panel.updateImageBg(true);
				window.Repaint();
			}});
		}
		menu.newEntry({menuName, entryText: 'sep'});
		{	// Columns
			const subMenuName = menu.newMenu('Columns...', menuName);
			menu.newEntry({menuName: subMenuName, entryText: 'Columns config:' + '\t' + (list.getColumnsEnabled() ? '(disabled)' : ''), flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			list.columns.labels.forEach((key, i) => {
				const subMenuColumn = menu.newMenu('Column ' + (i + 1) + '\t ' + _b(key), subMenuName);
				{	// Metadata
					const options = ['duration', 'size', 'fileSize', 'playlist_mbid', 'trackTags', 'isLocked'];
					const subMenuNameTwo = menu.newMenu('Metadata...', subMenuColumn);
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'Display:', flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
					const toEntry = (s) => capitalizeAll(s.replace(/[A-Z]/g, ' $&').replace(/_/g, ' '));
					options.forEach((opt) => {
						menu.newEntry({menuName: subMenuNameTwo, entryText: toEntry(opt) , func: () => {
							list.columns.labels[i] = opt;
							list.properties.columns[1] = JSON.stringify(list.columns);
							overwriteProperties(list.properties);
							list.repaint();
						}});
					});
					if (options.indexOf(key) !== -1) {menu.newCheckMenu(subMenuNameTwo, toEntry(options[0]), toEntry(options[options.length -1]), () => options.indexOf(key));}
				}
				{	// Size
					const options = ['normal', 'small', 'title'];
					const subMenuNameTwo = menu.newMenu('Size...', subMenuColumn);
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'Font size:', flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
					options.forEach((opt) => {
						menu.newEntry({menuName: subMenuNameTwo, entryText: capitalize(opt), func: () => {
							list.columns.font[i] = opt;
							list.properties.columns[1] = JSON.stringify(list.columns);
							overwriteProperties(list.properties);
							list.repaint();
						}});
					});
					menu.newCheckMenu(subMenuNameTwo, capitalize(options[0]), capitalize(options[options.length -1]), () => {const idx = options.indexOf(list.columns.font[i]); return (idx !== -1 ? idx : 0);});
				}
				{	// Align
					const options = ['right', 'left', 'center'];
					const subMenuNameTwo = menu.newMenu('Align...', subMenuColumn);
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'Alignment:', flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
					options.forEach((opt) => {
						menu.newEntry({menuName: subMenuNameTwo, entryText: capitalize(opt), func: () => {
							list.columns.align[i] = opt;
							list.properties.columns[1] = JSON.stringify(list.columns);
							overwriteProperties(list.properties);
							list.repaint();
						}});
					});
					menu.newCheckMenu(subMenuNameTwo, capitalize(options[0]), capitalize(options[options.length -1]), () => {const idx = options.indexOf(list.columns.align[i]); return (idx !== -1 ? idx : 0);});
				}
				{	// Color
					const options = ['playlistColor', 'textColor', 'custom'];
					const subMenuNameTwo = menu.newMenu('Color...', subMenuColumn);
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'Color:', flags: MF_GRAYED});
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
					options.forEach((opt) => {
						menu.newEntry({menuName: subMenuNameTwo, entryText: capitalize(opt), func: () => {
							list.columns.color[i] = opt === 'custom' ? utils.ColourPicker(window.ID, list.columns.color[i]) : opt;
							list.properties.columns[1] = JSON.stringify(list.columns);
							overwriteProperties(list.properties);
							list.repaint();
						}});
					});
					menu.newCheckMenu(subMenuNameTwo, capitalize(options[0]), capitalize(options[options.length -1]), () => {const idx = options.indexOf(list.columns.color[i]); return (idx !== -1 ? idx : (options.length - 1));});
				}
				// Width
				menu.newEntry({menuName: subMenuColumn, entryText: 'Width...' + '\t' + _b(list.columns.width[i]), func: () => {
					const input = Input.number('real positive', list.columns.width[i], 'Enter width: (px)\n(0 to set width automatically)', window.Name, 60);
					if (input === null) {return;}
					list.columns.width[i] = input || 'auto';
					list.properties.columns[1] = JSON.stringify(list.columns);
					overwriteProperties(list.properties);
					list.repaint();
				}});
				menu.newEntry({menuName: subMenuColumn, entryText: 'sep'});
				menu.newEntry({menuName: subMenuColumn, entryText: 'Show', func: () => {
					list.columns.bShown[i] = !list.columns.bShown[i];
					list.properties.columns[1] = JSON.stringify(list.columns);
					overwriteProperties(list.properties);
					list.repaint();
				}});
				menu.newCheckMenu(subMenuColumn, 'Show', void(0), () => list.columns.bShown[i]);
			});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'Add new column', func: () => {
				list.columns.labels.push('size');
				list.columns.width.push('auto');
				list.columns.font.push('normal');
				list.columns.align.push('right');
				list.columns.bShown.push(true);
				list.properties['columns'][1] = JSON.stringify(list.columns);
				overwriteProperties(list.properties);
				list.repaint();
			}});
			const subMenuNameTwo = menu.newMenu('Remove column...', subMenuName);
			list.columns.labels.forEach((key, i) => {
				const column = 'Column ' + ( i + 1) + '\t ' + _b(key);
				menu.newEntry({menuName: subMenuNameTwo, entryText: column, func: () => {
					list.columns.labels.splice(i, 1);
					list.columns.width.splice(i, 1);
					list.columns.font.splice(i, 1);
					list.properties['columns'][1] = JSON.stringify(list.columns);
					overwriteProperties(list.properties);
					list.repaint();
				}});
			});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			{	// Line
				const subMenuNameTwo = menu.newMenu('Border...', subMenuName);
				const options = ['none', 'first', 'all'];
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Column borders:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
				options.forEach((opt) => {
					menu.newEntry({menuName: subMenuNameTwo, entryText: capitalize(opt), func: () => {
						list.columns.line = opt;
						list.properties.columns[1] = JSON.stringify(list.columns);
						overwriteProperties(list.properties);
						list.repaint();
					}});
				});
				menu.newCheckMenu(subMenuNameTwo, capitalize(options[0]), capitalize(options[options.length -1]), () => {const idx = options.indexOf(list.columns.line); return idx !== -1 ? idx : 0;});
			}
			{	// Auto-Width
				const subMenuNameTwo = menu.newMenu('Auto-Width...', subMenuName);
				const options = ['entire list', 'current view'];
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Calculate by:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
				options.forEach((opt) => {
					menu.newEntry({menuName: subMenuNameTwo, entryText: capitalize(opt), func: () => {
						list.columns.autoWidth = opt;
						list.properties.columns[1] = JSON.stringify(list.columns);
						overwriteProperties(list.properties);
						list.repaint();
					}});
				});
				menu.newCheckMenu(subMenuNameTwo, capitalize(options[0]), capitalize(options[options.length -1]), () => {const idx = options.indexOf(list.columns.autoWidth); return idx !== -1 ? idx : 0;});
			}
			{	// Size unis
				const subMenuNameTwo = menu.newMenu('Size units...', subMenuName);
				const options = ['prefix', 'suffix'];
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'Calculate by:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
				options.forEach((opt) => {
					menu.newEntry({menuName: subMenuNameTwo, entryText: capitalize(opt) + '\t' + _b(list.columns.sizeUnits[opt]), func: () => {
						const mode = WshShell.Popup('Use unicode char codes?\nFor example: (escape | input | display)\n\\u2665 | 2665 | \u2665\n\\u266A | 266A | \u266A\n\nMore info:\nhttps://www.rapidtables.com/code/text/unicode-characters.html', 0, window.Name, popup.question + popup.yes_no) === popup.yes 
							? 'unicode'
							: 'string';
						const input = Input.string(mode, list.columns.sizeUnits[opt], 'Enter string to show as prefix/suffix:' + (mode === 'unicode' ? '\n(unicode chars are split by blank spaces)' : ''), window.Name, mode === 'unicode' ? '' : ' t.');
						if (input === null) {return;}
						list.columns.sizeUnits[opt] = input;
						list.properties.columns[1] = JSON.stringify(list.columns);
						overwriteProperties(list.properties);
						list.repaint();
					}});
					menu.newCheckMenu(subMenuNameTwo, capitalize(opt), void(0), () => list.columns.sizeUnits[opt].toString().length !== 0);
				});
			}
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'Restore defaults', func: () => {
				list.properties.columns[1] = list.properties.columns[3];
				list.columns =  JSON.parse(list.properties.columns[1])
				overwriteProperties(list.properties);
				list.repaint();
			}});
		}
		{	// Enabled UI elements
			const subMenuName = menu.newMenu('UI elements...', menuName);
			menu.newEntry({menuName: subMenuName, entryText: 'Elements shown:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			Object.keys(list.uiElements).forEach((key) => {
				const subElement = list.uiElements[key];
				if (subElement.hasOwnProperty('elements')) {
					const subMenuNameTwo = menu.newMenu(key, subMenuName);
					const keys = list.bLiteMode 
						? Object.keys(subElement.elements).filter((subKey) => subKey !== 'Folder')
						: Object.keys(subElement.elements);
					const bCanHideSettings = (subKey) => {
						if (!list.uiElements['Search filter'].enabled) {return true;}
						else if (subKey === 'Settings menu') {return subElement.elements.hasOwnProperty('Power actions') && subElement.elements['Power actions'].enabled;}
						else if (subKey === 'Power actions') {return subElement.elements.hasOwnProperty('Settings menu') && subElement.elements['Settings menu'].enabled;}
						else {return true;}
					}
					keys.forEach((subKey) => {
						const flags = bCanHideSettings(subKey)
							? MF_STRING
							: MF_GRAYED;
						menu.newEntry({menuName: subMenuNameTwo, entryText: subKey, func: () => {
							subElement.elements[subKey].enabled = !subElement.elements[subKey].enabled;
							list.properties.uiElements[1] = JSON.stringify(list.uiElements);
							overwriteProperties(list.properties);
							list.updateUIElements();
						}, flags});
						menu.newCheckMenu(subMenuNameTwo, subKey, void(0), () => subElement.elements[subKey].enabled);
					});
					menu.newEntry({menuName: subMenuNameTwo, entryText: 'sep'});
					const bEnable = keys.some((subKey) => !subElement.elements[subKey].enabled);
					menu.newEntry({menuName: subMenuNameTwo, entryText: (bEnable ? 'Enable' : 'Disable') + ' all', func: () => {
						keys.forEach((subKey) => {
							if (!bEnable && !bCanHideSettings(subKey)) {return;}
							subElement.elements[subKey].enabled = bEnable;
						});
						list.properties.uiElements[1] = JSON.stringify(list.uiElements);
						overwriteProperties(list.properties);
						list.updateUIElements();
					}});
				} else {
					menu.newEntry({menuName: subMenuName, entryText: key, func: () => {
						subElement.enabled = !subElement.enabled;
						list.properties.uiElements[1] = JSON.stringify(list.uiElements);
						overwriteProperties(list.properties);
						const bReload = ['Scrollbar'].indexOf(key) !== -1;
						list.updateUIElements(bReload);
					}});
					menu.newCheckMenu(subMenuName, key, void(0), () => subElement.enabled);
				}
			});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			{ // Presets
				const options = [
					{name: 'Full', elements: {
						'Search filter':			{enabled: true},
						'Columns':					{enabled: true},
						'Header buttons':			{enabled: true, elements: 
							{
								'Power actions':	{enabled: true},
								'Reset filters':	{enabled: true},
								'List menu':		{enabled: true},
								'Settings menu':	{enabled: true},
								'Folder':			{enabled: list.bLiteMode ? false : true},
								'Help':				{enabled: true},
							}
						}}
					},
					{name: 'Essential + Search', elements: {
						'Search filter':			{enabled: true},
						'Header buttons':			{enabled: true, elements: 
							{
								'Power actions':	{enabled: true},
								'Reset filters':	{enabled: true},
								'List menu':		{enabled: true},
								'Settings menu':	{enabled: false},
								'Folder':			{enabled: false},
								'Help':				{enabled: false},
							}
						}}
					},
					{name: 'Essential', elements: {
						'Search filter':			{enabled: false},
						'Header buttons':			{enabled: true, elements: 
							{
								'Power actions':	{enabled: true},
								'Reset filters':	{enabled: true},
								'List menu':		{enabled: true},
								'Settings menu':	{enabled: false},
								'Folder':			{enabled: false},
								'Help':				{enabled: false},
							}
						}}
					},
					{name: 'Simple header', elements: {
						'Search filter':			{enabled: false},
						'Header buttons':			{enabled: false, elements: 
							{
								'Power actions':	{enabled: false},
								'Reset filters':	{enabled: false},
								'List menu':		{enabled: false},
								'Settings menu':	{enabled: false},
								'Folder':			{enabled: false},
								'Help':				{enabled: false},
							}
						}}
					},
				];
				const subMenuNameTwo = menu.newMenu('Presets...', subMenuName);
				options.forEach((preset) => {
					menu.newEntry({menuName: subMenuNameTwo, entryText: preset.name, func: () => {
						Object.keys(preset.elements).forEach((key) => {
							const subElement = preset.elements[key];
							const subElementList = list.uiElements[key];
							if (subElement.hasOwnProperty('elements')) {
								const keys = Object.keys(subElement.elements);
								keys.forEach((subKey) => {
									subElementList.elements[subKey].enabled = subElement.elements[subKey].enabled;
								});
							} else {
								subElementList.enabled = subElement.enabled;
							}
						});
						list.properties.uiElements[1] = JSON.stringify(list.uiElements);
						overwriteProperties(list.properties);
						list.updateUIElements();
					}});
				});
			}
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'Restore defaults', func: () => {
				list.properties.uiElements[1] = list.properties.uiElements[3];
				list.uiElements = JSON.parse(list.properties.uiElements[1]);
				overwriteProperties(list.properties);
				list.updateUIElements();
			}});
		}
		menu.newEntry({menuName, entryText: 'sep'});
		{	// QuickSearch
			const subMenuName = menu.newMenu('Quick-search...', menuName);
			{
				menu.newEntry({menuName: subMenuName, entryText: 'Quick-search configuration:', flags: MF_GRAYED});
				menu.newEntry({menuName: subMenuName, entryText: 'sep'});
				menu.newEntry({menuName: subMenuName, entryText: 'Jump to next item on multiple presses', func: () => {
					list.properties.bQuicSearchNext[1] = !list.properties.bQuicSearchNext[1];
					overwriteProperties(list.properties);
					fb.ShowPopupMessage('Enabling this option will allow to jump between items starting with the same char, instead of reusing the previous string.\n\nFor ex: pressing two times \'a\' will look for a playlist starting with \'a\' on first pressing and then for the next one.\n\nWhen the option is disabled, it would just look for a playlist starting with \'aa\'.', window.Name);
				}});
				menu.newCheckMenu(subMenuName, 'Jump to next item on multiple presses', void(0), () => list.properties.bQuicSearchNext[1]);
				menu.newEntry({menuName: subMenuName, entryText: 'Cycle on last result?', func: () => {
					list.properties.bQuicSearchCycle[1] = !list.properties.bQuicSearchCycle[1];
					overwriteProperties(list.properties)
					if (list.properties.bQuicSearchCycle[1]) {
						fb.ShowPopupMessage('Enabling this option will cycle between all the found items, not stopping on the last one but going back to the first one when no more items are found.', window.Name);
					}
				}, flags: list.properties.bQuicSearchNext[1] ? MF_STRING : MF_GRAYED});
				menu.newCheckMenu(subMenuName, 'Cycle on last result?', void(0), () => list.properties.bQuicSearchCycle[1]);
			}
		}
	}
	menu.newEntry({entryText: 'sep'});
	{	// Shortcuts
		const subMenuName = menu.newMenu('Shortcuts...');
		menu.newEntry({menuName: subMenuName, entryText: 'Mouse / Keyboard actions:', flags: MF_GRAYED});
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		{	// List L. Click
			const bListButton = list.uiElements['Header buttons'].elements['List menu'].enabled;
			const subMenuNameL = menu.newMenu('Left Click', subMenuName)
			const shortcuts =  list.getDefaultShortcuts('L');
			const modifiers = shortcuts.options.map((_) => {return _.key;});
			const actions = shortcuts.actions.map((_) => {return _.key;});
			menu.newEntry({menuName: subMenuNameL, entryText: 'Modifiers on L. Click:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuNameL, entryText: 'sep'});
			modifiers.forEach((modifier) => {
				const subMenuOption = modifier === 'Single Click' && !bListButton
					? menu.newMenu(modifier + '\t(enable List Menu button)', subMenuNameL, MF_GRAYED)
					: menu.newMenu(modifier, subMenuNameL);
				actions.forEach((action) => {
					const flags = modifier === 'Double Click' && action === 'Multiple selection' ? MF_GRAYED : MF_STRING;
					menu.newEntry({menuName: subMenuOption, entryText: action, func: () => {
						list.lShortcuts[modifier] = action;
						list.properties['lShortcuts'][1] = JSON.stringify(list.lShortcuts);
						overwriteProperties(list.properties);
						if (action === 'Multiple selection') {
							fb.ShowPopupMessage('Allows to select multiple playlists at the same time and execute a shortcut action for every item. i.e. Loading playlist, locking, etc.\n\nNote opening the playlist menu will show a limited list of available actions according to the selection. To display the entire menu, use single selection instead. ', window.Name);
						}
					}, flags});
				});
				menu.newCheckMenu(subMenuOption, actions[0], actions[actions.length - 1], () => {
					const idx = actions.indexOf(list.lShortcuts[modifier]);
					return (idx !== -1 ? idx : 0);
				});
			});
			menu.newEntry({menuName: subMenuNameL, entryText: 'sep'});
			menu.newEntry({menuName: subMenuNameL, entryText: 'Restore defaults', func: () => {
				list.properties['lShortcuts'][1] = list.defaultProperties['lShortcuts'][3];
				list.lShortcuts = JSON.parse(list.properties['lShortcuts'][1]);
				overwriteProperties(list.properties);
			}});
		}
		{	// List R. Click
			const bListButton = list.uiElements['Header buttons'].elements['List menu'].enabled;
			const subMenuNameR = menu.newMenu('Right Click' + (bListButton ? '' : '\t(enable List Menu button)'), subMenuName, bListButton ? MF_STRING : MF_GRAYED)
			const shortcuts =  list.getDefaultShortcuts('R');
			const modifiers = shortcuts.options.map((_) => {return _.key;});
			const actions = shortcuts.actions.map((_) => {return _.key;});
			menu.newEntry({menuName: subMenuNameR, entryText: 'Modifiers on R. Click:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuNameR, entryText: 'sep'});
			modifiers.forEach((modifier) => {
				const subMenuOption = menu.newMenu(modifier, subMenuNameR);
				actions.forEach((action) => {
					menu.newEntry({menuName: subMenuOption, entryText: action, func: () => {
						list.rShortcuts[modifier] = action;
						list.properties['rShortcuts'][1] = JSON.stringify(list.rShortcuts);
						overwriteProperties(list.properties);
						if (action === 'Multiple selection') {
							fb.ShowPopupMessage('Allows to select multiple playlists at the same time and execute a shortcut action for every item. i.e. Loading playlist, locking, etc.\n\nNote opening the playlist menu will show a limited list of available actions according to the selection. To display the entire menu, use single selection instead. ', window.Name);
						}
					}});
				});
				menu.newCheckMenu(subMenuOption, actions[0], actions[actions.length - 1], () => {
					const idx = actions.indexOf(list.rShortcuts[modifier]);
					return (idx !== -1 ? idx : 0);
				});
			});
			menu.newEntry({menuName: subMenuNameR, entryText: 'sep'});
			menu.newEntry({menuName: subMenuNameR, entryText: 'Restore defaults', func: () => {
				list.properties['rShortcuts'][1] = list.defaultProperties['rShortcuts'][3];
				list.rShortcuts = JSON.parse(list.properties['rShortcuts'][1]);
				overwriteProperties(list.properties);
			}});
		}
		{	// List M. Click
			const subMenuNameM = menu.newMenu('Middle Click', subMenuName)
			const shortcuts =  list.getDefaultShortcuts('M');
			const modifiers = shortcuts.options.map((_) => {return _.key;});
			const actions = shortcuts.actions.map((_) => {return _.key;});
			menu.newEntry({menuName: subMenuNameM, entryText: 'Modifiers on M. Click:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuNameM, entryText: 'sep'});
			modifiers.forEach((modifier) => {
				const subMenuOption = menu.newMenu(modifier, subMenuNameM);
				actions.forEach((action) => {
					menu.newEntry({menuName: subMenuOption, entryText: action, func: () => {
						list.mShortcuts[modifier] = action;
						list.properties['mShortcuts'][1] = JSON.stringify(list.mShortcuts);
						overwriteProperties(list.properties);
						if (action === 'Multiple selection') {
							fb.ShowPopupMessage('Allows to select multiple playlists at the same time and execute a shortcut action for every item. i.e. Loading playlist, locking, etc.\n\nNote opening the playlist menu will show a limited list of available actions according to the selection. To display the entire menu, use single selection instead. ', window.Name);
						}
					}});
				});
				menu.newCheckMenu(subMenuOption, actions[0], actions[actions.length - 1], () => {
					const idx = actions.indexOf(list.mShortcuts[modifier]);
					return (idx !== -1 ? idx : 0);
				});
			});
			menu.newEntry({menuName: subMenuNameM, entryText: 'sep'});
			menu.newEntry({menuName: subMenuNameM, entryText: 'Restore defaults', func: () => {
				list.properties['mShortcuts'][1] = list.defaultProperties['mShortcuts'][3];
				list.mShortcuts = JSON.parse(list.properties['mShortcuts'][1]);
				overwriteProperties(list.properties);
			}});
		}
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		{	// Header L. Click
			const subMenuNameL = menu.newMenu('Left Click (header)', subMenuName)
			const shortcuts =  list.getDefaultShortcuts('L', 'HEADER');
			const modifiers = shortcuts.options.map((_) => {return _.key;});
			const actions = shortcuts.actions.map((_) => {return _.key;});
			menu.newEntry({menuName: subMenuNameL, entryText: 'Modifiers on L. Click:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuNameL, entryText: '(on Action Button)', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuNameL, entryText: 'sep'});
			modifiers.forEach((modifier) => {
				const subMenuOption = menu.newMenu(modifier, subMenuNameL);
				actions.forEach((action) => {
					const flags = modifier === 'Double Click' && action === 'Multiple selection' ? MF_GRAYED : MF_STRING;
					menu.newEntry({menuName: subMenuOption, entryText: action, func: () => {
						list.lShortcutsHeader[modifier] = action;
						list.properties['lShortcutsHeader'][1] = JSON.stringify(list.lShortcutsHeader);
						overwriteProperties(list.properties);
						if (action === 'Multiple selection') {
							fb.ShowPopupMessage('Allows to select multiple playlists at the same time and execute a shortcut action for every item. i.e. Loading playlist, locking, etc.\n\nNote opening the playlist menu will show a limited list of available actions according to the selection. To display the entire menu, use single selection instead. ', window.Name);
						}
					}, flags});
				});
				menu.newCheckMenu(subMenuOption, actions[0], actions[actions.length - 1], () => {
					const idx = actions.indexOf(list.lShortcutsHeader[modifier]);
					return (idx !== -1 ? idx : 0);
				});
			});
			menu.newEntry({menuName: subMenuNameL, entryText: 'sep'});
			menu.newEntry({menuName: subMenuNameL, entryText: 'Restore defaults', func: () => {
				list.properties['lShortcutsHeader'][1] = list.defaultProperties['lShortcutsHeader'][3];
				list.lShortcutsHeader = JSON.parse(list.properties['lShortcutsHeader'][1]);
				overwriteProperties(list.properties);
			}});
		}
		{	// Header M. Click
			const subMenuNameM = menu.newMenu('Middle Click (header)', subMenuName)
			const shortcuts =  list.getDefaultShortcuts('M', 'HEADER');
			const modifiers = shortcuts.options.map((_) => {return _.key;});
			const actions = shortcuts.actions.map((_) => {return _.key;});
			menu.newEntry({menuName: subMenuNameM, entryText: 'Modifiers on M. Click:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuNameM, entryText: '(on Action Button)', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuNameM, entryText: 'sep'});
			modifiers.forEach((modifier) => {
				const subMenuOption = menu.newMenu(modifier, subMenuNameM);
				actions.forEach((action) => {
					menu.newEntry({menuName: subMenuOption, entryText: action, func: () => {
						list.mShortcutsHeader[modifier] = action;
						list.properties['mShortcutsHeader'][1] = JSON.stringify(list.mShortcutsHeader);
						overwriteProperties(list.properties);
						if (action === 'Multiple selection') {
							fb.ShowPopupMessage('Allows to select multiple playlists at the same time and execute a shortcut action for every item. i.e. Loading playlist, locking, etc.\n\nNote opening the playlist menu will show a limited list of available actions according to the selection. To display the entire menu, use single selection instead. ', window.Name);
						}
					}});
				});
				menu.newCheckMenu(subMenuOption, actions[0], actions[actions.length - 1], () => {
					const idx = actions.indexOf(list.mShortcutsHeader[modifier]);
					return (idx !== -1 ? idx : 0);
				});
			});
			menu.newEntry({menuName: subMenuNameM, entryText: 'sep'});
			menu.newEntry({menuName: subMenuNameM, entryText: 'Restore defaults', func: () => {
				list.properties['mShortcutsHeader'][1] = list.defaultProperties['mShortcutsHeader'][3];
				list.mShortcutsHeader = JSON.parse(list.properties['mShortcutsHeader'][1]);
				overwriteProperties(list.properties);
			}});
		}
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		{	// Keyboard
			menu.newEntry({menuName: subMenuName, entryText: 'Enable F1-F8 keyboard actions', func: () => {
				fb.ShowPopupMessage(
					'- F1: Lock/unlock playlist file or UI-only playlist.\n' +
					'- F2: Rename highlighted playlist.\n' +
					'- F3: Clone in UI highlighted playlist.\n' +
					'- F4: Load/show highlighted playlist\n' +
					'- F5: Copy highlighted playlist. Maintains original format.\n' +
					'- F6: Export playlist to ListenBrainz (+ Spotify).\n' +
					'- F7: Add new (empty) playlist.\n' +
					'- F8: Delete highlighted playlist.\n' +
					'- F9: Filter/Search playlists with selected tracks\n' +
					'- F10: Open Settings menu.\n' +
					'- F10 + Shift: Open List menu.\n' +
					'- F11: Open documentation.\n' +
					'- F12: Open playlists tracked folder.'
				, window.Name);
				list.properties.bGlobalShortcuts[1] = !list.properties.bGlobalShortcuts[1]
				overwriteProperties(list.properties);
			}});
			menu.newCheckMenu(subMenuName, 'Enable F1-F8 keyboard actions', void(0), () => list.properties.bGlobalShortcuts[1]);
		}
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		menu.newEntry({menuName: subMenuName, entryText: 'Double click timer...', func: () => {
			let input = Input.number('int positive', list.iDoubleClickTimer, 'Enter ms:\nHigher values will delay more single clicking actions.', window.Name, 300);
			if (input === null) {return;}
			if (!Number.isFinite(input)) {return;}
			list.iDoubleClickTimer = list.properties.iDoubleClickTimer[1] = input;
			if (WshShell.Popup('Update tooltip timer?\n(Dbl. Click timer x2)', 0, window.Name, popup.question + popup.yes_no) === popup.yes) {
				list.properties.iTooltipTimer[1] = input * 2;
				list.tooltip.SetDelayTime(0, list.properties.iTooltipTimer[1]); // TTDT_AUTOMATIC
			}
			overwriteProperties(list.properties);
		}});
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		menu.newEntry({menuName: subMenuName, entryText: 'Restore defaults (all)', func: () => {
			['lShortcuts', 'mShortcuts', 'lShortcutsHeader', 'mShortcutsHeader'].forEach((key) => {
				list.properties[key][1] = list.defaultProperties[key][3];
				list[key] = JSON.parse(list.properties[key][1]);
			});
			overwriteProperties(list.properties);
		}});
	}
	{	// Enabled menus
		const showMenus = JSON.parse(list.properties.showMenus[1]);
		const liteOmmit = ['Relative paths handling', 'Export and copy', 'File management', 'File locks'];
		const subMenuName = menu.newMenu('Features...');
		menu.newEntry({menuName: subMenuName, entryText: 'Menu entries / Features enabled:', flags: MF_GRAYED});
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		Object.keys(showMenus).forEach((key) => {
			if (list.bLiteMode && liteOmmit.includes(key)) {return;}
			menu.newEntry({menuName: subMenuName, entryText: key, func: () => {
				showMenus[key] = !showMenus[key];
				list.properties.showMenus[1] = JSON.stringify(showMenus);
				overwriteProperties(list.properties);
				list.checkConfigPostUpdate(list.checkConfig({bSilentSorting: true})); // Ensure related config is set properly
			}});
			menu.newCheckMenu(subMenuName, key, void(0), () => showMenus[key]);
		});
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		{ // Presets
			const defOpts = JSON.parse(list.properties.showMenus[3]);
			const options = [
				{name: 'Full', options: Object.fromEntries(Object.keys(showMenus).map((k) => [k, true]))},
				{name: 'Bassic', options: {...defOpts, ...Object.fromEntries(['Tags', 'Relative paths handling', 'Export and copy', 'Online sync'].map((k) => [k, false]))}},
			];
			const subMenuNameTwo = menu.newMenu('Presets...', subMenuName);
			options.forEach((preset) => {
				menu.newEntry({menuName: subMenuNameTwo, entryText: preset.name, func: () => {
					Object.keys(preset.options).forEach((key) => {
						if (list.bLiteMode && liteOmmit.includes(key)) {return;}
						showMenus[key] = preset.options[key];
					});
					list.properties.showMenus[1] = JSON.stringify(showMenus);
					overwriteProperties(list.properties);
					list.checkConfigPostUpdate(list.checkConfig({bSilentSorting: true})); // Ensure related config is set properly
				}});
			});
		}
		menu.newEntry({menuName: subMenuName, entryText: 'sep'});
		menu.newEntry({menuName: subMenuName, entryText: 'Restore defaults', func: () => {
			list.properties.showMenus[1] = list.properties.showMenus[3];
			overwriteProperties(list.properties);
			list.checkConfigPostUpdate(list.checkConfig({bSilentSorting: true})); // Ensure related config is set properly
		}});
	}
	{	// Integration
		const menuName = menu.newMenu('Integration');
		{	// Dynamic menus
			const flags = isCompatible('1.6.1', 'smp') ? MF_STRING : MF_GRAYED;
			const subMenuName = menu.newMenu('Create dynamic menus...', menuName);
			const options = ['Yes: for CMD, foo_httpcontrol (ajquery-xxx), ...', 'No: don\'t integrate the panel in main menu'];
			const optionsLength = options.length;
			menu.newEntry({menuName: subMenuName, entryText: 'File\\Spider Monkey Panel\\Script commands:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			options.forEach((item, i) => {
				menu.newEntry({menuName: subMenuName, entryText: item, func: () => {
					list.bDynamicMenus = i === 0 ? true : false;
					if (list.bDynamicMenus) {
						fb.ShowPopupMessage('Remember to set different panel names to every Playlist Manager panel, otherwise menus will not be properly associated to a single panel.\n\nShift + Win + R. Click -> Configure panel... (\'edit\' at top)\n\nPlaylists tagged with \'bMultMenu\' will be associated to these special\nmenu entries:\n\t-Load tagged playlists\n\t-Clone tagged playlists in UI', window.Name);
					}
					list.properties['bDynamicMenus'][1] = list.bDynamicMenus;
					overwriteProperties(list.properties);
					// And create / delete menus
					if (list.bDynamicMenus) {list.createMainMenuDynamic().then(() => {list.exportPlaylistsInfo(); list.checkPanelNames();});} 
					else {list.deleteMainMenuDynamic(); list.deleteExportInfo(); list.listenNames = false;}
					if (folders.ajqueryCheck()) {exportComponents(folders.ajquerySMP);}
				}, flags});
			});
			menu.newCheckMenu(subMenuName, options[0], options[optionsLength - 1],  () => {return (list.bDynamicMenus ? 0 : 1);});
		}
		if (showMenus['Online sync']) {	// ListenBrainz
			const subMenuName = menu.newMenu('ListenBrainz...', menuName);
			menu.newEntry({menuName: subMenuName, entryText: 'Set token...', func: async () => {return await checkLBToken('');}});
			menu.newCheckMenu(subMenuName, 'Set token...', void(0), () => {return list.properties.lBrainzToken[1].length ? true : false;});
			menu.newEntry({menuName: subMenuName, entryText: 'Retrieve token from other panels...', func: () => {
				callbacksListener.lBrainzTokenListener = true;
				let cache = {token: list.properties.lBrainzToken[1], encrypted: list.properties.lBrainzEncrypt[1]};
				window.NotifyOthers('xxx-scripts: lb token', null);
				setTimeout(() => {
					callbacksListener.lBrainzTokenListener = false;
					fb.ShowPopupMessage('ListenBrainz token report:\n\nOld value:  ' + cache.toStr({bClosure: true}) + '\nNew value:  ' + {token: list.properties.lBrainzToken[1], encrypted: list.properties.lBrainzEncrypt[1]}.toStr({bClosure: true}), window.Name);
				}, 1500);
			}});
			menu.newEntry({menuName: subMenuName, entryText: 'Open user profile'  + (bListenBrainz ? '' : '\t(token not set)'), func: async () => {
				if (!await checkLBToken()) {return;}
				const token = bListenBrainz ? lb.decryptToken({lBrainzToken: list.properties.lBrainzToken[1], bEncrypted: list.properties.lBrainzEncrypt[1]}) : null;
				if (!token) {return false;}
				const user = await lb.retrieveUser(token);
				if (user.length) {_runCmd('CMD /C START https://listenbrainz.org/user/' + user + '/playlists/', false);}
			}, flags: bListenBrainz ? MF_STRING: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'Lookup for missing track MBIDs?', func: () => {
				list.properties.bLookupMBIDs[1] = !list.properties.bLookupMBIDs[1];
				if (list.properties.bLookupMBIDs[1]) {
					fb.ShowPopupMessage('Exporting a playlist requires tracks to have \'MUSICBRAINZ_TRACKID\' tags on files.\n\nWhenever such tag is missing, the file can not be sent to ListenBrainz\'s online playlist. As workaround, the script may try to lookup missing MBIDs before exporting.\n\nNote results depend on the success of MusicBrainz api, so it\'s not guaranteed to find the proper match in all cases. Tag properly your files with Picard or foo_musicbrainz in such case.\n\nApi used:\nhttps://labs.api.listenbrainz.org/mbid-mapping', window.Name);
				}
				overwriteProperties(list.properties);
			}, flags: bListenBrainz ? MF_STRING: MF_GRAYED});
			menu.newCheckMenu(subMenuName, 'Lookup for missing track MBIDs?', void(0), () => {return list.properties.bLookupMBIDs[1];});
			menu.newEntry({menuName: subMenuName, entryText: 'Export playlists to Spotify?', func: () => {
				list.properties.bSpotify[1] = !list.properties.bSpotify[1];
				if (list.properties.bSpotify[1]) {
					fb.ShowPopupMessage('Exporting a playlist to Spotify requires the service to be connected to your user profile, and \'Play music on ListenBrainz\' enabled.\n\nMore info: https://listenbrainz.org/profile/music-services/details/', window.Name);
					const token = bListenBrainz ? lb.decryptToken({lBrainzToken: list.properties.lBrainzToken[1], bEncrypted: list.properties.lBrainzEncrypt[1]}) : null;
					if (token) {
						lb.retrieveUser(token).then((user) => listenBrainz.getUserServices(user, token)).then((services) => {
							if (services.indexOf('spotify') === -1) {
								fb.ShowPopupMessage('Spotify\'s service is not connected.\n\nMore info: https://listenbrainz.org/profile/music-services/details/', window.Name);
							}
						});
					}
				}
				overwriteProperties(list.properties);
			}, flags: bListenBrainz ? MF_STRING: MF_GRAYED});
			menu.newCheckMenu(subMenuName, 'Export playlists to Spotify?', void(0), () => {return list.properties.bSpotify[1];});
		}
		{	// Startup active playlist
			const nameUI = plman.GetPlaylistName(plman.ActivePlaylist);
			const idx = list.dataAll.findIndex((pls, idx) => {return pls.nameId === nameUI;});
			const name = idx !== -1 ? list.dataAll[idx].name : nameUI;
			
			const subMenuName = menu.newMenu('Startup active playlist...', menuName);
			menu.newEntry({menuName: subMenuName, entryText: 'Set active playlist at startup:', flags: MF_GRAYED});
			menu.newEntry({menuName: subMenuName, entryText: 'sep'});
			menu.newEntry({menuName: subMenuName, entryText: 'Current playlist', func: () => {
				list.activePlsStartup = list.activePlsStartup === name ? '' : name;
				list.properties.activePlsStartup[1] = list.activePlsStartup;
				overwriteProperties(list.properties);
				window.NotifyOthers('Playlist manager: change startup playlist', list.activePlsStartup);
			}, flags: plman.ActivePlaylist !== -1 ? MF_STRING : MF_GRAYED});
			menu.newCheckMenu(subMenuName, 'Current playlist', void(0), () => {return list.activePlsStartup === name;});
			menu.newEntry({menuName: subMenuName, entryText: 'Input name...', func: () => {
				const input = Input.string('string', list.activePlsStartup, 'Input playlist name: (empty to disable)\n\nIn case the playlist is present on the manager, it\'s required to set \'bAutoLoad\' tag on playlist file to load it on startup too (otherwise playlist will not be loaded on startup).', 'Playlist Manager', 'My playlist');
				if (input === null) {return;}
				list.activePlsStartup = input;
				list.properties.activePlsStartup[1] = list.activePlsStartup;
				overwriteProperties(list.properties);
				window.NotifyOthers('Playlist manager: change startup playlist', list.activePlsStartup)
			}, flags: plman.ActivePlaylist !== -1 ? MF_STRING : MF_GRAYED});
			menu.newCheckMenu(subMenuName, 'Input name...', void(0), () => {return (list.activePlsStartup.length !== 0 && list.activePlsStartup !== name);});
		}
	}
	menu.newEntry({entryText: 'sep'});
	menu.newEntry({entryText: 'Lite mode', func: () => {
		fb.ShowPopupMessage('By default Playlist Manager is installed with a myriad of features and the ability to manage playlist files.\nSome users may be looking for a simple foo_plorg replacement, in which case lite mode should be enabled.\n\nNote on lite mode, manager exclusively tracks UI-only playlists.', window.Name)
		list.bLiteMode = !list.bLiteMode;
		list.properties['bLiteMode'][1] = list.bLiteMode;
		if (list.bLiteMode) {
			const features = ['Tags', 'Relative paths handling', 'Export and copy', 'Online sync', 'File locks'];
			const otherFeatures = ['Advanced search tools'];
			// Menus
			features.forEach((key) => {
				showMenus[key] = false;
			});
			list.properties.showMenus[3] = list.properties.showMenus[1] = JSON.stringify(showMenus);
			// Other tools
			if (list.searchInput) {
				list.searchMethod.bPath = list.searchMethod.bRegExp = false;
				list.properties.searchMethod[1] = JSON.stringify(list.searchMethod);
			}
			// Tracking
			list.bAllPls = list.properties.bAllPls[1] = true;
			overwriteProperties(list.properties);
			// Sorting
			list.changeSorting(list.manualMethodState());
			// Instances
			removeInstance('Playlist Manager');
		} else {
			addInstance('Playlist Manager');
		}
		list.checkConfigPostUpdate(list.checkConfig({bSilentSorting: true})); // Ensure related config is set properly
		list.manualRefresh();
	}});
	menu.newCheckMenu(void(0), 'Lite mode', void(0),  () => list.bLiteMode);
	menu.newEntry({entryText: 'sep'});
	{	// Readme
		const path = folders.xxx + 'readmes\\playlist_manager.pdf';
		menu.newEntry({entryText: 'Open documentation...',  func: () => {
			if (_isFile(path)) {
				const bDone = _run(path);
				if (!bDone) {_explorer(path);}
			} else {console.log('Readme not found: ' + path);}
		}});
	}
	return menu;
}

function createMenuRightSort() {
	// Constants
	const z = (list.index !== -1) ? list.index : list.getCurrentItemIndex();
	const menu = menuRbtnSort;
	menu.clear(true); // Reset one every call
	// Entries
	{	// Sorting
		const options = Object.keys(list.sortMethods(false)).slice(0, -1).sort().concat(['sep', list.manualMethodState()]);
		const optionsLength = options.length;
		menu.newEntry({entryText: 'Change sorting method:', flags: MF_GRAYED});
		menu.newEntry({entryText: 'sep'});
		if (optionsLength) {
			options.forEach((item) => {
				if (item === 'sep') {menu.newEntry({entryText: 'sep'}); return;}
				menu.newEntry({entryText: item, func: () => {
					list.changeSorting(item);
				}});
			});
		}
		menu.newCheckMenu(menu.getMainMenuName(), options[0], options[optionsLength - 1], () => {return options.filter((s) => s !== 'sep').indexOf(list.methodState);});
	}
	return menu;
}

function createMenuRightFilter(buttonKey) {
	// Constants
	const z = (list.index !== -1) ? list.index : list.getCurrentItemIndex();
	const menu = menuRbtnSort;
	menu.clear(true); // Reset one every call
	// Enabled menus
	const showMenus = JSON.parse(list.properties.showMenus[1]);
	// Entries
	{	// Filter
		const options = list.availableFilters();
		const optionsLength = options.length;
		menu.newEntry({entryText: 'Change filtering method:', flags: MF_GRAYED});
		menu.newEntry({entryText: 'sep'});
		if (optionsLength) {
			options.forEach((item) => {
				menu.newEntry({entryText: item, func: () => {
					// Switch buttons if they are duplicated
					const buttonsArr = Object.entries(buttonsPanel.buttons);
					const idx = buttonsArr.findIndex((pair) => {return pair[0] !== buttonKey && pair[1].method === item;});
					if (idx !== -1) {buttonsPanel.buttons[buttonsArr[idx][0]].method = buttonsPanel.buttons[buttonKey].method;}
					// Set new one
					buttonsPanel.buttons[buttonKey].method = item;
					// Resize buttons
					recalcWidth();
					// Save properties
					list.properties['filterMethod'][1] = Object.values(buttonsPanel.buttons).map((button) => {return (button.hasOwnProperty('method') ? button.method : '');}).filter(Boolean).join(',');
					overwriteProperties(list.properties);
				}});
			});
		}
		menu.newCheckMenu(menu.getMainMenuName(), options[0], options[optionsLength - 1],  () => {return options.indexOf(buttonsPanel.buttons[buttonKey].method);});
	}
	menu.newEntry({entryText: 'sep'});
	{
		menu.newEntry({entryText: 'Also reset search filter', func: () => {
			list.searchMethod.bResetFilters = !list.searchMethod.bResetFilters;
			list.properties.searchMethod[1] = JSON.stringify(list.searchMethod);
			overwriteProperties(list.properties);
		}, flags: list.searchInput ? MF_STRING : MF_GRAYED});
		menu.newCheckMenu(menu.getMainMenuName(), 'Also reset search filter', void(0),  () => list.searchMethod.bResetFilters);
	}
	menu.newEntry({entryText: 'sep'});
	{	// Reset
		menu.newEntry({entryText: 'Reset all filters', func: () => {
			list.resetFilter();
		}});
	}
	return menu;
}

function createMenuSearch() {
	// Constants
	const z = (list.index !== -1) ? list.index : list.getCurrentItemIndex();
	const menu = menuSearch;
	menu.clear(true); // Reset one every call
	// Enabled menus
	const showMenus = JSON.parse(list.properties.showMenus[1]);
	
	menu.newEntry({entryText: 'Search filter:', func: null, flags: MF_GRAYED});
	menu.newEntry({entryText: 'sep'});
	{
		if (list.searhHistory.length) {
			list.searhHistory.slice(-5).forEach((text) => {
				menu.newEntry({entryText: text.length > 20 ? text.substr(0, 20) + '...' : text, func: () => {
					list.searchCurrent = text;
					window.Repaint();
				}});
			});
			menu.newEntry({entryText: 'sep'});
			menu.newEntry({entryText: 'Clear history', func: () => {
				list.searhHistory.splice(0, Infinity);
			}});
		} else {
			menu.newEntry({entryText: '- no search history -', func: null, flags: MF_GRAYED});
		}
	}
	menu.newEntry({entryText: 'sep'});
	// Settings
	{	// Filter
		const subMenu = menu.newMenu('Settings...');
		const options = [
			{entryText: 'By names', key: 'bName'},
			showMenus['Tags'] ? {entryText: 'By tags', key: 'bTags'} : null,
			showMenus['Category'] ? {entryText: 'By categories', key: 'bCategory'} : null,
			{entryText: 'By file and folder names', key: 'bPath'}
		].filter(Boolean).sort();
		const optionsLength = options.length;
		menu.newEntry({menuName: subMenu, entryText: 'Change filtering method:', flags: MF_GRAYED});
		menu.newEntry({menuName: subMenu, entryText: 'sep'});
		options.forEach((opt) => {
			menu.newEntry({menuName: subMenu, entryText: opt.entryText, func: () => {
				list.searchMethod[opt.key] = !list.searchMethod[opt.key];
				// Save properties
				list.properties.searchMethod[1] = JSON.stringify(list.searchMethod);
				overwriteProperties(list.properties);
				if (list.searchInput.text.length || list.searchInput.prev_text.length) {
					list.search();
				}
				if (opt.key === 'bPath' && list.searchMethod[opt.key]) {
					fb.ShowPopupMessage(
						'This option performs an extended search looking into the playlist files for matches against the tracks file paths. The file and folder names are used.' + 
						'\n\nIt may produce some lag while searching if there are a lot of playlists, so disable it if not needed.' + 
						'\n\nFor ex:' +
						'\nSimon & Garfunkel\\Bookends {2014 HD Tracks HD886447698259}\\01 - Mrs. Robinson.flac' + 
						'\nWould match a search containing \'HD Tracks\' or \'Robinson\' but not \'Simon\'.' + 
						'\n\nDrag n\' drop integration:' + 
						'\nWhen using drag n\' drop over the search input box, the filename(s) of the selected track(s) will be automatically parsed for quick-searching. \'Parse RegExp expressions\' must be enabled to search for multiple filenames at the same time.'
						, window.Name
					);
				}
			}});
			menu.newCheckMenu(subMenu, opt.entryText, void(0),  () => list.searchMethod[opt.key]);
		});
		menu.newEntry({menuName: subMenu, entryText: 'sep'});
		menu.newEntry({menuName: subMenu, entryText: 'Path level matching...' + '\t' + _b(list.searchMethod.pathLevel), func: () => {
			let input = Input.number('int positive', list.searchMethod.pathLevel, 'Enter path level to search matches:', window.Name, 2);
			if (input === null) {return;}
			list.searchMethod.pathLevel = input;
			list.properties.searchMethod[1] = JSON.stringify(list.searchMethod);
			overwriteProperties(list.properties);
		}});
		menu.newEntry({menuName: subMenu, entryText: 'sep'});
		menu.newEntry({menuName: subMenu, entryText: 'Auto-search', func: () => {
			list.searchMethod.bAutoSearch = !list.searchMethod.bAutoSearch;
			list.searchInput.autovalidation = list.searchMethod.bAutoSearch;
			list.properties.searchMethod[1] = JSON.stringify(list.searchMethod);
			overwriteProperties(list.properties);
			if (list.searchInput.autovalidation && list.searchInput.text.length || list.searchInput.prev_text.length) {
				list.search();
			}
		}});
		menu.newCheckMenu(subMenu, 'Auto-search', void(0),  () => list.searchMethod.bAutoSearch);
		menu.newEntry({menuName: subMenu, entryText: 'Parse RegExp expressions', func: () => {
			list.searchMethod.bRegExp = !list.searchMethod.bRegExp;
			list.properties.searchMethod[1] = JSON.stringify(list.searchMethod);
			overwriteProperties(list.properties);
			if (list.searchInput.autovalidation && list.searchInput.text.length || list.searchInput.prev_text.length) {
				list.search();
			}
			if (list.searchMethod.bRegExp) {
				fb.ShowPopupMessage(
					'This option will parse RegExp expressions on the input box and apply it to the list. For ex:' +
					'\n\n/Top/ would match \'Top tracks\' but /top/ would not.\Searching for \'top\' or \'Top\' as plain text would perform a case insensitive search in any case, being thus equivalent to /top/i.' + 
					'\n\nFor more info see:' +
					'\nhttps://regexr.com/' +
					'\n\nDrag n\' drop integration:' + 
					'\nWhen using drag n\' drop over the search input box, the filename(s) of the selected track(s) will be automatically parsed for quick-searching. \'Parse RegExp expressions\' must be enabled to search for multiple filenames at the same time.'
				, window.Name);
			}
		}});
		menu.newCheckMenu(subMenu, 'Parse RegExp expressions', void(0),  () => list.searchMethod.bRegExp);
		menu.newEntry({menuName: subMenu, entryText: 'Reset along button filters', func: () => {
			list.searchMethod.bResetFilters = !list.searchMethod.bResetFilters;
			list.properties.searchMethod[1] = JSON.stringify(list.searchMethod);
			overwriteProperties(list.properties);
		}});
		menu.newCheckMenu(subMenu, 'Reset along button filters', void(0),  () => list.searchMethod.bResetFilters);
		menu.newEntry({menuName: subMenu, entryText: 'sep'});
		{	// Restore
			menu.newEntry({menuName: subMenu, entryText: 'Restore defaults', func: () => {
				list.properties.searchMethod[1] = list.properties.searchMethod[3];
				list.searchMethod = JSON.parse(list.properties.searchMethod[1]);
				overwriteProperties(list.properties);
			}});
		}
	}
	return menu;
}

async function checkLBToken(lBrainzToken = list.properties.lBrainzToken[1]) {
	if (!lBrainzToken.length) {
		const lb = listenBrainz;
		const encryptToken = '********-****-****-****-************';
		const currToken = list.properties.lBrainzEncrypt[1] ? encryptToken : list.properties.lBrainzToken[1];
		try {lBrainzToken = utils.InputBox(window.ID, 'Enter ListenBrainz user token:', window.Name, currToken, true);} 
		catch(e) {return false;}
		if (lBrainzToken === currToken || lBrainzToken === encryptToken) {return false;}
		if (lBrainzToken.length) {
			if (!(await lb.validateToken(lBrainzToken))) {
				lb.consoleError('Token can not be validated.');
				return false;
			}
			const answer = WshShell.Popup('Do you want to encrypt the token?', 0, window.Name, popup.question + popup.yes_no);
			if (answer === popup.yes) {
				let pass = '';
				try {pass = utils.InputBox(window.ID, 'Enter a passowrd:\n(will be required on every use)', window.Name, pass, true);} 
				catch(e) {return false;}
				if (!pass.length) {return false;}
				lBrainzToken = new SimpleCrypto(pass).encrypt(lBrainzToken);
			}
			list.properties.lBrainzEncrypt[1] = answer === popup.yes;
		}
		list.properties.lBrainzToken[1] = lBrainzToken;
		overwriteProperties(list.properties);
	}
	return true;
}
