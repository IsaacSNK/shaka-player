import chalk from "chalk";
import fs from "fs";
import {
  classifyBuildReport,
  TSErrorByLine,
} from "./bulk-ts-fixes/classifyBuildReport.js";
import {
  openFileForWrite,
  openLineReader,
  readLine,
} from "./bulk-ts-fixes/fileIOUtils.js";
import { applyFixRules } from "./bulk-ts-fixes/ruleApplier.js";

const BASE_PATH = "../../";
const BUILD_REPORT = "../../build.report";

const processFile = async (
  file: string,
  errors: TSErrorByLine
): Promise<void> => {
  try {
    const reader = await openLineReader(BASE_PATH + file);
    const writer = openFileForWrite(BASE_PATH + file);
    let line: string | null = await readLine(reader);
    let lineCounter: number = 1;
    while (line !== null) {
      try {
        if (errors[lineCounter]?.length > 0) {
          const fixedLine = applyFixRules(
            errors[lineCounter],
            lineCounter,
            line
          );
          writer.write(fixedLine);
        } else {
          writer.write(line);
        }
      } catch (error) {
        writer.write(line);
        console.log(error);
      }
      writer.write("\n");
      lineCounter++;
      line = await readLine(reader);
    }
  } catch (err) {
    console.log(err);
    throw err;
  }
};

(async () => {
  if (!fs.existsSync(BUILD_REPORT)) {
    console.log(chalk.red("Build report file not found"));
    process.exit(1);
  }
  console.log(chalk.blue("Processing build report..."));
  const data = fs.readFileSync(BUILD_REPORT).toString();
  const groupedData = classifyBuildReport(data);

  console.log(chalk.blue("Applying rules..."));
  const processingPromises: Promise<void>[] = [];
  Object.keys(groupedData).forEach((file) => {
    processingPromises.push(processFile(file, groupedData[file]));
  });
  try {
    await Promise.all(processingPromises);
    console.log(chalk.green("Done!"));
  } catch (error) {
    console.log(chalk.red("Failed. See error below:"));
    console.log(error);
  }
})();
