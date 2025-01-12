﻿'use strict';
//18/02/23

// https://github.com/angus-c/just
/*
  Deep clones all properties except functions
*/
function clone(obj) {
	const raw = new Set(['function', 'number', 'boolean', 'string']);
	if (raw.has(typeof obj)) {return obj;}
	let result;
	if (obj instanceof Set) {
		result = new Set();
		for (let value of obj) {
			// include prototype properties
			let type = {}.toString.call(value).slice(8, -1);
			if (type === 'Array' || type === 'Object') {
				result.add(clone(value));
			} else if (type === 'Date') {
				result.add(new Date(value.getTime()));
			} else if (type === 'RegExp') {
				result.add(RegExp(value.source, getRegExpFlags(value)));
			} else {
				result.add(value);
			}
		}
		return result;
	} else if (obj instanceof Map) {
		result = new Map();
		for (let [key, value] of obj) {
			// include prototype properties
			let type = {}.toString.call(value).slice(8, -1);
			if (type === 'Array' || type === 'Object') {
				result.set(key, clone(value));
			} else if (type === 'Date') {
				result.set(key, new Date(value.getTime()));
			} else if (type === 'RegExp') {
				result.set(key, RegExp(value.source, getRegExpFlags(value)));
			} else {
				result.set(key, value);
			}
		}
		return result;
	} else {
		result = Array.isArray(obj) ? [] : {};
		for (let key in obj) {
			// include prototype properties
			let value = obj[key];
			let type = {}.toString.call(value).slice(8, -1);
			if (type === 'Array' || type === 'Object') {
				result[key] = clone(value);
			} else if (type === 'Date') {
				result[key] = new Date(value.getTime());
			} else if (type === 'RegExp') {
				result[key] = RegExp(value.source, getRegExpFlags(value));
			} else {
				result[key] = value;
			}
		}
	}
	return result;
}

function getNested(obj, ...args) {
	return args.reduce((obj, level) => obj && obj[level], obj);
}

function setNested(obj, value, ...args) {
	const len = args.length - 1;
	return args.reduce((obj, level, idx) => {
		if (obj && len === idx && obj.hasOwnProperty(level)) {obj[level] = value;}
		return obj && obj[level];
	}, obj);
	return obj;
}
		
function getRegExpFlags(regExp) {
		if (typeof regExp.source.flags === 'string') {
		return regExp.source.flags;
	} else {
		let flags = [];
		regExp.global && flags.push('g');
		regExp.ignoreCase && flags.push('i');
		regExp.multiline && flags.push('m');
		regExp.sticky && flags.push('y');
		regExp.unicode && flags.push('u');
		return flags.join('');
	}
}

function baseToString(value) {
	if (typeof value == 'string') {
		return value;
	}
	var result = (value + '');
	return (result === '0' && (1 / value) === -Infinity) ? '-0' : result;
}

function toString(value) {
  return value == null ? '' : baseToString(value);
}

const escapeRegExpCache = {};
function escapeRegExp(s) {
	s = toString(s);
	if (s && !escapeRegExpCache.hasOwnProperty(s)) {escapeRegExpCache[s] = s.replace(/([^a-zA-Z0-9])/g, '\\$1');}
	return s ? escapeRegExpCache[s] : s; // Can not be safer than this
}

const reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
const reHasRegExpChar = RegExp(reRegExpChar.source);
function escapeRegExpV2(s) { // https://github.com/lodash/lodash/blob/4.1.2-npm-packages/lodash.escaperegexp/index.js
	s = toString(s);
	return (s && reHasRegExpChar.test(s) ? s.replace(s, '\\$&') : s);
}

function randomString(len, charSet) {
	charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let randomString = '';
	for (let i = 0; i < len; i++) {
		let randomPoz = Math.floor(Math.random() * charSet.length);
		randomString += charSet.substring(randomPoz, randomPoz + 1);
	}
	return randomString;
}

// Repeat execution indefinitely according to interval (ms). Ex:
// const repeatedFunction = repeatFn(function, ms);
// repeatedFunction(arguments);
const repeatFn = (fn, ms, parent = this) => {
	return (ms > 0 && Number.isFinite(ms) ? (...args) => {return setInterval(fn.bind(parent, ...args), ms);} : () => {return null;});
};

// Delay execution according to interval (ms). Ex:
// const delayedFunction = delayFn(function, ms);
// delayedFunction(arguments);
const delayFn = (fn, ms, parent = this) => {
	return (ms >= 0 && Number.isFinite(ms) ? (...args) => {return setTimeout(fn.bind(parent, ...args), ms);} : () => {return null;});
};

