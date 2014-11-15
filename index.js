/*
  local-json v0.0.1
  copyright 2014 - kevin von flotow
  MIT license
*/
;( function ()
    {
        var fs = require( 'fs' )

        var path = require( 'path' )

        var Queue = require( 'nbqueue' )

        var deepExtend = require( 'deep-extend' )

        function noop(){}

        function readData( fn, file )
        {
            var add = {}

            // don't crash the server if the json is invalid
            try
            {
                add = fn( file )
            }

            catch ( e )
            {
                if ( this.logging )
                {
                    // bad json or not found
                    console.log( 'json error', e )
                }
            }

            return add
        }

        /** @constructor */
        function JsonReader( opts )
        {
            this.opts = deepExtend(
                {
                    // set true to enable updating json without restarting the server
                    dynamic: false,

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
        JsonReader.prototype.getDataSync = function ( strings )
        {
            if ( !Array.isArray( strings ) )
            {
                strings = [ strings ]
            }

            var files = []

            for ( var i = 0, l = strings.length; i < l; ++i )
            {
                var str = strings[ i ].toString()

                var filePath = path.join( __dirname, str + '.json' )

                if ( !this.opts.dynamic )
                {
                    file.push( readData.call( this, require, filePath ) )

                    continue
                }

                var data = fs.readFileSync( filePath, { encoding: 'utf8' } )

                files.push( readData.call( this, JSON.parse, data ) )
            }

            return deepExtend.apply( null, files )
        }

        // use async methods when in dynamic mode
        JsonReader.prototype.getData = function ( strings, callback )
        {
            callback = callback || noop

            if ( !Array.isArray( strings ) )
            {
                strings = [ strings ]
            }

            // allow 5 at a time
            var queue = new Queue( this.opts.queueLength )

            var that = this

            for ( var i = 0, l = strings.length; i < l; ++i )
            {
                var str = strings[ i ].toString()

                queue.add( function ( done )
                    {
                        var filePath = path.join( __dirname, str + '.json' )

                        if ( !that.opts.dynamic )
                        {
                            return done( null, readData.call( this, require, filePath ) )
                        }

                        fs.readFile( filePath, function ( err, data )
                            {
                                if ( err )
                                {
                                    return done( err ) // error, file probably not found
                                }

                                done( null, readData.call( this, JSON.parse, data ) )
                            }
                        )
                    }
                )
            }

            // finish up async queue
            queue.done( function ( err, data )
                {
                    callback( err, deepExtend.apply( null, data || [] ) )
                }
            )
        }

        module.exports = JsonReader
    }
)();
