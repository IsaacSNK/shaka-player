import * as lineReader from 'line-reader';
import fs from 'fs';

export const openLineReader = (file) => {
    return new Promise((resolve, reject) => {
        lineReader.open(file, (err, reader) => {
            if (!err) {
                resolve(reader);
            } else {
                reject(err);
            }
        });
    });
}

export const readLine = (reader): Promise<string | null> => {
    return new Promise((resolve, reject) => {
        reader.nextLine((err, line) => {
            if (!err) {
                resolve(line);
            } else {
                resolve(null);
            }
        });
    });
};

export const openFileForWrite = (fileName): fs.WriteStream => {
    return fs.createWriteStream(fileName);
};

export const writeLine = (writerStream, line) => {
    writerStream.write(line);
    writerStream.write('\n');
};