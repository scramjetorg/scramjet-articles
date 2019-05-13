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
        10
    )
    .stringify(x => `file.part.${x}.zip`)
    .consume(console.log)
    .then(() => console.log("done"!))
;
// -> file.part.10.zip
// -> file.part.11.zip
// -> file.part.12.zip
// -> file.part.13.zip
// ...
// -> file.part.109.zip
// -> done!
```

This will be useful for scenarios where lots of consecutive items have to be dealt with. But what if we'd actually want to check something, like the existence of a di
