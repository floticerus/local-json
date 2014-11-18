/*
  local-json v0.0.10
  copyright 2014 - kevin von flotow
  MIT license
*/
;( function ()
    {
        var fs = require( 'fs' )

        var path = require( 'path' )

        var Queue = require( 'nbqueue' )

        var deepExtend = require( 'deep-extend' )

        var chokidar = require( 'chokidar' )

        var watchers = {}

        var mainQueue = new Queue( 5 )

        var storageMethods = {}

        var jsonRegex = /\.json$/

        function noop(){}

        // pass the full path of the file
        function watchFile( file )
        {
            // make sure file is at least something
            if ( !file || '' === file )
            {
                return
            }

            // make sure it's a string
            file = file.toString()

            if ( watchers.hasOwnProperty( file ) )
            {
                return // already exists
            }

            // watch it
            watchers[ file ] = chokidar.watch( file, { ignored:  /[\/\\]\./, persistent: true } )

            var that = this

            // setup event listeners
            watchers[ file ]
                // listener for when the file has been removed
                .on( 'unlink', function ( path )
                    {
                        that.opts.storageMethod.remove( path, function ( err )
                            {
                                if ( err )
                                {
                                    if ( that.opts.logging )
                                    {
                                        console.log( err )
                                    }

                                    return 
                                }

                                // success
                                
                            }
                        )
                    }
                )

                // listener for when the file has been changed
                .on( 'change', function ( path )
                    {
                        // add to main file processing queue
                        mainQueue.add( function ( mainDone )
                            {
                                // attempt to read the file
                                fs.readFile( path, function ( err, fileContents )
                                    {
                                        // notify nbqueue that the async function has finished,
                                        // regardless of success
                                        mainDone()

                                        // check for errors
                                        if ( err )
                                        {
                                            // see if LocalJson instance logging is enabled
                                            if ( that.opts.logging )
                                            {
                                                console.log( err )
                                            }

                                            return 
                                        }

                                        var parsed = LocalJson.TryParse.call( that, JSON.parse, fileContents )

                                        // cache new json
                                        that.opts.storageMethod.set( path, parsed, function ( err )
                                            {
                                                if ( err )
                                                {
                                                    if ( that.opts.logging )
                                                    {
                                                        console.log( err )
                                                    }

                                                    return
                                                }

                                                // success
                                                
                                            }
                                        )
                                    }
                                )
                            }
                        )
                    }
                )
        }

        /** @constructor */
        function StorageMethod( getFn, setFn, removeFn )
        {
            // allow use without new
            if ( !( this instanceof StorageMethod ) )
            {
                if ( 'string' === typeof getFn )
                {
                    // map to StorageMethod.find()
                    // getFn is method name, setFn is options in this case
                    return StorageMethod.find( getFn, setFn )
                }

                // return new StorageMethod instance
                return new StorageMethod( getFn, setFn, removeFn )
            }

            var that = this

            var initFn, getFn, setFn, removeFn = noop

            Object.defineProperty( this, 'init',
                {
                    get: function ()
                    {
                        return initFn
                    },

                    set: function( fn )
                    {
                        initFn = function ()
                        {
                            fn.call( that )
                        }
                    }
                }
            )

            Object.defineProperty( this, 'get',
                {
                    get: function ()
                    {
                        return getFn
                    },

                    set: function ( fn )
                    {
                        getFn = function ( filePath, callback )
                        {
                            fn.call( that, filePath, callback )
                        }
                    }
                }
            )

            Object.defineProperty( this, 'set',
                {
                    get: function ()
                    {
                        return setFn
                    },

                    set: function ( fn )
                    {
                        setFn = function ( filePath, data, callback )
                        {
                            fn.call( that, filePath, data, callback )
                        }
                    }
                }
            )

            Object.defineProperty( this, 'remove',
                {
                    get: function ()
                    {
                        return removeFn
                    },

                    set: function ( fn )
                    {
                        removeFn = function ( filePath, callback )
                        {
                            // unwatch file
                            if ( watchers.hasOwnProperty( filePath ) )
                            {
                                // stop watching the file
                                watchers[ filePath ].close()

                                // remove reference
                                delete watchers[ filePath ]
                            }

                            // fire the remove function
                            fn.call( that, filePath, callback )
                        }
                    }
                }
            )

            this.get = getFn || noop

            this.set = setFn || noop

            this.remove = setFn || noop
        }

        // name them something other than get/set
        StorageMethod.define = function ( str, fn )
        {
            // pass new StorageMethod instance to definition function
            storageMethods[ str ] = fn( new StorageMethod() )

            return storageMethods[ str ]
        }

        StorageMethod.find = function ( str, options )
        {
            return typeof str !== 'undefined' && storageMethods.hasOwnProperty( str ) ? storageMethods[ str ]( options ) : null
        }

        StorageMethod.remove = function ( str )
        {
            if ( StorageMethod.get( str ) )
            {
                delete StorageMethod[ str ]
            }
        }

        // setup default storage method
        // a new StorageMethod instance is passed to the function
        StorageMethod.define( 'default', function ( storageMethod )
            {
                // must return a function. options parameter is optional,
                // and can be used for whatever you want.
                return function ( options )
                {
                    // custom options, not used in default storage method
                    //options = options || {}

                    var fileData = {}

                    storageMethod.init = function ( done )
                    {
                        // init stuff could go here
                    }

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

        /** @constructor */
        function LocalJson( opts )
        {
            // allow use without new
            if ( !( this instanceof LocalJson ) )
            {
                return new LocalJson( opts )
            }

            // use deep-extend to merge options with defaults
            this.opts = deepExtend(

                // pass defaults first
                {
                    // maximum number of files allowed to be processed simultaneously in async mode
                    // raise if you're on a beastly server and need more performance
                    concurrency: 3,

                    // working directory to read json files from
                    directory: __dirname,

                    // set true to enable updating json without restarting the server
                    dynamic: true,

                    // whether or not to execute internal log messages
                    logging: true,

                    // setting to true will enable recursive directory reading.
                    // subfolders can be accessed using forward slashes: 'path/to/file'
                    //
                    // not implemented yet
                    recursive: true

                    // storage method for getting and setting parsed json data.
                    // default uses standard javascript objects for cache, and is
                    // generally not ideal outside of testing/development.
                    /* storageMethod: StorageMethod( 'default',
                        {
                            // storage method options
                            // none for default
                        }
                    ) */
                },

                // pass custom options for this instance
                opts || {}
            )

            this.opts.storageMethod = opts.storageMethod || StorageMethod( 'default', {} )

            this.opts.storageMethod.init()
        }

        // static reference to StorageMethod constructor
        LocalJson.StorageMethod = StorageMethod

        LocalJson.TryParse = function ( fn, data )
        {
            var add = {}

            // don't crash the server if the json is invalid
            try
            {
                add = fn( data )
            }

            catch ( e )
            {
                if ( this.opts && this.opts.logging )
                {
                    // bad json or not found
                    console.log( 'json error', e )
                }
            }

            return add
        }

        // use only sync methods
        LocalJson.prototype.getDataSync = function ( strings )
        {
            if ( !Array.isArray( strings ) )
            {
                strings = [ strings ]
            }

            var files = []

            for ( var i = 0, l = strings.length; i < l; ++i )
            {
                var str = strings[ i ].toString()

                // append .json if necessary
                str = jsonRegex.test( str ) ? str : str + '.json'

                // use path.join() to get full path to file
                var filePath = path.join( this.opts.directory, str )

                if ( !this.opts.dynamic )
                {
                    file.push( LocalJson.TryParse.call( this, require, filePath ) )

                    continue
                }

                var data = fs.readFileSync( filePath, { encoding: 'utf8' } )

                files.push( LocalJson.TryParse.call( this, JSON.parse, data ) )
            }

            return deepExtend.apply( null, files )
        }

        // use async methods when in dynamic mode
        LocalJson.prototype.getData = function ( strings, callback )
        {
            callback = callback || noop

            if ( !Array.isArray( strings ) )
            {
                strings = [ strings ]
            }

            var that = this

            mainQueue.add( function ( mainDone )
                {
                    var fileQueue = new Queue( that.opts.concurrency )

                    for ( var i = 0, l = strings.length; i < l; ++i )
                    {
                        var str = strings[ i ].toString()

                        // append .json if necessary
                        str = jsonRegex.test( str ) ? str : str + '.json'

                        fileQueue.add( function ( fileDone )
                            {
                                // use path.join() to get full path to file
                                var filePath = path.join( that.opts.directory, str )

                                if ( !that.opts.dynamic )
                                {
                                    return fileDone( null, LocalJson.TryParse.call( that, require, filePath ) )
                                }

                                that.opts.storageMethod.get( filePath, function ( err, data )
                                    {
                                        if ( !err && data )
                                        {
                                            return fileDone( null, data )
                                        }

                                        fs.readFile( filePath, function ( err, data )
                                            {
                                                if ( err )
                                                {
                                                    return fileDone( err ) // error, file probably not found
                                                }

                                                var parsed = LocalJson.TryParse.call( that, JSON.parse, data )

                                                that.opts.storageMethod.set( filePath, parsed, function ( err )
                                                    {
                                                        if ( err )
                                                        {
                                                            return fileDone( err )
                                                        }

                                                        watchFile.call( that, filePath )

                                                        fileDone( null, parsed )
                                                    }
                                                )
                                            }
                                        )
                                    }
                                )
                            }
                        )
                    }

                    // finish up async fileQueue
                    fileQueue.done( function ( err, data )
                        {
                            data = data || []

                            var combined = {}

                            if ( 0 !== data.length )
                            {
                                combined = deepExtend.apply( null, data || [] )
                            }

                            callback( err, combined )

                            mainDone()
                        }
                    )
                }
            )
        }

        module.exports = LocalJson
    }
)();
