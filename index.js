/*
  local-json v0.0.5
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

        var mainQueue = new Queue( 5 )

        var fileData = {}

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

            // watch it
            var watcher = chokidar.watch( file, { ignored:  /[\/\\]\./, persistent: true } )

            var that = this

            // setup event listeners
            watcher
                // listener for when the file has been removed
                .on( 'unlink', function ( path )
                    {
                        // delete cached file data if it exists
                        if ( fileData.hasOwnProperty( path ) )
                        {
                            delete fileData[ path ]
                        }

                        // remove the watcher
                        watcher.close()
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

                                        // cache new json
                                        fileData[ path ] = parseData.call( that, JSON.parse, fileContents )
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
                    queueLength: 5
                },

                opts || {}
            )

            this.data = {}
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

                                if ( fileData.hasOwnProperty( filePath ) )
                                {
                                    return fileDone( null, fileData[ filePath ] )
                                }

                                fs.readFile( filePath, function ( err, data )
                                    {
                                        if ( err )
                                        {
                                            return fileDone( err ) // error, file probably not found
                                        }

                                        var parsed = parseData.call( that, JSON.parse, data )

                                        // reference cache and watch file
                                        fileData[ filePath ] = parsed

                                        watchFile.call( that, filePath )

                                        fileDone( null, parsed )
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
