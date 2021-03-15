---
date: 2018-09-06
cover: "/illustration/electronics-3628675_1920.jpg"
title: Oh my! The stream does not flow!
author: Michał <cz@signicode.com>
category: "howto"
type: "post"
---

Most time spent on debugging streams is answering the question: why doesn't it flow?

## Streaming speed

What we need to know first is if the stream has a reason to flow. To understand that it's worth to consider reactive stream programming as a metaphor in plumbing (another good alternative is electric circuitry, but I tend to prefer water over electricity).

**A stream based program is like pipework.**

Every call in a program can be envisioned as pipe joint, so if we consider a simple program:

```javascript
  DataStream.from(process.stdin)
    .lines()
    .parse(asyncParser)
    .filter(x => x && x.level <= 2)
    .pipe(stdout);
```

Our plumbing looks like this:

```text
stdin --> StringStream.from --> lines --> parse --> filter --> stdout
```

The stream above has an input, some transforms and an output just as piping would. Now the stream will flow as fast as the slowest element in the above piping. I won't try to tell you you could apply Bernoulli's principles here but I do suggest just to consider this and you'll be amazed to see the similarities.

In the above program we can assume that the `asyncParser` method would be our bottleneck and the limiting factor.

Now let's change the program to use one point in the program to push data to two separate transforms like this:

```javascript
  const step = DataStream.from(process.stdin)
    .lines()
    .parse(asyncParser);

  step
    .filter(x => x && x.level <= 2)
    .pipe(stdout);

  const count = await step.reduce(
    ([count, lines], ln) => ([ln.level > 2 ? count : count + 1, lines + 1])
    [0,0]
  );
  console.log(`Processed ${count[0]} of ${count[1]} entries.`);
```

Out plumbing looks like this:

```text
                                                 /--> filter --> stdout
stdin --> StringStream.from --> lines --> parse <
                                                 \--> reduce --> await
```

Now the stream will flow at the rate of the slower of our outputs.

The flow may be slow, but it can be equal to zero - which means that your program will get stuck and stop operating. There are three possible reasons for this:

* **The source does not flow** - this is when the source of the data stops pushing new data into the stream - for example: an HTTP response from the server is not being sent due to network congestion.
* **The output does not accept more data** - for example the database pool you're using to stream the output is exhausted and we're waiting for a free connection.
* **One of the transforms is not returning data** - for example a promise is returned but never resolved (due to an error).

## Reading flow rate

Part of debugging of the flow is to find the flow rate of our stream at every point in the flow. Each stream will attempt to consume some items from the previous operations.

Although `scramjet` does not provide any specific methods for this, the flow rate can be read pretty easily by putting this simple `use` command:

```javascript
  StringStream.from(request.get('https://example.org/data.json'))
    .parse(asyncParser)
    .do(asyncOperation)
    // --- here begins ---
    .use(stream => {
      let cnt = 0;
      stream.do(() => cnt++);

      setInterval(() => {
        console.log(`Flow rate ${cnt} entries per second...`);
        cnt = 0;
      }), 1000 /* you may want to adapt this to your needs */);

      return stream; // always rememeber to return the stream!
    })
    // --- here ends ---
    .filter(asyncFilter)
    .reduce(asyncReducer)
```

Depending on what flow rate you'd expect you should adapt the time interval marked above. For example, when parsing a log file, I'd leave it at 1000 milliseconds, but reading a stream of comments this may be better at 60000 milliseconds.

**Results:**

* In a good situation - when the source pushes, transforms return and output pulls chunks - you would expect something like this:

```text
Flow rate 122 entries per second...
Flow rate 169 entries per second...
Flow rate 118 entries per second...
Flow rate 201 entries per second...
```

The flow may be unequal, but it keeps flowing with every second.

* If the source pushes and all transforms before our `use` command work, the output will be something like this:

```text
Flow rate 63 entries per second...
Flow rate 0 entries per second...
Flow rate 0 entries per second...
Flow rate 0 entries per second...
```

The use has seen some initial elements, but after that nothing happened.

* Lastly if the source or one of the transforms before our `use` command is not working, the output will look like this:

```text
Flow rate 0 entries per second...
Flow rate 0 entries per second...
Flow rate 0 entries per second...
Flow rate 0 entries per second...
```

No chunks reach the position at all, which means that

## Reading the stream graph

Each `scramjet` stream has a method called `graph` which returns a list of streams that are connected to the current instance. This can be read only one way now, but in future versions this will be more useful.

A simple code helps finding where our stream originates in our code:

```javascript
  function printStreamGraph(str) {
    str.graph((instances) => {
      console.log(str.name);
      instances.forEach(x => console.log(x.constructed.split("\n")[2]));
    })
  }
```

Calling this on a stream will result in something like this:

```
  DataStream(18)
    at DataStream.map (index.js:581:15)
    at DataStream.filter (lib/loader.js:507:25)
    at DataStream.flatMap (lib/loader.js:637:17)
    at StringStream.parse (lib/source.js:805:12)
    at StringStream.from (index.js:588:7)
```

Now it's just a matter of finding your suspect.

## Summary

I hope this was a good read. If you think there something to correct or add, please feel free to raise a [new issue on GitHub](https://github.com/signicode/scramjet/issues).
