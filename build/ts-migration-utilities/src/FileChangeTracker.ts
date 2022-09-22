import md5File from 'md5-file';
import fs from 'fs';
import { generateFileInventory } from './FileInventory.js';
import chalk from 'chalk';
import { exec } from 'child_process';

const OUTPUT_FILE = './change-control.json';

const getCmdArgs = () => {
    if (process.argv.length <= 2) {
        console.log(chalk.red("No arguments provided"));
        process.exit(1);
    }
    const command = process.argv[2].toLowerCase();
    if (command === 'generate' || command === 'check') {
        return { command, options: process.argv.slice(3)};
    } else {
        console.log(chalk.red("Invalid command"));
        process.exit(1);
    }        
};

const generateChangeControlFile = async (options: string[] = []) => {
    let changeControlMap: Record<string, string> = {};
    const repoPath = '/Users/isaac/dev-workspace/shaka-player-fork/';
    const includeFolders = ["lib", "externs", "test", "third_party", "ui"];
    const files = generateFileInventory(repoPath, includeFolders);
    const promiseArray: Promise<Record<string, string>>[] = [];
    files.forEach(jsFile => {
        promiseArray.push(new Promise((resolve, reject) => {
            md5File(jsFile).then(hash => {
                resolve({ [jsFile.replace(repoPath, '')]: hash });
            }).catch(err => {
                reject(err);
            }); 
        }));
    });
    const filesChecksum = await Promise.all(promiseArray);
    filesChecksum.forEach(result => {
        changeControlMap = {
            ...changeControlMap,
            ...result
        }
    });
    return changeControlMap;
}

const writeChangeControlFile = async (options: string[] = []) => {
    const changeControlMap = generateChangeControlFile(options);
    if (fs.existsSync(OUTPUT_FILE) && !options.includes('-f')) {
        console.log(chalk.red("Change control file already exists. Use: 'npm generate -- -f' to overwrite"));
        process.exit(1);
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(changeControlMap, null, 2));
    console.log(chalk.green("Change control file generated..."));
}

const checkChanges = async () => {
    if (!fs.existsSync(OUTPUT_FILE)) {
        console.log(chalk.red("Change control file not found"));
        process.exit(1);
    }
    const toCompare = await generateChangeControlFile();
    const tempFile = fs.writeFileSync("./temp", JSON.stringify(toCompare, null, 2));  
    await runDiff(OUTPUT_FILE, "./temp");    
    fs.rmSync("./temp");
}

const runDiff = (fileA, fileB): Promise<void> => {
    return new Promise((resolve) => {
        exec('diff ./temp ./change-control.json', (err, stdout, stderr) => {            
            if (stdout) {
                console.log(chalk.red("Changes detected"));
                console.log(stdout);
            } else {
                console.log(chalk.green("No changes detected"));
            }
            resolve();
        });
    });
} 

(async () => {
    const { command, options } = getCmdArgs();
    if (command === 'generate') {
        console.log(chalk.blue("Generating change control file..."));
        writeChangeControlFile(options);
    } else if (command === 'check') {
        console.log(chalk.blue("Looking for changes..."));
        checkChanges();
    }
})();