// Halt execution if trigger rate is greater than delay (ms), so it fires only once after successive calls. Ex:
// const debouncedFunction = debounce(function, delay[, immediate, parent]);
// debouncedFunction(arguments);
const debounce = (fn, delay, immediate = false, parent = this) => {
	let timerId;
	return (...args) => {
		const boundFunc = fn.bind(parent, ...args);
		clearTimeout(timerId);
		if (immediate && !timerId) {boundFunc();}
		const calleeFunc = immediate ? () => {timerId = null;} : boundFunc;
		timerId = setTimeout(calleeFunc, delay);
		return timerId;
	};
};

// Limit the rate at which a function can fire to delay (ms).
// var throttledFunction = throttle(function, delay[, immediate, parent]);
// throttledFunction(arguments);
const throttle = (fn, delay, immediate = false, parent = this) => {
	let timerId;
	return (...args) => {
		const boundFunc = fn.bind(parent, ...args);
		if (timerId) {return;}
		if (immediate && !timerId) {boundFunc();}
		timerId = setTimeout(() => {
			if(!immediate) {
				boundFunc(); 
			}
			timerId = null; 
		}, delay);
	};
};

// Fire functions only once
const doOnceCache = [];
const doOnce = (task, fn) => {
	return (...args) => {
		if(doOnceCache.indexOf(task) === -1) {
			doOnceCache.push(task);
			return fn(...args);
		}
	};
};

function tryFunc(fn) {
	return (...args) => {
		let cache;
		try {cache = fn(...args);} catch(e) {/* continue regardless of error */}
		return cache;
	};
}

function tryMethod(fn, parent) {
	return (...args) => {
		let cache;
		try {cache = parent[fn](...args);} catch(e) {/* continue regardless of error */}
		return cache;
	};
}

function memoize(fn) {
	const results = {};
	return (...args) => {
		// Create key for cache
		const argsKey = JSON.stringify(args);
		if (!results.hasOwnProperty(argsKey)) {
			results[argsKey] = fn(...args)
		}
		return results[argsKey];
	};
}

/* 
	Array and objects manipulation 
*/

// Expects key,value,key,value,...
// or key,value,value;key,value,...
// Outputs {key: value, key: value, ...}
// or  {key: [value, ...], key: [value, ...]}
function convertStringToObject(string, valueType, separator = ',', secondSeparator) {
	if (string === null || string === '') {
		return null;
	} else {
		let output = {};
		let array = [];
		if (secondSeparator) { // Split 2 times
			array = string.split(secondSeparator);
			for (let j = 0; j < array.length; j++) {
				let subArray = array[j].split(separator);
				if (subArray.length >= 2) {
					output[subArray[0]] = []; // First value is always the key
					for (let i = 1; i < subArray.length; i++) {
						if (valueType === 'string') {
							output[subArray[0]].push(subArray[i]);
						} else if (valueType === 'number') {
							output[subArray[0]].push(Number(subArray[i]));
						}
					}
				}
			}
		} else { // Only once
			array = string.split(separator);
			for (let i = 0; i < array.length; i += 2) {
				if (valueType === 'string') {
					output[array[i]] = array[i + 1];
				} else if (valueType === 'number') {
					output[array[i]] = Number(array[i + 1]);
				}
			}
		}
		return output;
	}
}

// Expects {key: value, key: value, ...}
// or  {key: [value, ...], key: [value, ...]}
// Outputs key,value,key,value,...
// or key,value,value;key,value,...
function convertObjectToString(object, separator = ',') {
	if (!object || !Object.keys(object).length) {
		return '';
	} else {
		let keys = Object.keys(object);
		let output = '';
		for(let i = 0; i < keys.length; i++) {
			output += (output.length) ? separator + keys[i] + separator + object[keys[i]] : keys[i] + separator + object[keys[i]];
		}
		return output;
	}
}

function SetReplacer(key, value) {
	return (typeof value === 'object' && value instanceof Set ? [...value] : value);
}

function MapReplacer(key, value) {
	return (typeof value === 'object' && value instanceof Map ?  [...value.entries()] : value);
}

/*
	Script including
*/
let module = {}, exports = {};
module.exports = null;

function require(script) { // Must be path relative to this file, not the parent one
	let newScript = script;
	['helpers-external', 'main', 'examples', 'buttons'].forEach((folder) => {newScript.replace(new RegExp('^\.\\\\' + folder + '\\\\', 'i'), '..\\' + folder + '\\');});
	['helpers'].forEach((folder) => {newScript.replace(new RegExp('^\.\\\\' + folder + '\\\\', 'i'), '');});
	include(newScript + '.js');
	return module.exports;
}