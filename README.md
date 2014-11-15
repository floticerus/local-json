local-json
==========

node.js module for reading json files. supports async and sync modes, along with dynamically updating json files without restarting the server. files are processed in order and merged together using [deep-extend](//github.com/unclechu/node-deep-extend). [nbqueue](//github.com/kvonflotow/nbqueue) is used to prevent too many files from being opened at once.

### install

```
npm install local-json
```

### usage

```javascript
var LocalJson = require( 'local-json' )

var reader = new LocalJson(
  // directory to read json files from
  directory: path.join( __dirname, 'json' ),
  
  // set true to enable updating json without restarting the server
  dynamic: true,
  
  // whether or not to log messages on json errors
  logging: true,
  
  // maximum number of files allowed to be processed simultaneously in async mode
  queueLength: 5
)

// async method
reader.getJson( [ 'foo', 'bar' ], function ( err, data )
  {
    if ( err ) return console.log( err )
    
    // data contains object consisting of merged json files
  }
)

// sync method - data contains object consisting of merged json files
var data = reader.getJsonSync( [ 'foo', 'bar' ] )
```

### license

The MIT License (MIT)

Copyright (c) 2014 Kevin von Flotow

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
