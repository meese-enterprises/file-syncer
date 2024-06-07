const AsString = (rawValue: string | null, defaultValue: string | null = null) => {
  if (rawValue == null) return defaultValue;
  if (rawValue == "null") return null;
  return rawValue;
};

const AsBool = (rawValue: string | null, defaultValue = false) => {
  if (rawValue == null) return defaultValue;
  if (typeof rawValue == "boolean") return rawValue;
  if (typeof rawValue == "string") {
    if (rawValue == "true") return true;
    if (rawValue == "false") return false;
  }

  throw new Error(`For a boolean-only argument, an invalid argument-value was supplied: ${rawValue}`);
};

const AsKeyValuePairs = (rawValue: string[]) => {
  if (rawValue == null) return [];
  let nextFromStr = "";
  let result = [];
  for (const [i, str] of rawValue.entries()) {
    if (i % 2 == 0) {
      nextFromStr = str;
    } else {
      result.push({ from: nextFromStr, to: str });
    }
  }
  return result;
};

type ArgType = string | boolean | null;

const ReplaceArgValue = (args: ArgType[], argName: string, newArgValue: ArgType) => {
  const argIndex = args.indexOf(`--${argName}`);
  const arg_nextIsValue = argIndex !== -1 ? !String(args[argIndex + 1])?.startsWith("--") : false;

  if (argIndex !== -1) {
    // Delete old entry
    args.splice(argIndex, arg_nextIsValue ? 2 : 1);
    // Add new entry at same location
    args.splice(argIndex, 0, `--${argName}`, newArgValue);
  } else {
    // Just add entry to the end of the list
    args.push(`--${argName}`, newArgValue);
  }
};

export { AsString, AsBool, AsKeyValuePairs, ReplaceArgValue };
