local-json
==========

node.js module for reading json files. supports async and sync modes, along with dynamically updating json files without restarting the server. files are processed in order and merged together using [deep-extend](github.com/unclechu/node-deep-extend). [nbqueue](github.com/kvonflotow/nbqueue) is used to prevent too many files from being opened at once.

### install

```
npm install local-json
```

### usage

```javascript
var LocalJson = require( 'local-json )

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
