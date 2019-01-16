---
date: 2018-09-04
cover: "/illustration/light-bulb-503881_1920.jpg"
title: New website!
author: Michał <cz@signicode.com>
category: "info"
type: "post"
---

This is the new website, hopefully providing a new way to access Scramjet's documentation.

The docs are working pretty much as they were (old url's should be getting redirected), however we have a new common page and more civilised version of the documentation itself - feel free to check out the [docs section here](/docs).

On this blog section we aim to publish examples and general ideas on using `scramjet` and tools around it. If you happen to have an interesting story or a use case you'd like us to take a look at, [please share it with us](opensource+scramjetpage@signicode.com).

We'll be working on providing more features here, feel free to raise a [new issue on github](https://github.com/signicode/scramjet/issues).

```javascript
    require('scramjet')
        .StringStream
        .from('https://scramjet.eu/docs/')
        .lines()
        .filter(x => x.startsWith('#'))
        .parse(x => ({heading: x.match(/^#+/)[0].length, title: x.replace(/^#+/, '')))
        .JSONStringify()
        .pipe(process.stdout);
```
