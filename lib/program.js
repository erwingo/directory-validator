"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const path = require("path");
function getMultimatchName(nameRule) {
    return ['[camelCase]', '[UPPERCASE]', '[dash-case]', '[snake_case]']
        .reduce((result, el) => {
        if (result) {
            return result;
        }
        const ruleSegments = nameRule.split(el);
        if (ruleSegments.length === 2) {
            return { type: el, leftSide: ruleSegments[0], rightSide: ruleSegments[1] };
        }
        return result;
    }, undefined);
}
function getDirFiles(files, paths, isRecursive = false) {
    return files.filter(el => {
        let pathSegments = el.path.split(path.sep);
        pathSegments = pathSegments.slice(0, pathSegments.length - 1);
        const parentPaths = paths.slice(1, paths.length);
        if (isRecursive) {
            if (parentPaths.length > pathSegments.length) {
                return false;
            }
        }
        else {
            if (parentPaths.length !== pathSegments.length) {
                return false;
            }
        }
        return parentPaths.every((el, i) => isNameValid(el, pathSegments[i]));
    });
}
function isNameValid(nameRule, name) {
    if (nameRule instanceof RegExp) {
        return nameRule.test(name);
    }
    const multimatchname = getMultimatchName(nameRule);
    if (multimatchname) {
        const { type, leftSide, rightSide } = multimatchname;
        const rightSideIndexOf = name.lastIndexOf(rightSide);
        if (name.indexOf(leftSide) !== 0) {
            return false;
        }
        if ((rightSideIndexOf + rightSide.length) !== name.length) {
            return false;
        }
        const filenameToValidate = name.substring(leftSide.length, rightSideIndexOf);
        if (filenameToValidate.length === 0) {
            return false;
        }
        switch (type) {
            case '[camelCase]': return _.camelCase(filenameToValidate) === filenameToValidate;
            case '[UPPERCASE]': return _.upperCase(filenameToValidate) === filenameToValidate;
            case '[dash-case]': return _.kebabCase(filenameToValidate) === filenameToValidate;
            case '[snake_case]': return _.snakeCase(filenameToValidate) === filenameToValidate;
            default: return false;
        }
    }
    return nameRule === name;
}
function isFileExtValid(fileExtRule, ext) {
    if (fileExtRule instanceof RegExp) {
        return fileExtRule.test(ext);
    }
    return fileExtRule === ext;
}
function getFilesByParentDir(files) {
    return _.groupBy(files, el => {
        const pathFragments = el.path.split(path.sep);
        return pathFragments.slice(0, pathFragments.length - 1).join(path.sep);
    });
}
function getValidatableFiles(files) {
    return files.map(el => ({ path: path.normalize(el), isGood: false, isValidated: false }));
}
function getRuleError(rule, deep) {
    return new Error(`${JSON.stringify(rule)}, deep: ${deep}, rule did not passed`);
}
function validatePath(element) {
    if (!element.isGood) {
        throw new Error(`${element.path}, was not validated`);
    }
}
function run(files, mainRules, emptyDirs = []) {
    if (mainRules.length === 0) {
        return;
    }
    const newFiles = getValidatableFiles(files);
    const newEmptyDirs = emptyDirs.map(el => ({ path: path.normalize(el), isGood: false }));
    function validateRules(rules = [], paths = ['.']) {
        if (rules.length === 0) {
            return;
        }
        rules.forEach((rule, idx) => {
            if (rule.type === 'file') {
                const dirFiles = getDirFiles(newFiles, paths);
                // IF more than one file matches the rule then it passes
                const fileRulePassed = dirFiles.reduce((result, file) => {
                    const { base, name, ext } = path.parse(file.path);
                    let isFileValid;
                    if (!rule.extension) {
                        isFileValid = isNameValid(rule.name, base);
                    }
                    else {
                        isFileValid =
                            isNameValid(rule.name, name) && isFileExtValid(rule.extension, ext.substring(1));
                    }
                    file.isValidated = file.isValidated || isFileValid;
                    return result || isFileValid;
                }, newFiles.length === 0);
                if (!fileRulePassed && !rule.isOptional) {
                    throw getRuleError(rule, paths.length);
                }
                // If there are no more sibling file rules coming, we mark as good all the
                // files that passed the test
                if (rules.slice(idx + 1).some(el => el.type === 'file')) {
                    return;
                }
                dirFiles
                    .filter(el => el.isValidated)
                    .forEach(el => { el.isGood = true; });
                newFiles.forEach(el => { el.isValidated = false; });
                return;
            }
            // Directory Rule
            if (rule.name instanceof RegExp || getMultimatchName(rule.name)) {
                const dirFiles = getDirFiles(newFiles, [...paths, rule.name]);
                const parentPaths = getFilesByParentDir(dirFiles);
                const parentPathsArray = _.keys(parentPaths);
                for (let i = 0; i < parentPathsArray.length; i += 1) {
                    validateRules(rule.rules, [...paths, parentPathsArray[i]]);
                }
                return;
            }
            const dirFiles = getDirFiles(newFiles, [...paths, rule.name]);
            // Dir does not exist
            if (dirFiles.length === 0) {
                rule.isRecursive = false;
                const emptyDir = newEmptyDirs
                    .find(el => el.path === path.normalize([...paths, rule.name].join(path.sep)));
                if (emptyDir) {
                    emptyDir.isGood = true;
                    if ((rule.rules || []).length === 0) {
                        return;
                    }
                    throw getRuleError(rule, paths.length);
                }
                if (rule.isOptional) {
                    return;
                }
                throw getRuleError(rule, paths.length);
            }
            // If no rules for this dir, it should validate all of his files
            if ((rule.rules || []).length === 0) {
                getDirFiles(newFiles, [...paths, rule.name], true)
                    .forEach(el => { el.isGood = true; });
                return;
            }
            if (rule.isRecursive) {
                // We force rule to optional so we avoid recursively looking for
                // this rule. (It's only needed the first time)
                rule.isOptional = true;
                validateRules([rule], [...paths, rule.name]);
                validateRules(rule.rules, [...paths, rule.name]);
                return;
            }
            if (!rule.isOptional) {
                validateRules(rule.rules, [...paths, rule.name]);
            }
        });
    }
    validateRules(mainRules);
    newFiles.forEach(validatePath);
    newEmptyDirs.forEach(validatePath);
}
exports.run = run;