/*
  local-json v0.0.6
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
                return new StorageMethod( getFn, setFn )
            }

            // default as noop to avoid errors
            this.defineGet( getFn || noop )

            // default as noop to avoid errors
            this.defineSet( setFn || noop )

            // default as noop to avoid errors
            this.defineRemove( removeFn || noop )
        }

        // use wrapper function
        StorageMethod.prototype.defineGet = function ( fn )
        {
            var that = this

            this.get = function ( filePath, callback )
            {
                // fire the get function
                fn.call( that, filePath, callback )
            }
        }

        // use wrapper function
        StorageMethod.prototype.defineSet = function ( fn )
        {
            var that = this

            this.set = function ( filePath, data, callback )
            {
                // fire the set function
                fn.call( that, filePath, data, callback )
            }
        }

        // use wrapper function
        StorageMethod.prototype.defineRemove = function ( fn )
        {
            var that = this

            this.remove = function ( filePath, callback )
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

        StorageMethod.prototype.get = noop
        StorageMethod.prototype.set = noop
        StorageMethod.prototype.remove = noop

        // default local in-memory storage method
        var defaultStorageMethod = ( function ()
            {
                var storageMethod = new StorageMethod()

                var fileData = {}

                storageMethod.defineGet( function ( filePath, done )
                    {
                        if ( !fileData.hasOwnProperty( filePath ) )
                        {
                            return done( 'not found' )
                        }

                        done( null, fileData[ filePath ] )
                    }
                )

                storageMethod.defineSet( function ( filePath, data, done )
                    {
                        fileData[ filePath ] = data

                        done( null, data )
                    }
                )

                storageMethod.defineRemove( function ( filePath, done )
                    {
                        if ( fileData.hasOwnProperty( filePath ) )
                        {
                            delete fileData[ filePath ]
                        }

                        done()
                    }
                )

                return storageMethod
            }
        )();

        /** @constructor */
        function LocalJson( opts )
        {
            // allow use without new
            if ( !( this instanceof LocalJson ) )
            {
                return new LocalJson( opts )
            }

            this.opts = deepExtend(
                {
                    directory: __dirname,

                    // set true to enable updating json without restarting the server
                    dynamic: true,

                    // whether or not to send log messages
                    logging: true,

                    // maximum number of files allowed to be processed simultaneously in async mode
                    queueLength: 5,

                    storageMethod: defaultStorageMethod
                },

                opts || {}
            )

            this.data = {}
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

                var filePath = path.join( this.opts.directory, str + '.json' )

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

                        fileQueue.add( function ( fileDone )
                            {
                                var filePath = path.join( that.opts.directory, str + '.json' )

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
