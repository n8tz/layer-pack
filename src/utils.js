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
 *  @contact : caipilabs@gmail.com
 */


var path = require("path"),
    fs   = require("fs"),
    cwd  = path.normalize(__dirname + '/..');

var walk                      = require('walk'),
    shortid                   = require('shortid'),
    fs                        = require('fs'),
    os                        = require('os');
var VirtualModulePlugin       = require('virtual-module-webpack-plugin');
var CommonJsRequireDependency = require("webpack/lib/dependencies/CommonJsRequireDependency");
var possible_ext              = [
	".js",
	".jsx",
	".json",
	"/index.js",
	"/index.scss",
	"/index.css",
	".scss",
	".css"
];
module.exports                = {
	getAllConfigs() {
		var projectRoot = process.cwd(),
		    pkgConfig   = fs.existsSync(path.normalize(projectRoot + "/package.json")) &&
			    JSON.parse(fs.readFileSync(path.normalize(projectRoot + "/package.json"))),
		    allCfg      = {};
		
		Object.keys(pkgConfig.wpInherit)
		      .forEach(
			      p => {
				      allCfg[p] = true;
				      allCfg[p] = this.getConfigByProfiles(projectRoot, pkgConfig.wpInherit[p], p, allCfg);
			      }
		      )
		return allCfg;
	},
	getConfigByProfiles( projectRoot, pkgConfig, profile ) {
		var extAliases     = {},
		    allModulePath  = [],
		    allExternals   = [],
		    allWebpackCfg  = [],
		    allModuleRoots = [],
		    allCfg         = [],
		    allModuleId    = [],
		    rootAlias      = pkgConfig.rootAlias || 'App',
		    rootDir        = pkgConfig.rootDir || './App',
		    /**
		     * Find & return all  inherited pkg paths
		     * @type {Array}
		     */
		    allExtPath     = (() => {
			    let list = [], seen = {};
			
			    pkgConfig.extend.forEach(function walk( p, i ) {
				    let where = fs.existsSync(path.normalize(projectRoot + "/libs/" + p))
				                ? "/libs/" :
				                "/node_modules/",
				        cfg   = fs.existsSync(path.normalize(projectRoot + where + p + "/package.json")) &&
					        JSON.parse(fs.readFileSync(path.normalize(projectRoot + where + p + "/package.json")))
				
				    if ( cfg.wpInherit && cfg.wpInherit[profile] && cfg.wpInherit[profile].extend )
					    cfg.wpInherit[profile].extend.forEach(walk)
				
				    list.push(path.normalize(projectRoot + where + p));
			    })
			
			
			    list.filter(e => (seen[e] ? true : (seen[e] = true, false)))
			    return list;
		    })(),
		    allRoots       = (function () {
			    var roots = [projectRoot + '/' + rootDir], libPath = [];
			
			    allModuleId.push(pkgConfig)
			    pkgConfig.libsPath
			    && fs.existsSync(path.normalize(projectRoot + "/" + pkgConfig.libsPath))
			    && libPath.push(path.normalize(projectRoot + "/" + pkgConfig.libsPath));
			
			    allModulePath.push(path.normalize(projectRoot + '/node_modules'));
			    allModuleRoots.push(projectRoot)
			    allExtPath.forEach(
				    function ( where ) {
					    let cfg = fs.existsSync(path.normalize(where + "/package.json")) &&
						    JSON.parse(fs.readFileSync(path.normalize(where + "/package.json")));
					
					    allModuleRoots.push(where)
					
					    cfg = cfg.wpInherit[profile];
					
					    if ( cfg && cfg.aliases )
						    extAliases = {
							    ...extAliases,
							    ...cfg.aliases
						    };
					    if ( cfg )
						    allCfg.push(cfg)
					    if ( cfg.config )
						    allWebpackCfg.push(where + '/' + cfg.config)
					
					    roots.push(fs.realpathSync(path.normalize(where + "/" + (cfg.rootDir || 'App'))));
					
					    cfg.libsPath &&
					    fs.existsSync(path.normalize(where + "/" + cfg.libsPath))
					    && libPath.push(
						    fs.realpathSync(path.normalize(where + "/" + cfg.libsPath)));
					
					    //console.log(path.normalize(where +
					    // "/node_modules"), fs.existsSync(path.normalize(projectRoot + where
					    // + p + "/node_modules")) && "yes")
					    fs.existsSync(path.normalize(where + "/node_modules"))
					    && allModulePath.push(
						    fs.realpathSync(path.normalize(where + "/node_modules")));
				    }
			    );
			    allModulePath = libPath.concat(allModulePath);
			    //roots.push(
			    //    path.normalize(cwd + '/' + rootDir)
			    //);
			    //allModulePath.push(path.normalize(cwd + '/node_modules'));
			
			    allModulePath = allModulePath.filter(fs.existsSync.bind(fs));
			    //allModulePath.push("node_modules")
			    return roots.map(path.normalize.bind(path));
		    })();
		allCfg.push(pkgConfig)
		return { allWebpackCfg, allModulePath, allRoots, allExtPath, extAliases, allModuleRoots, allCfg };
	},
	
	findParentPath( fs, roots, file, i, cb, _curExt, _ext ) {
		_ext    = _ext || '';
		var fn  = path.normalize(roots[i] + file + _ext);
		_curExt = _curExt || 0;
		// console.warn("check !!! ", fn, ei);
		fs.stat(fn, ( err, stats ) => {
			if ( stats && stats.isFile() ) {
				// console.warn("Find parent !!! ", fn);
				cb && cb(null, fn, fn.substr(roots[i].length + 1));
			}
			else {
				// console.warn("Not found !!! ", fn, ei);
				if ( possible_ext.length > _curExt ) {
					this.findParentPath(fs, roots, file, i, cb, _curExt + 1, possible_ext[_curExt])
				}
				else if ( i + 1 < roots.length ) {
					this.findParentPath(fs, roots, file, i + 1, cb, 0, '');
				}
				else {
					
					cb && cb(true);
				}
			}
			
		})
	},
	
	checkIfDir( fs, file, cb ) {
		fs.stat(file, function fsStat( err, stats ) {
			if ( err ) {
				if ( err.code === 'ENOENT' ) {
					return cb(null, false);
				}
				else {
					return cb(err);
				}
			}
			// console.dir(Object.keys(stats))
			return cb(null, stats.isDirectory());
		});
	},
	findParent( fs, roots, file, cb ) {
		var i = -1, tmp;
		while ( ++i < roots.length ) {
			tmp = file.substr(0, roots[i].length);
			if ( roots[i] == tmp ) {// found
				return (i != roots.length - 1) && this.findParentPath(fs, roots, file.substr(tmp.length), i + 1, cb);
			}
		}
		cb && cb(true);
	},
	indexOf( vfs, roots, dir, _fileMatch, ctx, contextual, contextDependencies, fileDependencies, cb ) {
		var sema        = 0,
		    files       = {},
		    lvls        = {},
		    fileMatch   = _fileMatch && (new RegExp(//file mask
		                                            "^" +
			                                            _fileMatch
				                                            .replace(/^,\s*(.*)\s*$/, '$1')
				                                            // .replace(/\.jsx?$/, '')
				                                            .replace(/\./ig, '\\.')
				                                            .replace(/\*\*/ig, '((*/)+)?*')
				                                            .replace(/\*/ig, '[^\\\\\\/]+')
			                                            + "$")),
		    seen        = 0,
		    done        = false,
		    code        = "export default  {};",
		    virtualFile = path.normalize(
			    path.join(roots[roots.length - 1], 'MapOf.' + dir.replace(/[^\w]/ig, '_') +
				    (_fileMatch || '*').replace(/\*/ig, '.W').replace(/[^\w\.]/ig, '_') +
				    '.gen.js'));
		
		sema++;
		
		dir = dir.replace(/\/$/, '').replace(/^App\//, '');
		roots.forEach(
			( _root, lvl ) => {
				var
					root = _root + '/' + dir;
				contextDependencies.push(path.join(_root, dir));
				
				sema++;
				// find all files resolvable in the passed namespace
				checkIfDir(
					vfs,
					root,
					( e, r ) => {
						if ( r ) {
							var walker = walk.walk(root);
							
							walker.on("file", function ( _root, fileStats, next ) {
								
								var fn      = path.normalize(path.join(_root, fileStats.name)),
								    keyTest = (fn).substr(root.length)
								                  // .replace(/\.jsx?$/, '')
								                  .replace(/\\/g, '/')// use /
								                  .replace(/^\//, ''),
								    key     = keyTest.replace(/\.jsx?$/, '');// rm js ext
								
								// fileMatch && console.log(fileMatch.test(keyTest), keyTest);
								
								if ( (!fileMatch || fileMatch.test(keyTest)) ) {
									if ( (lvls[key] || 1000) > lvl ) {
										files[key] = fn.replace(/(['"\\])/g, '\\$1');
										lvls[key]  = lvl + 1;
										fileDependencies.push(fn);
									}
								}
								next();
							});
							
							walker.on("directory", function ( _root, fileStats, next ) {
								contextDependencies.push(
									path.normalize(path.join(_root, fileStats.name)));
								next();
							});
							
							walker.on("errors", function ( root, nodeStatsArray, next ) {
								next();
							});
							
							walker.on("end", function () {
								if ( !(--seen) ) {
									var fkeys = [],
									    fpath = Object.keys(files).map(( k ) => (fkeys.push(k), files[k])),
									    code  = "var exp = {" +
										    fkeys.map(
											    ( module, i ) => {
												    let file = module.match(/^(.*)(?:\.([^\.]+))$/), mid = module;
												    return '"' + mid + '":require(\"App/' + dir + '/' + module +
													    '\")';
											    }
										    ).join(',\n')
										    + '};\n' +
										    'export default exp;';
									//console.log(code)
									// fs.writeFileSync(virtualFile, code);
									vfs.purge([virtualFile]);
									
									VirtualModulePlugin.populateFilesystem(
										{ fs: vfs, modulePath: virtualFile, contents: code, ctime: Date.now() });
									
									//VirtualModulePlugin.populateFilesystem(
									//    {
									//        fs         : vfs,
									//        modulePath : virtualFile + '.map',
									//        contents   : "",
									//        ctime      : Date.now()
									//    });
								}
								if ( !(--sema) ) {
									cb(null, virtualFile, code);
								}
							});
							seen++;
						}
						else if ( !(--sema) ) {
							// fs.writeFileSync(virtualFile, code);
							vfs.purge([virtualFile]);
							VirtualModulePlugin.populateFilesystem(
								{
									fs        : vfs,
									modulePath: virtualFile,
									contents  : "export default  {};",
									ctime     : Date.now()
								});
							VirtualModulePlugin.populateFilesystem(
								{ fs: vfs, modulePath: virtualFile + '.map', contents: "", ctime: Date.now() });
							cb(null, virtualFile, "module.export = {};");
						}
					}
				);
			}
		)
		if ( !(--sema) ) {
			
			// fs.writeFileSync(virtualFile, code);
			vfs.purge([virtualFile]);
			VirtualModulePlugin.populateFilesystem(
				{ fs: vfs, modulePath: virtualFile, contents: "module.export = {};", ctime: Date.now() });
			VirtualModulePlugin.populateFilesystem(
				{ fs: vfs, modulePath: virtualFile + '.map', contents: "", ctime: Date.now() });
			cb(null, virtualFile, "module.export = {};");
		}
		
		
	},
	indexOfScss( vfs, roots, dir, _fileMatch, ctx, contextual, contextDependencies, fileDependencies, cb ) {
		var sema        = 0,
		    files       = {},
		    lvls        = {},
		    fileMatch   = _fileMatch && (new RegExp(//file mask
		                                            "^" +
			                                            _fileMatch
				                                            .replace(/^,\s*(.*)\s*$/, '$1')
				                                            // .replace(/\.jsx?$/, '')
				                                            .replace(/\./ig, '\\.')
				                                            .replace(/\*\*/ig, '((*/)+)?*')
				                                            .replace(/\*/ig, '[^\\\\\\/]+')
			                                            + "$")),
		    seen        = 0,
		    done        = false,
		    virtualFile = path.normalize(
			    path.join(roots[roots.length - 1], 'MapOf.' + dir.replace(/[^\w]/ig, '_') +
				    (_fileMatch || '*').replace(/\*/ig, '.W').replace(/[^\w\.]/ig, '_') +
				    '.gen.scss')),
		    code        = "/* " + virtualFile + " */\n";
		
		sema++;
		
		dir = dir.replace(/\/$/, '').replace(/^App\//, '');
		roots.forEach(
			( _root, lvl ) => {
				var
					root = _root + '/' + dir;
				contextDependencies.push(path.join(_root, dir));
				
				sema++;
				// find all files resolvable in the passed namespace
				checkIfDir(
					vfs,
					root,
					( e, r ) => {
						if ( r ) {
							var walker = walk.walk(root);
							
							walker.on("file", function ( _root, fileStats, next ) {
								
								var fn      = path.normalize(path.join(_root, fileStats.name)),
								    keyTest = (fn).substr(root.length)
								                  // .replace(/\.jsx?$/, '')
								                  .replace(/\\/g, '/')// use /
								                  .replace(/^\//, ''),
								    key     = keyTest.replace(/\.jsx?$/, '');// rm js ext
								
								// fileMatch && console.log(fileMatch.test(keyTest), keyTest);
								
								if ( (!fileMatch || fileMatch.test(keyTest)) ) {
									if ( (lvls[key] || 1000) > lvl ) {
										files[key] = fn.replace(/(['"\\])/g, '\\$1');
										lvls[key]  = lvl + 1;
										fileDependencies.push(fn);
									}
								}
								next();
							});
							
							walker.on("directory", function ( _root, fileStats, next ) {
								contextDependencies.push(
									path.normalize(path.join(_root, fileStats.name)));
								next();
							});
							
							walker.on("errors", function ( root, nodeStatsArray, next ) {
								next();
							});
							
							walker.on("end", function () {
								if ( !(--seen) ) {
									var fkeys = [],
									    fpath = Object.keys(files).map(( k ) => (fkeys.push(k), files[k]));
									code      = "" +
										fkeys.map(
											( module, i ) => {
												return '@import "App/' + dir + '/' + module + '\";';
											}
										).join('\n')
										+ '\n';
									//console.log(code)
									// fs.writeFileSync(virtualFile, code);
									vfs.purge([virtualFile]);
									
									VirtualModulePlugin.populateFilesystem(
										{ fs: vfs, modulePath: virtualFile, contents: code, ctime: Date.now() });
									
									//VirtualModulePlugin.populateFilesystem(
									//    {
									//        fs         : vfs,
									//        modulePath : virtualFile + '.map',
									//        contents   : "",
									//        ctime      : Date.now()
									//    });
								}
								if ( !(--sema) ) {
									cb(null, virtualFile, code);
								}
							});
							seen++;
						}
						else if ( !(--sema) ) {
							// fs.writeFileSync(virtualFile, code);
							vfs.purge([virtualFile]);
							VirtualModulePlugin.populateFilesystem(
								{
									fs        : vfs,
									modulePath: virtualFile,
									contents  : code,
									ctime     : Date.now()
								});
							VirtualModulePlugin.populateFilesystem(
								{ fs: vfs, modulePath: virtualFile + '.map', contents: "", ctime: Date.now() });
							cb(null, virtualFile, code);
						}
					}
				);
			}
		)
		if ( !(--sema) ) {
			
			// fs.writeFileSync(virtualFile, code);
			vfs.purge([virtualFile]);
			VirtualModulePlugin.populateFilesystem(
				{ fs: vfs, modulePath: virtualFile, contents: "module.export = {};", ctime: Date.now() });
			VirtualModulePlugin.populateFilesystem(
				{ fs: vfs, modulePath: virtualFile + '.map', contents: "", ctime: Date.now() });
			cb(null, virtualFile, "module.export = {};");
		}
		
		
	}
	
}