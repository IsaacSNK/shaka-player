import chalk from 'chalk';
import fs from 'fs';

const BUILD_REPORT = '../../build.report';

(async () => {
    if (!fs.existsSync(BUILD_REPORT)) {
        console.log(chalk.red("Build report file not found"));
        process.exit(1);
    }
    console.log(chalk.blue("Processing build report..."));
    const data = fs.readFileSync(BUILD_REPORT);
    console.log(data);
    //GROUP BY FILE and BY ERROR
    //APPLY RULES
})();