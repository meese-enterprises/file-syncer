// External imports
import * as paths from "path";
import * as fs from "fs";
import * as chokidar from "chokidar";
import findProcess from "find-process";
import sync from "sync-directory";
import { program } from "commander";

// Internal imports
import { AsString, AsBool, AsKeyValuePairs, ReplaceArgValue } from "./utils";

program.requiredOption("--from <path>", `Path to copy from, relative to the PWD (wrap paths that contain spaces in quotes)`);
program.requiredOption("--to <path>", `Folder in which to create hard-links of the watched files (given "--to XXX", $cwd/path/to/watched-folder has its files hard-linked to XXX/path/to/watched/folder)`);
program.option("--replacements <pairElements...>", `Example: --replacements "replace this" "with that" "and replace this with" null) [default: empty array]`);
program.option("--watch [bool]", `If true, program will monitor the "from" paths; whenever a file change is detected, it will mirror it to the "to" folder. [default: false]`);
program.option("--clearAtLaunch [bool]", `If true, the "to" folder is cleared at startup. [default: false]`);
program.option("--async [bool]", `If true, program will make a non-blocking fork of itself, and then kill itself. (all arguments will be inherited from the parent except for "async") [default: false]`);
program.option("--useLastIfUnchanged [bool]", "If true, new instance will not start if an existing one is found that has the exact same arguments. Note: For async launches, check is made only in final process. [default: async]");
program.option("--autoKill [bool]", "If true, program will kill itself when it notices a newer instance running in the same directory. [default: async]");
program.option("--markLaunch [bool]", "If true, program creates a temporary file at startup which notifies older instances that they're outdated. [default: autoKill]");
program.option("--label [string]", "Extra argument that can be used to easily identify a given launch. [default: async ? working-directory : null]");
program.parse(process.argv);

const launchOpts = program.opts();
const fromPath = AsString(launchOpts.from)!;
const toPath = AsString(launchOpts.to)!;
const replacements = AsKeyValuePairs(launchOpts.replacements);
const watch = AsBool(launchOpts.watch, false);
const clearAtLaunch = AsBool(launchOpts.clearAtLaunch, false);
const async = AsBool(launchOpts.async, false);
const useLastIfUnchanged = AsBool(launchOpts.useLastIfUnchanged, async);
const autoKill = AsBool(launchOpts.autoKill, async);
const markLaunch = AsBool(launchOpts.markLaunch, autoKill);
const label = AsString(launchOpts.label, async ? process.cwd() : null);

run();
async function run() {
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
    ReplaceArgValue(args, "async", false);
    ReplaceArgValue(args, "useLastIfUnchanged", useLastIfUnchanged);
    ReplaceArgValue(args, "autoKill", autoKill);
    ReplaceArgValue(args, "markLaunch", markLaunch);
    ReplaceArgValue(args, "label", label);

    spawn(process.argv[0], args, { detached: true });
    process.exit();
  }

  // If useLastIfUnchanged is enabled, check if an instance of file-syncer is already running with the
  // exact same arguments; if so, cancel this launch (ideally, it may be better to achieve the desired
  // behavior by just canceling file-syncs between "from" and "to" where file contents and edit-times
  // are unchanged, but that is harder/slower)
  if (useLastIfUnchanged) {
    const ownCommand = (await findProcess("pid", process.pid))[0];

    const processes = await findProcess("name", ""); // find all processes
    const processesWithSameCMD = processes.filter((a) => a.cmd == ownCommand.cmd);
    const otherProcessesWithSameCMD = processesWithSameCMD.filter((a) => a.pid != ownCommand.pid);
    if (otherProcessesWithSameCMD.length) {
      console.log(`Found existing file-syncer instance with the same arguments (PIDs: ${otherProcessesWithSameCMD.map((a) => a.pid).join(", ")})! Canceling this launch (PID: ${ownCommand.pid})...`)
      process.exit();
    }
  }

  const rootFolder = process.cwd();
  const fromRoot = (...relativePathSegments: string[]) => {
    // If absolute, return as is
    if (paths.isAbsolute(relativePathSegments[0])) return paths.join(...relativePathSegments);

    // If relative, make it relative to the root
    return paths.join(rootFolder, ...relativePathSegments);
  }

  // clean up any old "LastLaunch_XXX" files
  const cwd_filenameSafe = rootFolder.toLowerCase().replace(/[^a-z0-9\-]/g, "-");
  for (const fileName of fs.readdirSync(__dirname)) {
    const match = fileName.match(/^LastLaunch_([0-9]+)_(.+)$/);
    if (match && match[2] === cwd_filenameSafe) {
      try {
        const path = paths.join(__dirname, fileName);
        fs.unlinkSync(path);
      } catch {}
    }
  }

  if (clearAtLaunch) {
    const toPath_deleting = fromRoot(toPath);
    const dangerousDelete = paths.resolve(toPath_deleting).length <= paths.resolve(rootFolder).length;
    console.log(`Clearing path${dangerousDelete ? " in 10 seconds" : ""}:`, toPath_deleting);
    await new Promise((resolve) => setTimeout(resolve, dangerousDelete ? 10000 : 0));
    fs.rmSync(toPath_deleting, { recursive: true });
  }

  const launchTime = Date.now();
  if (markLaunch) {
    const launchInfo = {launchOpts};
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
          try { fs.unlinkSync(path); } catch {}
          process.exit();
        }, 1000);
      }
    });
  }

  function FinalizeDestPath_Rel(path_rel: string) {
    let result = path_rel;
    for (const replacement of replacements) {
      result = result.replace(replacement.from, replacement.to);
    }

    return result;
  }

  BuildAndWatch();
  function BuildAndWatch() {
    // Only sync if the path exists, otherwise log an error
    if (!fs.existsSync(fromPath)) return console.error(`Error: Path does not exist: ${fromPath}`);

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

      sync(srcDir, dstDir, {
        watch,
        type: "hardlink"
      });
    } else {
      console.log(`Syncing${watch ? " (+ watching)" : ""} file:`, fromPath);
      const dir_rel = paths.dirname(fromPath);
      const dir_rel_dest = FinalizeDestPath_Rel(dir_rel);

      const srcDir = fromRoot(dir_rel);
      const dstDir = fromRoot(toPath, dir_rel_dest);
      console.debug("srcDir for file copy:", srcDir);
      console.debug("dstDir for file copy:", dstDir, "\n");

      // sync-directory only works on folders, so watch the folder, but then...
      sync(srcDir, dstDir, {
        watch,
        // Exclude all files
        exclude: /.*/, 
        // Include only the file we want
        forceSync: (filePath: string) => filePath === fromPath
      });
    }
  }
}
