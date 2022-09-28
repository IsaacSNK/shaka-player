const regex = /(.*\.ts)\((\d+)\,\d+\)\:\serror\s(TS\d+):/g;

export type TSError = string;

export type TSErrorByLine = Record<number, TSError[]>;

export type TSErrorsByFile = Record<string, TSErrorByLine>;

export const classifyBuildReport = (data: string): TSErrorsByFile => {
  let matches: RegExpExecArray | null;
  const result: TSErrorsByFile = {};
  while ((matches = regex.exec(data))) {
    const [_, file, line, error] = matches;
    let fileRecord = result[file];
    if (!fileRecord) {
      fileRecord = {};
    }
    let lineRecord = fileRecord[line];
    if (!lineRecord) {
      lineRecord = [];
      fileRecord[line] = lineRecord;
    }
    lineRecord.push(error);
    result[file] = fileRecord;
  }
  return result;
};
