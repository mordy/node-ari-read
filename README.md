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

 After your call starts, create your a `reader` for your channel, pass in the `channel` and `ari`. You need exactly one reader per channel.

*Params*
- `incoming` the incoming channel
- `ari` the ari application

**Step 2:**

Each time you want to read one or more files and get a DTMF Response, `await` your `reader`. Pass a single object to this function, the object properties are below

The reader can be passed as a parameter to other parts of your application.

*Object properties*
- `soundFiles` - array required; list of  filenames to read
- `digitsInResponse` - int, number of digits requested, `0` will just read and return on completion, default 0
- `attempts` - int required, number of invalid attempts to allow before terminating call, default 3
- `timeout` - int required, number of seconds of inactivity to allow before terminating call, default 10
- `responseValidCallback` - callback function to test whether the response is valid or not, default is that all responses are valid
- `debug` - if set to `true` it will read out some debug commands, default is false


## Example
```js
const client = require('ari-client');
const read = require("ari-read");

client.connect('http://localhost:8088', 'user', 'secret')
  .then((ari)=> {
    //handle new call
    ari.once('StasisStart',  async (event, incoming)=> {
        incoming.answer().then(async () => {
            //create reader
            const reader = read(incoming, ari);

            //reader without response
            await reader(
                audioFiles: ['welcome'],
                digitsInResponse: 0,
                responseValidCallback: () => true
            )
    
            //reader with response, must be * or a digit between 1 and 3
            const selection = await reader({
                audioFiles: [file1, file2], 
                digitsInResponse: 1, 
                attempts: 3, 
                timeout: 10, 
                responseValidCallback:  (num) => {
                    return num=='*' || (num > 0 && num <= 3)
                }
            }).catch(
                (err) => { console.log(err) }
            );

            doSomethingWith(selection); //
        })
    });
    //connect to the statis app
    ari.start('test');
  })
  .done(); // program will crash if it fails to connect
```

## Example using TTS (Text-to-Speech)

This helper replaces the `reader` in the above example with one that will perform TTS before returning the file. Instead of sending `soundFiles` you instead send a `text` param.

```js
const read = require("ari-read");

const tts await (string) => {
    //use your favorite library and return the filename you generate.
}

const readWithTTS = (channel, ari) => {
    const reader = read(channel, ari);

    //the reader returns an async function for us to await
    return async (props) => {
        const { text} = props;

        let soundFiles = await Promise.all((typeof text === 'string' ? [text] : text).map(s => tts(s)));
        return await reader({soundFiles, ...props})
    }
}

module.exports = readWithTTS;
```

## Concurrency Notes ##
This code has been optimized to run at very high call load (has been tested at 300 concurrent on 4 CPUs)
  - Asterisk ships with low version of node js, 10 has improved performance and works better at high load.
  - Transcoding can use up CPU resources fast, so use source files that are less CPU intensive
  - You can setup clustering on the ARI App each process connects to a different statis app, let the dialplan load balance which calls go to which statis app