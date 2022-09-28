import { TSError } from "./classifyBuildReport.js";

type RuleFunction = (line: string, lineNum: number) => string;

const ruleMap: Record<string, RuleFunction> = {
  TS2532: addTSIgnore,
  TS2314: addTSIgnore,
  TS2322: addTSIgnore,
};

export const applyFixRules = (
  errors: TSError[],
  lineCounter: number,
  line: string
): string => {
  let moddedLine = line;
  errors.forEach((error) => {
    const rule = ruleMap[error];
    if (rule) {
      moddedLine = rule(moddedLine, lineCounter);
    }
  });
  return moddedLine;
};

function addTSIgnore(line: string, lineNum: number) {
  const FIX_STRING = "// @ts-ignore";
  return line.includes(FIX_STRING) ? line : `// @ts-ignore\n${line}`;
}
