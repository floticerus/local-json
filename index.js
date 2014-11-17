/*
  local-json v0.0.7
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

        //var fileData = {}

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

                                        var parsed = parseData.call( that, JSON.parse, fileContents )

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

        function parseData( fn, fileContents )
        {
            var add = {}

            // don't crash the server if the json is invalid
            try
            {
                add = fn( fileContents )
            }

            catch ( e )
            {
                if ( this.opts.logging )
                {
                    // bad json or not found
                    console.log( 'json error', e )
                }
            }

            return add
        }

        /** @constructor */
        function StorageMethod( getFn, setFn, removeFn )
        {
            // allow use without new
            if ( !( this instanceof StorageMethod ) )
            {
                return new StorageMethod( getFn, setFn, removeFn )
            }

            var that = this

            var getFn, setFn, removeFn = noop

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
        }

        StorageMethod.find = function ( str )
        {
            return typeof str !== 'undefined' && storageMethods.hasOwnProperty( str ) ? storageMethods[ str ] : null
        }

        StorageMethod.remove = function ( str )
        {
            if ( StorageMethod.get( str ) )
            {
                delete StorageMethod[ str ]
            }
        }

        // setup default storage method
        // pass whatever you want to the function
        StorageMethod.define( 'default', function ( storageMethod )
            {
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
                    directory: __dirname,

                    // set true to enable updating json without restarting the server
                    dynamic: true,

                    // whether or not to send log messages
                    logging: true,

                    // maximum number of files allowed to be processed simultaneously in async mode
                    queueLength: 5,

                    // call function to get default storage method
                    storageMethod: StorageMethod.find( 'default' )
                },

                // pass custom options for this instance
                opts || {}
            )
        }

        // static reference to StorageMethod constructor
        LocalJson.StorageMethod = StorageMethod;

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
                    file.push( parseData.call( this, require, filePath ) )

                    continue
                }

                var data = fs.readFileSync( filePath, { encoding: 'utf8' } )

                files.push( parseData.call( this, JSON.parse, data ) )
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
                    var fileQueue = new Queue( that.opts.queueLength )

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
                                    return fileDone( null, parseData.call( that, require, filePath ) )
                                }

                                that.opts.storageMethod.get( filePath, function ( err, data )
                                    {
                                        if ( !err && typeof data !== 'undefined' )
                                        {
                                            return fileDone( null, data )
                                        }

                                        fs.readFile( filePath, function ( err, data )
                                            {
                                                if ( err )
                                                {
                                                    return fileDone( err ) // error, file probably not found
                                                }

                                                var parsed = parseData.call( that, JSON.parse, data )

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
