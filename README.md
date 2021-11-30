# @mordy/node-ari-read

[![npm (scoped)](https://img.shields.io/npm/v/ari-read.svg)](https://www.npmjs.com/package/ari-read)
[![npm bundle size (minified)](https://img.shields.io/bundlephobia/min/ari-read.svg)](https://www.npmjs.com/package/ari-read)

Replicates the asterisk READ Dialplan

Works with the ari-client library

## Install

```
$ npm install ari-read ari-client
```

## Usage

- Create a reader, pass in the `channel` and `ari` from node-ari
- Now you can use the reader, or even pass it to other folders to use


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
    
            //reader with response, must be between 1 and 3
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
    ari.start('hello');
  })
  .done(); // program will crash if it fails to connect

```

