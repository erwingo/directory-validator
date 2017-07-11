import * as _ from 'lodash';
import * as path from 'path';
import '../types';

export default (files: string[], configObject: Types.FileDirectoryArray) => {
  const newFiles = files.map(el => ({ name: el, isValidated: false }));

  const validateChildren = (children: Types.FileDirectoryArray, paths: string[] = ['.']) => {
    if (children.length === 0) {
      return;
    }

    children.forEach(el => {
      if (el.type === 'directory') {
        validateChildren(el.children || [], [...paths, el.name]);
        return;
      }

      const filename = el.name;
      const fileExt = el.extension;
      let fileRulePassed = false;

      fileRulePassed = newFiles
        .filter(file => {
          const doesFileBelongsToThisDir = path.dirname(file.name) === paths.join('/');
          const isFileInCurrentDeep = file.name.split('/').length === paths.length + 1;
          return doesFileBelongsToThisDir && isFileInCurrentDeep;
        })
        .reduce((result, file) => {
          const { base, name, ext } = path.parse(file.name);
          const correctExt = ext.substring(1);
          let evaluation = true;

          if (!fileExt) {
            if (filename !== base) { evaluation = false; }
          } else if (filename !== name) {
            evaluation = false;
          } else if (fileExt instanceof RegExp) {
            if (!fileExt.test(correctExt)) { evaluation = false; }
          } else if (fileExt !== correctExt) {
            evaluation = false;
          }

          file.isValidated = evaluation || file.isValidated;
          return result || evaluation;
        }, false);

      if (!fileRulePassed && !el.isOptional) {
        throw new Error(`${JSON.stringify(el)}, deep: ${paths.length}, rule did not passed`);
      }
    });
  };

  validateChildren(configObject);

  newFiles.forEach(el => {
    if (!el.isValidated) { throw new Error(`${el.name}, was not validated`); }
  });

  // configObject.forEach((el, i) => {
  //   const filename = el.name;

  //   if (el.type === 'directory') {

  //   } else {
  //     const fileExt = el.extension;
  //     let fileRulePassed = false;

  //     fileRulePassed = newFiles.some(file => {
  //       const { base, name, ext } = path.parse(file.name);
  //       const correctExt = ext.substring(1);

  //       if (!fileExt) {
  //         if (filename !== base) { return false; }
  //       } else {
  //         if (filename !== name) { return false; }

  //         if (fileExt instanceof RegExp) {
  //           if (!fileExt.test(correctExt)) { return false; }
  //         } else if (fileExt !== correctExt) { return false; }
  //       }

  //       file.isValidated = true;
  //       return true;
  //     });

  //     if (!fileRulePassed && !el.isOptional) {
  //       throw new Error(`${JSON.stringify(el)}, rule did not passed`);
  //     }
  //   }
  // });

  // newFiles.forEach(el => {
  //   if (!el.isValidated) { throw new Error(`${el.name}, was not validated`); }
  // });
};
