"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplaceArgValue = exports.AsKeyValuePairs = exports.AsBool = exports.AsString = void 0;
const AsString = (rawValue, defaultValue = null) => {
    if (rawValue == null)
        return defaultValue;
    if (rawValue == "null")
        return null;
    return rawValue;
};
exports.AsString = AsString;
const AsBool = (rawValue, defaultValue = false) => {
    if (rawValue == null)
        return defaultValue;
    if (typeof rawValue == "boolean")
        return rawValue;
    if (typeof rawValue == "string") {
        if (rawValue == "true")
            return true;
        if (rawValue == "false")
            return false;
    }
    throw new Error(`For a boolean-only argument, an invalid argument-value was supplied: ${rawValue}`);
};
exports.AsBool = AsBool;
const AsKeyValuePairs = (rawValue) => {
    if (rawValue == null)
        return [];
    let nextFromStr = "";
    let result = [];
    for (const [i, str] of rawValue.entries()) {
        if (i % 2 == 0) {
            nextFromStr = str;
        }
        else {
            result.push({ from: nextFromStr, to: str });
        }
    }
    return result;
};
exports.AsKeyValuePairs = AsKeyValuePairs;
const ReplaceArgValue = (args, argName, newArgValue) => {
    var _a;
    const argIndex = args.indexOf(`--${argName}`);
    const arg_nextIsValue = argIndex !== -1 ? !((_a = String(args[argIndex + 1])) === null || _a === void 0 ? void 0 : _a.startsWith("--")) : false;
    if (argIndex !== -1) {
        // Delete old entry
        args.splice(argIndex, arg_nextIsValue ? 2 : 1);
        // Add new entry at same location
        args.splice(argIndex, 0, `--${argName}`, newArgValue);
    }
    else {
        // Just add entry to the end of the list
        args.push(`--${argName}`, newArgValue);
    }
};
exports.ReplaceArgValue = ReplaceArgValue;
