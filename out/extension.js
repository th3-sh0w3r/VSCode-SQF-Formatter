"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;

const vscode = require("vscode");
const commands = require('./commands');
const functions = require('./functions');

function makePrefix(level) {
    return '    '.repeat(Math.max(0, level));
}

function normalizeBrackets(text) {
    return text
        .replace(/{\s*/g, '{\n')
        .replace(/\s*}/g, '\n}')
        .replace(/{\s*}/g, '{}');
}

function normalizeCommandStructure(text) {
    return text
        .replace(/if\s*\((.*)\)\s*then\s*{/g, 'if ($1) then {')
        .replace(/}\s*else\s*{/g, '} else {')
        .replace(/if\s*\((.*)\)\s*exitwith\s*{/g, 'if ($1) exitwith {')
        .replace(/while\s*\{\s*(.*[^\s]*)\s*\}\s*do\s*{/g, 'while { $1 } do {');
}

function normalizeCommas(text) {
    return text
        .replace(/, *([^,\n]+)/g, ', $1')
        .replace(/\s*,/g, ',');
}

function setIndents(text) {
    var level = 0;
    var emptylineCount = 0;
    var deleteNextEmptyLine = false;
    return text.split('\n')
        .map((line) => {
            // Limit empty lines
            if (line === '') {
                if (deleteNextEmptyLine)
                    return undefined;
                emptylineCount++;
                if (emptylineCount > 1)
                    return undefined;
            }
            else
                emptylineCount = 0;
            deleteNextEmptyLine = false;
            let prefix = makePrefix(level);
            const openBrackets = line.split('[');
            const closeBrackets = line.split(']');
            const openBraces = line.split('{');
            const closeBraces = line.split('}');
            const openBracketCount = openBrackets.length;
            const closeBracketCount = closeBrackets.length;
            const openBraceCount = openBraces.length;
            const closeBraceCount = closeBraces.length;
            const isOpenBlock = openBrackets[0].split(']').length > 1
                || openBraces[0].split('}').length > 1;
            if (openBracketCount > closeBracketCount || openBraceCount > closeBraceCount) {
                level++;
                deleteNextEmptyLine = true;
            }
            else if (openBracketCount < closeBracketCount || openBraceCount < closeBraceCount) {
                level = Math.max(0, level - 1);
                prefix = makePrefix(level);
            }
            else if (isOpenBlock) {
                prefix = makePrefix(level - 1);
            }
            return prefix + line;
        })
        .filter(line => (line !== undefined))
        .join('\n')
        .trim();
}

function normalizeCommandOrFunction(commandOrFunction, output) {
    return output.replace(new RegExp("((?!\'|\"[\w\s]*)" + commandOrFunction + "(?![\w\s]*\'|\"))", 'gi'), commandOrFunction);
}

function pretty(document, range) {
    const result = [];
    let output = document.getText(range);
    // Remove leading and tailing whitespaces
    output = output.split('\n')
        .map(line => line.trim())
        .join('\n');
    // Normalize brackets
    output = normalizeBrackets(output);
    // Normalize commands
    commands.forEach(command => {
        output = normalizeCommandOrFunction(command, output);
    });
    // Normalize functions
    functions.forEach(func => {
        output = normalizeCommandOrFunction(func, output);
    });
    // Normalize spaces before and after comma
    output = normalizeCommas(output);
    // Normalize IF and WHILE
    output = normalizeCommandStructure(output);
    // Remove multiple spaces
    output = output.replace(/ {2,}/g, ' ');
    // Add new line after every semicolon
    output = output.replace(/; *([^\n]+)/g, ';\n$1');
    // Remove any whitespaces before semicolon
    // and duplicates
    output = output.replace(/[\s;]*;/g, ';');
    // Trim content of parentheses
    output = output.replace(/\(\s*(.*[^\s])\s*\)/g, '($1)');
    // Parse levels and set indents
    output = setIndents(output);
    result.push(vscode.TextEdit.replace(range, output));
    return result;
}

function activate() {
    vscode.languages.registerDocumentRangeFormattingEditProvider({
        scheme: 'file',
        language: 'sqf'
    }, {
        provideDocumentRangeFormattingEdits: function (document, range) {
            let end = range.end;
            if (end.character === 0) {
                end = end.translate(-1, Number.MAX_VALUE);
            }
            else {
                end = end.translate(0, Number.MAX_VALUE);
            }
            const selectionRange = new vscode.Range(new vscode.Position(range.start.line, 0), end);
            return pretty(document, selectionRange);
        }
    });
    vscode.languages.registerDocumentFormattingEditProvider({
        scheme: 'file',
        language: 'sqf'
    }, {
        provideDocumentFormattingEdits(document) {
            const start = new vscode.Position(0, 0);
            const end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
            const range = new vscode.Range(start, end);
            return pretty(document, range);
        }
    });
}

exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;