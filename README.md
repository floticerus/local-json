local-json
==========

node.js module for reading json files. supports async and sync modes, along with dynamically updating and caching json files without restarting the server.

- [deep-extend](https://github.com/unclechu/node-deep-extend) is used to merge json after it is processed.
- [nbqueue](https://github.com/kvonflotow/nbqueue) is used to prevent too many files from being opened at once.
- [chokidar](https://github.com/paulmillr/chokidar) is used for watching files and dynamically updating the server as they are changed.

### install

```
npm install local-json
```

### typical usage

```javascript
var LocalJson = require( 'local-json' )

// default options are shown, everything is optional
var reader = new LocalJson(
  // maximum number of files allowed to be processed simultaneously in async mode
  // raise if you're on a beastly server and need more performance
  concurrency: 3,

  // working directory to read json files from
  directory: __dirname,
  
  // set true to enable updating json without restarting the server
  dynamic: true,
  
  // whether or not to log messages on json errors
  logging: true,
  
  // storage method for getting and setting parsed json data.
  // default uses standard javascript objects for cache, and is
  // generally not ideal outside of testing/development.
  storageMethod: LocalJson.StorageMethod( 'default'
    {
      // pass whatever you want to a custom storage method
      // default storage method has no options
    }
  )
)

// merge base.json, page.json, and blog.json
// .json extension is optional

// async method. if dynamic, parses json and stores the result according to the storage method.
// non-dynamic requests use require, which has built-in caching. storage methods may be extended
// to run when dynamic is disabled in the future, if needed.
reader.getData( [ 'base', 'page', 'blog' ], function ( err, data )
  {
    if ( err ) return console.log( err )
    
    // data contains object consisting of merged json files
  }
)

// sync method - data contains object consisting of merged json files.
// getDataSync does NOT utilize storage methods or caching.
// recommended only for quick prototyping and tests
var data = reader.getDataSync( [ 'base', 'page', 'blog' ] )
```

### storage methods

local-json provides a way of using your own methods for getting/setting the parsed json data. any type of data storage system can be used. get, set, and remove functions must all be defined or it will not work properly.

currently available storage methods:
 - default - plain javascript object
 - [local-json-redis](https://github.com/kvonflotow/local-json-redis)
 - [local-json-mongodb](https://github.com/kvonflotow/local-json-mongodb)

the default storage method looks like this:

```javascript
// setup default storage method
// a new StorageMethod instance is passed to the function
StorageMethod.define( 'default', function ( storageMethod )
  {
    // must return a function. options parameter is optional,
    // and can be used for whatever you want.
    return function ( options )
    {
      // custom options, not used in default storage method
      // options = options || {}

      var fileData = {}

      storageMethod.get = function ( filePath, done )
      {
        if ( !fileData.hasOwnProperty( filePath ) )
        {
          return done( 'not found' )
        }

        done( null, fileData[ filePath ] )
      }

      storageMethod.set = function ( filePath, data, done )
      {
        fileData[ filePath ] = data

        done( null, data )
      }

      storageMethod.remove = function ( filePath, done )
      {
        if ( fileData.hasOwnProperty( filePath ) )
        {
          delete fileData[ filePath ]
        }

        done()
      }

      return storageMethod
    }
  }
)
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
