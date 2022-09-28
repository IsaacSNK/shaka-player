import fs from "fs";
import path from "path";

export const generateFileInventory = (
  filePath: string,
  includeFolders: string[]
) => {
  let filesToAdd: string[] = [];
  if (!fs.statSync(filePath).isDirectory()) {
    filesToAdd = [filePath];
  } else {
    includeFolders.forEach((inclusion) => {
      let effectiveBasePath = filePath;
      let effectInclusionPath = inclusion;
      if (effectiveBasePath.endsWith("/")) {
        effectiveBasePath = effectiveBasePath.substring(
          0,
          effectiveBasePath.length - 1
        );
      }
      if (effectInclusionPath.startsWith("/")) {
        effectInclusionPath = effectInclusionPath.substring(1);
      }
      filesToAdd = [
        ...filesToAdd,
        ...getAllFilesForDir(effectiveBasePath + "/" + effectInclusionPath),
      ];
    });
  }
  return filesToAdd;
};

const getAllFilesForDir = (
  dirPath,
  arrayOfFiles: Array<string> = []
): Array<string> => {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles ?? [];
  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFilesForDir(dirPath + "/" + file, arrayOfFiles);
    } else if (file.endsWith(".js")) {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });
  return arrayOfFiles;
};
