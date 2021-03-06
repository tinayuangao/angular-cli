import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as zlib from 'zlib';
import {basename, dirname} from 'path';
import {stripIndents} from 'common-tags';

export function readFile(fileName: string) {
  return new Promise<string>((resolve, reject) => {
    fs.readFile(fileName, 'utf-8', (err: any, data: string) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

export function writeFile(fileName: string, content: string, options?: any) {
  return new Promise<void>((resolve, reject) => {
    fs.writeFile(fileName, content, options, (err: any) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}


export function deleteFile(path: string) {
  return new Promise<void>((resolve, reject) => {
    fs.unlink(path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}


export function rimraf(path: string) {
  return new Promise<void>((resolve, reject) => {
    fs.remove(path, (err?: any) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}


export function moveFile(from: string, to: string) {
  return new Promise<void>((resolve, reject) => {
    fs.rename(from, to, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}


export function symlinkFile(from: string, to: string, type?: string) {
  return new Promise<void>((resolve, reject) => {
    fs.symlink(from, to, type, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function createDir(path: string) {
  return _recursiveMkDir(path);
}


function _recursiveMkDir(path: string): Promise<void> {
  if (fs.existsSync(path)) {
    return Promise.resolve();
  } else {
    return _recursiveMkDir(dirname(path))
      .then(() => fs.mkdirSync(path));
  }
}

export function copyFile(from: string, to: string) {
  return _recursiveMkDir(dirname(to))
    .then(() => new Promise((resolve, reject) => {
      const rd = fs.createReadStream(from);
      rd.on('error', (err: Error) => reject(err));

      const wr = fs.createWriteStream(to);
      wr.on('error', (err: Error) => reject(err));
      wr.on('close', () => resolve());

      rd.pipe(wr);
    }));
}


export function writeMultipleFiles(fs: { [path: string]: string }) {
  return Promise.all(Object.keys(fs).map(fileName => writeFile(fileName, fs[fileName])));
}


export function replaceInFile(filePath: string, match: RegExp | string, replacement: string) {
  return readFile(filePath)
    .then((content: string) => writeFile(filePath, content.replace(match, replacement)));
}


export function appendToFile(filePath: string, text: string, options?: any) {
  return readFile(filePath)
    .then((content: string) => writeFile(filePath, content.concat(text), options));
}


export function prependToFile(filePath: string, text: string, options?: any) {
  return readFile(filePath)
    .then((content: string) => writeFile(filePath, text.concat(content), options));
}


export function expectFileMatchToExist(dir: string, regex: RegExp) {
  return new Promise((resolve, reject) => {
    const [fileName] = fs.readdirSync(dir).filter(name => name.match(regex));
    if (!fileName) {
      reject(new Error(`File ${regex} was expected to exist but not found...`));
    }
    resolve(fileName);
  });
}

export function expectFileNotToExist(fileName: string) {
  return new Promise((resolve, reject) => {
    fs.exists(fileName, (exist) => {
      if (exist) {
        reject(new Error(`File ${fileName} was expected not to exist but found...`));
      } else {
        resolve();
      }
    });
  });
}

export function expectFileToExist(fileName: string) {
  return new Promise((resolve, reject) => {
    fs.exists(fileName, (exist) => {
      if (exist) {
        resolve();
      } else {
        reject(new Error(`File ${fileName} was expected to exist but not found...`));
      }
    });
  });
}

export function expectFileToMatch(fileName: string, regEx: RegExp | string) {
  return readFile(fileName)
    .then(content => {
      if (typeof regEx == 'string') {
        if (content.indexOf(regEx) == -1) {
          throw new Error(stripIndents`File "${fileName}" did not contain "${regEx}"...
            Content:
            ${content}
            ------
          `);
        }
      } else {
        if (!content.match(regEx)) {
          throw new Error(stripIndents`File "${fileName}" did not contain "${regEx}"...
            Content:
            ${content}
            ------
          `);
        }
      }
    });
}

export function expectFileSizeToBeUnder(fileName: string, sizeInBytes: number) {
  return readFile(fileName)
    .then(content => {
      if (content.length > sizeInBytes) {
        throw new Error(`File "${fileName}" exceeded file size of "${sizeInBytes}".`);
      }
    });
}

export function expectGlobFileSizeToBeUnder(fileGlob: string, sizeInBytes: number) {
  let assets = glob.sync(fileGlob, { dir: false });

  return Promise.all(assets.map(fileName => readFile(fileName).then(content => content.length)))
    .then(lengths => {
      const total = lengths.reduce((acc, curr) => acc + curr);

      if (total > sizeInBytes) {
        throw new Error(`Files matching glob "${glob}" exceeded total size of "${sizeInBytes}".`);
      }
    });
}

export function uploadBundleJsFileSize(fileGlob: string) {
  const assets = glob.sync(fileGlob, { dir: false });
  const payloadData = {};

  return Promise.all(assets.map(fileName => {
    return new Promise((resolve, reject) => {
      const content = fs.readFileSync(fileName);
      const name = basename(fileName);
      const label = name.slice(0, name.indexOf('.'));
      payloadData[`uncompressed/${label}`] = content.length;

      zlib.gzip(content, (error, result) => {
        if (error) {
          reject(error);
        } else {
          payloadData[`gzip/${label}`] = result.length;
          resolve(result);
        }
      });
    });
  })).then(() => payloadData);
}
