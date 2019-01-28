#!/usr/bin/env node

const writeGood = require("write-good");
const {StringStream} = require("scramjet");
const fs = require("fs");
const path = require("path");
const fg = require("fast-glob");

const {promisify} = require("util");
const readFile = promisify(fs.readFile);

const dir = path.resolve(__dirname, "../");
const dirs = process.argv.slice(2);

StringStream
    .from(fg.stream(dirs, {cwd: dir, absolute: true}))
    .parse(async file => ({
        file,
        contents: await readFile(file, {encoding: "utf-8"})
    }))
    .assign(async ({contents}) => ({
        lines: contents.split(/\n/).reduce((acc, line) => {
            acc.index.push([acc.cur, line]);
            acc.cur += line.length + 1;
            return acc;
        }, {cur: 0, index: []}).index,
        suggestions: writeGood(contents)
    }))
    .map(({
        file,
        lines,
        suggestions
    }) => suggestions ? suggestions.map(({index, offset, reason}) => {
        const line = lines.findIndex(([start]) => index < start) - 1;
        const [lineStart, lineContent] = lines[line];

        return {
            file,
            row: line + 1,
            column: index - lineStart + offset,
            content: lineContent,
            reason
        };
    }) : [])
    .flatten()
    .each(console.log)
;
