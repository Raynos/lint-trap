'use strict';
var detectIndent = require('detect-indent');
var extend = require('extend');
var path = require('path');
var fs = require('fs');
var jf = require('jsonfile');
var dotty = require('dotty');
var process = require('process');
jf.spaces = 4;

function findReferenceFile(rootPath, firstFile, callback) {
    var manifestPath = path.join(rootPath, 'package.json');
    fs.exists(manifestPath, function manifestExistsCallback(exists) {
        if (exists) {
            jf.readFile(manifestPath, function readFileCallback(err, manifest) {
                if (err) {
                    return callback(err);
                }
                var main = path.resolve(rootPath, manifest.main || 'index.js');
                callback(undefined, main);
            });
        } else {
            var indexPath = path.join(rootPath, 'index.js');
            fs.exists(indexPath, function indexExistsCallback(exists) {
                if (exists) {
                    callback(undefined, indexPath);
                } else {
                    callback(undefined, firstFile);
                }
            });
        }
    });
}

function updateJSON(jsonPath, diffs, callback) {
    jf.readFile(jsonPath, function readFileCallback(err, content) {
        if (err) {
            return callback(err);
        }

        Object.keys(diffs).forEach(function applyDiff(diffKey) {
            var value = diffs[diffKey];
            dotty.put(content, diffKey, value);
        });

        jf.writeFile(jsonPath, content, callback);
    });
}

function setIndentRule(rootPath, firstFile, callback) {
    if (firstFile === 'stdin') {
        return process.nextTick(callback);
    }

    function readFileCallback(err, content) {
        if (err) {
            return callback(err);
        }
        var indent = detectIndent(content).indent || '    ';
        var jscsrcPath = path.resolve(__dirname, './rc/.jscsrc');
        var diff = { validateIndentation: indent.length };
        updateJSON(jscsrcPath, diff, callback);
    }

    function findReferenceFileCallback(err, referenceFile) {
        if (err) {
            return callback(err);
        }
        fs.readFile(referenceFile, 'utf8', readFileCallback);
    }

    findReferenceFile(rootPath, firstFile, findReferenceFileCallback);
}

function setLineLengthRule(lineLength, callback) {

    var jscsrcPath = path.resolve(__dirname, './rc/.jscsrc');

    var jscsdiff = {
        'maximumLineLength.value' : lineLength
    };

    updateJSON(jscsrcPath, jscsdiff, updateEslint);

    function updateEslint(err) {
        if (err) {
            return callback(err);
        }
        var eslintrcPath = path.resolve(__dirname, './rc/.eslintrc');
        var eslintdiff = {
            'rules.max-len': [2, lineLength, 4]
        };
        updateJSON(eslintrcPath, eslintdiff, callback);
    }
}

function setRules(dir, files, lineLength, callback) {
    setIndentRule(dir, files[0], function setIndentRuleCallback(err) {
        if (err) {
            return callback(err);
        }

        setLineLengthRule(lineLength, function setLineLengthRuleCallback(err) {
            if (err) {
                return callback(err);
            }
            callback();
        });
    });
}

module.exports = setRules;