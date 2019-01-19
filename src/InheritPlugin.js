/*
 * The MIT License (MIT)
 * Copyright (c) 2019. Wise Wild Web
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 *  @author : Nathanael Braun
 *  @contact : wpilabs@gmail.com
 */

/**
 * @author N.Braun
 */
var path              = require('path');
const isBuiltinModule = require('is-builtin-module');
var ExternalModule    = require('webpack/lib/ExternalModule');

const utils = require("./utils");
/**
 * Main wpi plugin
 *
 */

module.exports = function ( cfg, opts ) {
	let plugin;
	return plugin = {
		sassImporter: function () {
			return plugin._sassImporter(...arguments)
		},
		apply       : function ( compiler ) {
			var cache               = {}, plugin = this;
			var contextDependencies = [],
			    fileDependencies    = [];
			var roots               = opts.allRoots;
			var alias               = Object.keys(opts.extAliases || {}).map(
				( k ) => ([new RegExp(k), opts.extAliases[k]])),
			    internals           = [];
			
			function wpiResolve( data, cb ) {
				var vals,
				    requireOrigin = data.contextInfo.issuer,
				    tmpPath;
				
				for ( var i = 0; i < alias.length; i++ ) {
					if ( alias[i][0].test(data.request) ) {
						data.request = data.request.replace(alias[i][0], alias[i][1]);
						break;
					}
				}
				
				
				data.wpiOriginRrequest = data.request;
				
				
				// $map resolving...
				if ( (vals = data.request.match(
					/^\$map\(([^'"\),]+)(\s*,\s*([^'",\)]+))?(\s*,\s*([^'",\)]+))?(\s*,\s*([^'"\)]+))?\s*\)/)) ) {
					vals[2] = vals[2] && vals[2].replace(/^,\s*(.*)\s*$/, '$1') || '';
					
					
					return (/\.s?css$/.test(vals[2]) ? utils.indexOfScss : utils.indexOf)(
						compiler.inputFileSystem, roots, vals[1],
						vals[2]
							|| null,
						vals[2] && ctx,
						!!vals[3],
						contextDependencies,
						fileDependencies,
						function ( e, filePath, content ) {
							data.path    = '/';
							data.request = filePath;
							data.file    = true;
							cb(e, data, content);
						}
					)
				}
				
				var resolve = function ( e, filePath, content ) {
					    //console.log("find %s\t\t\t=> %s", data.request, filePath, e, cache[key]);
					    while ( cache[key].length )
						    cache[key].pop()(e, filePath, content);
					    cache[key] = filePath || true;
				    },
				    apply   = ( e, r, content ) => {
					    if ( e && !r ) return cb(null, data, content);
					    data.request = r;
					    data.file    = true;
					
					    cb(null, data, content);
				    },
				    key;
				
				// resolve inheritable relative
				if ( requireOrigin && /^\./.test(data.request) && (tmpPath = roots.find(r => path.resolve(path.dirname(requireOrigin) + '/' + data.request).startsWith(r))) ) {
					data.request = ("App" + path.resolve(path.dirname(requireOrigin) + '/' + data.request).substr(tmpPath.length)).replace('\\', '/');
				}
				
				key = data.context + '##' + data.request;
				
				if ( /^\$super$/.test(data.request) ) {
					// console.info(requireOrigin);
					// console.dir(data.dependencies);
					key = "$super<" + requireOrigin;
				}
				
				if ( cache[key] === true )
					return cb(null, data);
				
				
				if ( cache[key] instanceof Array ) {
					return cache[key].push(apply)
				}
				else if ( cache[key] ) {
					data.request = cache[key];
					data.file    = true;
					return cb(null, data)
				}
				// console.log("search %s", data.request, cache[key]);
				cache[key] = [apply];
				
				// $super resolving..
				if ( /^\$super$/.test(data.request) ) {
					return utils.findParent(
						compiler.inputFileSystem,
						roots,
						requireOrigin,
						function ( e, filePath, file ) {
							if ( e ) {
								console.warn("Parent not found for " + requireOrigin);
								return resolve(e, "", "/* Parent not found for " + requireOrigin + '*/\n');
							}
							
							resolve(null, filePath);
						}
					);
				}
				// Inheritable root based resolving
				if ( /^App/.test(data.request) ) {
					return utils.findParentPath(
						compiler.inputFileSystem,
						roots,
						data.request.replace(/^App/ig, ''),
						0,
						function ( e, filePath, file ) {
							if ( e ) {
								console.error("File not found \n'%s' (required in '%s')",
								              data.request, requireOrigin);
								return resolve(404)
							}
							resolve(null, filePath);
						}
					);
				}
				resolve(null, data.request);
			}
			
			this._sassImporter = function ( url, prev, cb ) {
				if ( /^(\$|App\/)/.test(url) ) {
					wpiResolve(
						{
							contextInfo: {
								issuer: prev
							},
							request    : url
						},
						function ( e, found, contents ) {
							if ( found || contents ) {
								//console.warn("Find plugin !!! ", url, found, contents);
								cb && cb(contents && { contents } || { file: found.request });
							}
							else {
								//if ( i + 1 < roots.length ) findFallBack(nm, roots, ctx, file, i + 1, cb);
								//else
								
								//console.warn("not found !!! ", url, found, e);
								cb && cb({ file: url });
							}
							
						}
					)
				}
				else return null;
			};
			
			compiler.plugin("normal-module-factory", function ( nmf ) {
				                nmf.plugin('factory', function ( factory ) {
					                return function ( data, callback ) {
						                let mkExt = isBuiltinModule(data.request)
							                || data.wpiOriginRrequest && isBuiltinModule(data.wpiOriginRrequest),
						                    //=
						                    ///^\./.test(data.request) && internals.find(p =>
						                    // data.context.startsWith(p)) ||  (opts.appInternal || []).find(p =>
						                    // data.request.startsWith(p)),
						                    found;
						                //if ( /toolbox/.test(data.request) )
						                //if ( data.wpiOriginRrequest && !root ) {
						
						                if ( !mkExt && opts.allCfg.find(
							                cfg => (
								                cfg.builds &&
								                cfg.builds[ctx] &&
								                cfg.builds[ctx].externals &&
								                cfg.builds[ctx].externals.find(mod => {
									                return data.wpiOriginRrequest.startsWith(found = mod)
									                //|| data.request.startsWith(found = mod);
								                })
								                //ModuleFilenameHelpers.matchObject(cfg.builds[ctx].internals,
								                // data.wpiOriginRrequest)
							                )
						                ) ) {
							                mkExt = true;//fallback.find(p => data.request.startsWith(p))||true;
							                //console.warn("ext!", mkExt + '/' + found, data.request)
						                }
						
						                //root && console.warn("int", data.request, data.wpiOriginRrequest)
						                //}
						                //mkExt && console.log("ext", data.request, data.context,
						                // data.wpiOriginRrequest)
						                if ( mkExt ) {
							                return callback(null, new ExternalModule(
								                data.wpiOriginRrequest || data.request,
								                //!/www/.test(ctx) ?
								                compiler.options.output.libraryTarget
								                //: "commonjs"
							                ));
							
						                }
						                else {
							                return factory(data, callback);
						                }
						
					                };
				                });
				                nmf.plugin("before-resolve", wpiResolve);
				
			                }
			);
			compiler.plugin('after-emit', ( compilation, cb ) => {
				// Add file dependencies if they're not already tracked
				fileDependencies.forEach(( file ) => {
					if ( compilation.fileDependencies.indexOf(file) == -1 ) {
						compilation.fileDependencies.push(file);
					}
				});
				
				// Add context dependencies if they're not already tracked
				contextDependencies.forEach(( context ) => {
					if ( compilation.contextDependencies.indexOf(context) == -1 ) {
						compilation.contextDependencies.push(context);
					}
				});
				contextDependencies = [];
				cb()
				cache = {};
			});
		}
	}
		;
}
;
