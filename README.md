# node-ari-read

[![npm (scoped)](https://img.shields.io/npm/v/ari-read.svg)](https://www.npmjs.com/package/ari-read)
[![npm bundle size (minified)](https://img.shields.io/bundlephobia/min/ari-read.svg)](https://www.npmjs.com/package/ari-read)

Replicates the [asterisk READ Dialplan](https://wiki.asterisk.org/wiki/display/AST/Asterisk+19+Application_Read) for nodejs. Is a helper for the official nodejs ARI client  package [ari-client](https://www.npmjs.com/package/ari-client)

## Install

```shell
$ npm i ari-read
```

## Getting Started

**Step 1:**

 After `ari` begins a new call use the `readerFactory` to create a `read` function for the channel, the factory requires 2 params exactly, the `channel` and `ari` variable. You need one `read` per channel.

*Params*
- `incoming` the incoming channel
- `ari` the ari application

**Step 2:**

To read one or more files and get a DTMF Response, `await` your `read` function. Pass a single object to this function, the object properties are below

The `read` function can be passed as a parameter to other parts of your application.

*Object properties*
- `soundFiles` - array of  filenames to read (required)
- `digitsInResponse` - int number of digits requested, `0` will just read and return on completion, default `0`
- `attempts` - int required, number of invalid attempts to allow before terminating call, default `3`
- `timeout` - int required, number of seconds of inactivity to allow before terminating call, default `10`
- `responseValidCallback` - callback function to test whether the response is valid or not, default is that all responses are valid
- `debug` - if set to `true` it will read out some debug commands, default `false`


## Example
```js
const client = require('ari-client');
const readerFactory = require('ari-read');

client.connect('http://localhost:8088', 'user', 'secret')
  .then((ari)=> {
    //handle new call
    ari.once('StasisStart',  async (event, incoming)=> {
        incoming.answer().then(async () => {
            //create reader
            const read = readerFactory(incoming, ari);

            //read without response
            await read(
                audioFiles: ['welcome'],
                digitsInResponse: 0,
            )
    
            //read with response, must be * or a digit between 1 and 3
            const selection = await read({
                audioFiles: [file1, file2], 
                digitsInResponse: 1, 
                responseValidCallback:  (num) => {
                    return num=='*' || (num > 0 && num <= 3)
                }
            }).catch(
                (err) => { console.log(err) }
            );

            //now you can do an action with your selection
            doSomething(selection); 
        })
    });
    //connect to the statis app
    ari.start('test');
  })
  .done(); // program will crash if it fails to connect
```

## Example using TTS (Text-to-Speech)

This example replaces the `readerFactory` in the above example with one that will perform TTS before returning the file. Instead of sending `soundFiles` to this helper, send an array of `text` to read.

```js
const readerFactory = require("ari-read");

const tts await (string) => {
    //use your favorite library and return the filename you generate.
}

const readerFactoryWithTTS = (channel, ari) => {
    const read = readerFactory(channel, ari);

    //the reader returns an async function for us to await
    return async (props) => {
        const { text} = props;

        let soundFiles = await Promise.all((typeof text === 'string' ? [text] : text).map(s => tts(s)));
        return await read({soundFiles, ...props})
    }
}
module.exports = readerFactoryWithTTS;
```

## Concurrency Notes ##
This code has been optimized to run at high call load (Author has tested with 300 on concurrent on 4 CPUs)
  - Asterisk ships with low version of nodejs, nodejs 10 has improved performance with async/promises and should be faster when at high load.
  - Transcoding can use significant CPU, ensure that the source files use codecs that use the least CPU for best performance.
  - If you setup clustering on the ARI App, you can give each process a different statis app to connect to. The dialplan can load balance between the statis apps.