"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// External imports
const paths = __importStar(require("path"));
const fs = __importStar(require("fs"));
const chokidar = __importStar(require("chokidar"));
const find_process_1 = __importDefault(require("find-process"));
const sync_directory_1 = __importDefault(require("sync-directory"));
const commander_1 = require("commander");
// Internal imports
const utils_1 = require("./utils");
commander_1.program.requiredOption("--from <path>", `Path to copy from, relative to the PWD (wrap paths that contain spaces in quotes)`);
commander_1.program.requiredOption("--to <path>", `Folder in which to create hard-links of the watched files (given "--to XXX", $cwd/path/to/watched-folder has its files hard-linked to XXX/path/to/watched/folder)`);
commander_1.program.option("--replacements <pairElements...>", `Example: --replacements "replace this" "with that" "and replace this with" null) [default: empty array]`);
commander_1.program.option("--watch [bool]", `If true, program will monitor the "from" paths; whenever a file change is detected, it will mirror it to the "to" folder. [default: false]`);
commander_1.program.option("--clearAtLaunch [bool]", `If true, the "to" folder is cleared at startup. [default: false]`);
commander_1.program.option("--async [bool]", `If true, program will make a non-blocking fork of itself, and then kill itself. (all arguments will be inherited from the parent except for "async") [default: false]`);
commander_1.program.option("--useLastIfUnchanged [bool]", "If true, new instance will not start if an existing one is found that has the exact same arguments. Note: For async launches, check is made only in final process. [default: async]");
commander_1.program.option("--autoKill [bool]", "If true, program will kill itself when it notices a newer instance running in the same directory. [default: async]");
commander_1.program.option("--markLaunch [bool]", "If true, program creates a temporary file at startup which notifies older instances that they're outdated. [default: autoKill]");
commander_1.program.option("--label [string]", "Extra argument that can be used to easily identify a given launch. [default: async ? working-directory : null]");
commander_1.program.parse(process.argv);
const launchOpts = commander_1.program.opts();
const fromPath = (0, utils_1.AsString)(launchOpts.from);
const toPath = (0, utils_1.AsString)(launchOpts.to);
const replacements = (0, utils_1.AsKeyValuePairs)(launchOpts.replacements);
const watch = (0, utils_1.AsBool)(launchOpts.watch, false);
const clearAtLaunch = (0, utils_1.AsBool)(launchOpts.clearAtLaunch, false);
const async = (0, utils_1.AsBool)(launchOpts.async, false);
const useLastIfUnchanged = (0, utils_1.AsBool)(launchOpts.useLastIfUnchanged, async);
const autoKill = (0, utils_1.AsBool)(launchOpts.autoKill, async);
const markLaunch = (0, utils_1.AsBool)(launchOpts.markLaunch, autoKill);
const label = (0, utils_1.AsString)(launchOpts.label, async ? process.cwd() : null);
run();
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        process.title = "file-syncer";
        console.log("Starting file-syncer...");
        if (label) {
            process.title += ` (${label})`;
            console.log(`Label: ${label}`);
        }
        if (async) {
            const { spawn } = require("child_process");
            const args = process.argv.slice(1);
            // Replace "async" arg with false, but for any args that were (possibly) inferred from "async:true",
            // store their resolved values so child inherits them
            (0, utils_1.ReplaceArgValue)(args, "async", false);
            (0, utils_1.ReplaceArgValue)(args, "useLastIfUnchanged", useLastIfUnchanged);
            (0, utils_1.ReplaceArgValue)(args, "autoKill", autoKill);
            (0, utils_1.ReplaceArgValue)(args, "markLaunch", markLaunch);
            (0, utils_1.ReplaceArgValue)(args, "label", label);
            spawn(process.argv[0], args, { detached: true });
            process.exit();
        }
        // If useLastIfUnchanged is enabled, check if an instance of file-syncer is already running with the
        // exact same arguments; if so, cancel this launch (ideally, it may be better to achieve the desired
        // behavior by just canceling file-syncs between "from" and "to" where file contents and edit-times
        // are unchanged, but that is harder/slower)
        if (useLastIfUnchanged) {
            const ownCommand = (yield (0, find_process_1.default)("pid", process.pid))[0];
            const processes = yield (0, find_process_1.default)("name", ""); // find all processes
            const processesWithSameCMD = processes.filter((a) => a.cmd == ownCommand.cmd);
            const otherProcessesWithSameCMD = processesWithSameCMD.filter((a) => a.pid != ownCommand.pid);
            if (otherProcessesWithSameCMD.length) {
                console.log(`Found existing file-syncer instance with the same arguments (PIDs: ${otherProcessesWithSameCMD.map((a) => a.pid).join(", ")})! Canceling this launch (PID: ${ownCommand.pid})...`);
                process.exit();
            }
        }
        const rootFolder = process.cwd();
        const fromRoot = (...relativePathSegments) => {
            // If absolute, return as is
            if (paths.isAbsolute(relativePathSegments[0]))
                return paths.join(...relativePathSegments);
            // If relative, make it relative to the root
            return paths.join(rootFolder, ...relativePathSegments);
        };
        // clean up any old "LastLaunch_XXX" files
        const cwd_filenameSafe = rootFolder.toLowerCase().replace(/[^a-z0-9\-]/g, "-");
        for (const fileName of fs.readdirSync(__dirname)) {
            const match = fileName.match(/^LastLaunch_([0-9]+)_(.+)$/);
            if (match && match[2] === cwd_filenameSafe) {
                try {
                    const path = paths.join(__dirname, fileName);
                    fs.unlinkSync(path);
                }
                catch (_a) { }
            }
        }
        if (clearAtLaunch) {
            const toPath_deleting = fromRoot(toPath);
            const dangerousDelete = paths.resolve(toPath_deleting).length <= paths.resolve(rootFolder).length;
            console.log(`Clearing path${dangerousDelete ? " in 10 seconds" : ""}:`, toPath_deleting);
            yield new Promise((resolve) => setTimeout(resolve, dangerousDelete ? 10000 : 0));
            fs.rmSync(toPath_deleting, { recursive: true });
        }
        const launchTime = Date.now();
        if (markLaunch) {
            const launchInfo = { launchOpts };
            fs.writeFileSync(`${__dirname}/LastLaunch_${launchTime}_${cwd_filenameSafe}`, JSON.stringify(launchInfo));
        }
        if (autoKill && watch) {
            // Watch for "LastLaunch_XXX" file creation; this way, if another launch starts in this folder,
            // the current one will kill itself (easiest way to prevent runaway watchers)
            const watcher = chokidar.watch(".", {
                cwd: __dirname,
                ignoreInitial: true,
                persistent: true
            });
            watcher.on("add", (subPath, stats) => {
                const path = paths.join(__dirname, subPath);
                const fileName = paths.basename(path);
                const match = fileName.match(/^LastLaunch_([0-9]+)_(.+)$/);
                if (match && match[2] == cwd_filenameSafe && Number(match[1]) > launchTime) {
                    // wait a bit (so if >1 are waiting, they all have a chance to see the file)
                    setTimeout(() => {
                        try {
                            fs.unlinkSync(path);
                        }
                        catch (_a) { }
                        process.exit();
                    }, 1000);
                }
            });
        }
        function FinalizeDestPath_Rel(path_rel) {
            let result = path_rel;
            for (const replacement of replacements) {
                result = result.replace(replacement.from, replacement.to);
            }
            return result;
        }
        BuildAndWatch();
        function BuildAndWatch() {
            // Only sync if the path exists, otherwise log an error
            if (!fs.existsSync(fromPath))
                return console.error(`Error: Path does not exist: ${fromPath}`);
            // Check if the path is a directory or a symlink
            const isDir = fs.lstatSync(fromPath).isDirectory();
            const isSymLink = fs.lstatSync(fromPath).isSymbolicLink();
            // Get the path the symlink points to, including support for relative symlinks
            let symlinkTarget = isSymLink ? fs.readlinkSync(fromPath) : null;
            if (symlinkTarget && !paths.isAbsolute(symlinkTarget)) {
                const dir = paths.dirname(fromPath);
                symlinkTarget = paths.join(dir, symlinkTarget);
            }
            const symlinkTarget_isDir = symlinkTarget ? fs.lstatSync(symlinkTarget).isDirectory() : false;
            if (isDir || symlinkTarget_isDir) {
                console.log(`Syncing${watch ? " (+ watching)" : ""} directory:`, fromPath);
                const srcDir = fromRoot(fromPath);
                const dstDir = fromRoot(toPath);
                console.debug("srcDir for folder copy:", srcDir);
                console.debug("dstDir for folder copy:", dstDir, "\n");
                (0, sync_directory_1.default)(srcDir, dstDir, {
                    watch,
                    type: "hardlink"
                });
            }
            else {
                console.log(`Syncing${watch ? " (+ watching)" : ""} file:`, fromPath);
                const dir_rel = paths.dirname(fromPath);
                const dir_rel_dest = FinalizeDestPath_Rel(dir_rel);
                const srcDir = fromRoot(dir_rel);
                const dstDir = fromRoot(toPath, dir_rel_dest);
                console.debug("srcDir for file copy:", srcDir);
                console.debug("dstDir for file copy:", dstDir, "\n");
                // sync-directory only works on folders, so watch the folder, but then...
                (0, sync_directory_1.default)(srcDir, dstDir, {
                    watch,
                    // Exclude all files
                    exclude: /.*/,
                    // Include only the file we want
                    forceSync: (filePath) => filePath === fromPath
                });
            }
        }
    });
}
