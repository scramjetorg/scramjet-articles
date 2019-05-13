---
date: 2018-09-05
cover: "/illustration/cyberspace-2784907_1920.jpg"
title: Stream from anything
author: Michał <cz@signicode.com>
category: "howto"
type: "post"
---

Streaming anything as a node.js stream
----------------------------------------

With the introduction of `scramjet.from` and a range of static `from` methods on all Scramjet stream classes we introduced a simple way to create streams from different sources. In the same way the stream is transformed it can generated quite as simply. Here's a piece on the ways to generate your chunks in Scramjet.

Let's start with basics:

## From another stream

The idea behind `from` is to make sure our operand is a stream and if not, attempt to "streamify" it. In some older samples and references scramjet required the following creation:

```javascript
fs.createReadStream(filePath)
  .pipe(new StringStream())
  .map(asyncMapper)
  // and some more operations.
```

This in most cases is quite sensible, but I found that the above code is so often repeated that it reminds me of `Array.prototype.slice.call(something)`. So like `Array.from`, the `scramjet.from` method was created.

If we pass another stream to `from` it will:

* First check if the stream is not of the same class as the context of `from`. If it is then there's no need to create a new stream - we just return what was passed. So for instance `DataStream.from(new DataStream())` the argument already is a `DataStream`.
* Otherwise if it's a stream, but it's of another class (let's say it's a stream created from `fs.createReadStream`) the `SomeStream.from` method will create a `new SomeStream` and will pipe the passed stream to the new one.

So now we can simply use:

```javascript
StringStream
  .from(fs.createReadStream(filePath))
  .map(asyncMapper)
  // and some more operations.
```

This way we can make sure we can use the `scramjet` goodness on any other stream.

## From iterables

Another repeatable use case of `scramjet` is when there's a need to asynchronously iterate over an Array - a quite common starting point of a project:

```javascript
const countries = [
  "it.json",
  "pl.json",
  "uk.json",
  "fr.json",
  "de.json",
  "es.json"
];

await (
  StringStream.from(countries)
    .parse(name => await loadFile(name))
    // and we get a stream of all contents
);
```

It also works similarly on Iterators and iterables.

## From generators

Oh, I did fall in love with those Async Generators and immediately thought - this is the best implementation of creating the chunks in some of my cases. For example reading some 4-bit digital values from GPIO to a stream, but not more often than every second:

```javascript
const gpio = require("rpi-gpio-promise");
const sleep = require('sleep-promise');

DataStream
  .from(async function(init)* {
    await Promise.all([
      gpio.setup(init, gpio.DIR_IN),
      gpio.setup(init + 1, gpio.DIR_IN),
      gpio.setup(init + 2, gpio.DIR_IN),
      gpio.setup(init + 3, gpio.DIR_IN)
    ]);

    while (true) {
      yield await Promise.all([
          gpio.read(init)
          gpio.read(init + 1)
          gpio.read(init + 2)
          gpio.read(init + 3)
      ]);
      await sleep(1000);
    }
  }, 6) // anything passed here will be passed to generator as initial arguments.
  .map(([a,b,c,d]) => ({value: a*8 + b*4 + c*2 + d}))
  .each(console.log)
  .run()
;

// and we get:
//  1
//  3
//  7
//  4
// and so on.
```

## From functions

Sometimes, I found, that stream generators may depend on some synchronous or asynchronous logic, but I'd like the program to synchronously return a stream. I mean after all `fs.createReadStream` returns the stream before knowing if the file actually exists. And let's face it: we do know what we want be returned - a `DataStream` for instance.

This lead to introduction of passing `functions` to `from`:

```javascript
async function getData(base) {
  const length = await requestPromise.get(`${base}/count`);

  if (length === 0) return [';no-entries'];
  else return request.get(`${base}/entries.csv`);
}

DataStream
  .from(getData, "https://myapi.example.com") // arguments passed here will be passed to the function
  .pipe(fs.createWriteStream('log.txt'));
```

So we can already pipe the data to the log even though we don't know where we'll get the stream from in the end. Anything that the function returns will get passed to another `from` and the output from that will be piped to the stream that was returned in the beginning.

You can even return another function - like a redirect it will try to resolve it. Just keep in mind you can get to an infinite loop here.

## From modules

Similarly to the above functions, passing a string to `from` will attempt to load a module. Let's consider these two files:

```javascript
/** @file lib/gen.js */

module.exports = (apiBase, key, secret) => {
  if (!valid(key, secret)) {
    throw new Error("Invalid key or secret");
  }

  return streamData(apiBase, key, secret);
}
```

```javascript
/** @file index.js */
DataStream
  .from(
    'lib/gen',
    process.env.API_BASE,
    process.env.API_KEY,
    process.env.API_SECRET
  )
  .pipe(fs.createWriteStream(process.argv[2]));
```

In the second file we simply reference the relative location of the module (as we pass it to `require`). Scramjet will load the module and use it's module.exports as an argument for another `from` call, like in the case of a function.

## Summary

I hope this was a good read. If you think there something to correct or add, please feel free to raise a [new issue on GitHub](https://github.com/signicode/scramjet/issues).
