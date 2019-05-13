---
date: 2019-05-07
cover: "/illustration/wind-turbine-2218457_1920.jpg"
title: Generators
author: Michał <cz@signicode.com>
category: "howto"
featured: true
lead: Easy node.js stream creation using es6 generators and async generators
type: "post"
---

Node.js v8 and v10 brought two new ways of handling and generating data: `function*` and `async function*` respectively. Scramjet brings generator and iterator protocol support to node.js streams and makes them easy to use as callbacks to standard methods.

Streams are great for data processing, but it must be said they're far from being easy to use. Modules like [`scramjet`](https://www.scramjet.org) or [`highland.js`](https://highlandjs.org/) aim to make stream transforms easier to use but there's always a matter of getting the stream in the first place.

In `scramjet` since version 4.20 you could use [async] generators in `DataStream.from` and `DataStream.use` and in 4.24 I added the possibility in `pull`, `consume` and `flatMap` also. This may feel not that important, but actually it does make a major difference in how you can use `scramjet` and how the data is being consumed.

Let's see how this works in every method - I'm going to use `function*` and `async function*` where it makes sense for the example, but you can safely assume that asynchronous and synchronous generators are supported everywhere.

## Generating a stream with "from" method

Here's a simple generator that creates a stream sequential of numbers:

```javascript
DataStream
    .from(
        function*(start = 0) {
            let i = 0;
            while (i < 100) {
                // this is where we generate the data
                yield i++ + start;
            }
        },
        null,       // options go here, but can be omitted
        10          // all extra arguments will be passed to a generator
    )
    .stringify(x => `file.part.${x}.zip`)
    .consume(console.log)
    .then(() => console.log("done!"))
;
// -> file.part.10.zip
// -> file.part.11.zip
// -> file.part.12.zip
// -> file.part.13.zip
// ...
// -> file.part.109.zip
// -> done!
```

This will be useful for scenarios where lots of consecutive items have to be dealt with. But what if we'd actually want to check something, like the existence of a file on filesystem? Here's where async generators come into play. An async generator just an `async function` in which you can `yield` your data. Better yet, `scramjet` takes care of handling the generator so you get a ready stream like this:

```javascript
const readFile = util.promisify(fs.readFile);

StringStream
    .from(
        async function*(start = 0, end = 100) {
            let i = 0;
            while (i < end) {
                // this is where we generate the data
                const filename = `data.${i++ + start}.json`;
                try {
                    // we simply yield the whole file here.
                    yield readFile(filename, {encoding: "utf-8"});
                } catch(e) {
                    // if the reading fails simply return (let's assume that the file doesn't exist)
                    return;
                }
            }
        },
        null,       // options go here, but can be omitted
        10,         // all extra arguments will be passed to a generator
        39
    )
    .JSONParse()    // parses all entries as JSON
    .consume(console.log)
    .then(() => console.log("done!"))
;

// -> {contents: "of", file: [10]}}
// -> {contents: "of", file: [11]}}
// -> ...
// -> {contents: "of", file: [37]}}
// -> done!
```

As you see, generators give us a good ways of creating streams. The last example however is not as efficient as it should. The generator cannot be run in parallel - you should think of it as a state machine that runs from `yield` to `yield` until `return`. But there's nothing keeping us from executing a couple generators in parallel, which we can do further down the stream.

## Generating entries in "pull" and "flatMap"

In order to make the generators run in parallel we can simply use the first generator to generate the stream entries synchronously then run the asynchronous operations in another generator like this:

```javascript
// we'll be doing some reading so let's prepare a method here.
const readJson = async (file) => JSON.parse(
    await readFile(file, {encoding: "utf-8"})
);

DataStream
    .from(function *() {
        yield 1;
        yield 2;
        yield 3;
    })
    .flatMap(async function*(num) {
        // let's assume we need to fetch some index file
        const data = await readJson(`./dir-${num}/index.json`);

        // now that we got the index we can run the loop:
        for (let file of data) {
            const entries = await readJson(`./dir-${num}/${file}`);

            // here we output all entries for a file
            if (Array.isArray(entries))
                yield* entries;
        }
    })
    .consume(console.log)
    .then(() => console.log("done!"));

// -> {data: "from", dir: 1, file: 1, entry: 1}}
// -> {data: "from", dir: 2, file: 1, entry: 2}}
// -> {data: "from", dir: 1, file: 2, entry: 1}}
// -> {data: "from", dir: 1, file: 2, entry: 2}}
// -> {data: "from", dir: 2, file: 2, entry: 1}}
// -> {data: "from", dir: 1, file: 3, entry: 1}}
// -> {data: "from", dir: 2, file: 3, entry: 1}}
// -> ...
// -> done!
```

In this example we're reading whole directories, but instead going one by one, we're outputting entries from files in order as they're read. See also that I used `yield*`. It's a handy feature that outputs anything iterable (including async iterables) flattening the output. Writing `yield* iterable` has the same effect to `for await (let c of iterable) yield c`.

Another option that `scramjet` gives you is using an iterator in `pull` like this:

```javascript
const stream = new DataStream();

(async () => {
    const data = await fetchJson('https://example.org/index.json');
    for (let item of data) {
        await stream.pull(async function*() {
            for (let element of item)
                yield element.ref ? await fetchJson(element.ref) : element;
        });
    }
})()
    .catch(e => stream.raise(e))
    .then(() => stream.end())
;

return stream;
```

As shown the generators simplify the code when dealing with multiple asynchronous operations done at different levels. For instance here's an alternative version of the last example without generators:

```javascript
const stream = new DataStream();

(async () => {
    const data = await fetchJson('https://example.org/index.json');
    for (let item of data) {
        await stream.whenWrote(item);
    }
})()
    .catch(e => stream.raise(e))
    .then(() => stream.end())
;

return stream
    .flatMap(async x => {
        const ret = [];
        for (let i of x) {
            if (element.ref) ret.push(await fetchJson(element.ref));
            else ret.push(element);
        }
        return ret;
    });
```

Not only the first version is more readable, but also chunks are pushed one after another and there's no need for transforming the stream with a `flatMap`.

If there's an interesting example you'd like to add, or write an article yourself - fork the [signicode/scramjet-articles repo](https://github.com/signicode/scramjet-articles) and create a pull request.
