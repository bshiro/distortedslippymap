//-------------------------------------------------------------------------------------------
//my custom map object
	myObject = function () {
		this.screenCoords = [];
		this.mercatorCoords = [];
	}
	myObject.prototype = {
		initScreenCoords: function(src) {
			this.screenCoords = src.slice(0);
		},
		initMercatorCoords: function(src) {
			this.mercatorCoords = src.slice(0);
		},
		mercator2screen: function (projection) {
			for (var i=0; i<this.mercatorCoords.length; i++) {
				this.screenCoords[i] = projection(this.mercatorCoords[i]);
			}
		},
		screen2mercator: function (projection) {
			for (var i=0; i<this.screenCoords.length; i++) {
				this.mercatorCoords[i] = projection.invert(this.screenCoords[i]);
			}
		}
	};

//-------------------------------------------------------------------------------------------
//three to d3 interface functions

	// these are, as before, to make D3's .append() and .selectAll() work
	THREE.Object3D.prototype.appendChild = function (c) { this.add(c); return c; };
	THREE.Object3D.prototype.querySelectorAll = function () { return []; };
	// this one is to use D3's .attr() on THREE's objects
	THREE.Object3D.prototype.setAttribute = function (name, value) {
		var chain = name.split('.');
		var object = this;
		for (var i = 0; i < chain.length - 1; i++) {
			object = object[chain[i]];
		}
		object[chain[chain.length - 1]] = value;
	}
//-------------------------------------------------------------------------------------------
//Camera, canvas settings		
	var width = 960;
	var height = 500;

	var projection, zoom;
	var tile = d3.geo.tile()
		.size([width, height])

	// create a scene, that will hold all our elements such as objects, cameras and lights.
	var scene = new THREE.Scene();
	// create a camera, which defines where we're looking at.
	var camera = new THREE.OrthographicCamera(0,width, 0, height, 1, 1000);  //flipped y axis
	// position and point the camera to the center of the scene
	camera.position.set(0, 0, 250);
	camera.lookAt(new THREE.Vector3( 0, 0, 0 ));
	
	// create a renderer and set the size
	var renderer = new THREE.WebGLRenderer({ antialias: true });
	$("#gldiv").append(renderer.domElement);
	$("canvas").attr("id", "glcanvas");
	$("canvas").attr("class", "framed");
	var glcanvas = d3.select("#glcanvas");
	renderer.setClearColor(new THREE.Color(0xEEEEEE));
	renderer.setSize(width, height);
//-------------------------------------------------------------------------------------------
	
//predefined geometry and other variables
	var tileNodeGroup = new THREE.Object3D();
	scene.add( tileNodeGroup );
	var stationNodeGroup = new THREE.Object3D();
	scene.add( stationNodeGroup );				
	var boundaryNodeGroup = new THREE.Object3D();
	scene.add( boundaryNodeGroup );			
	var metroLineNodeGroup = new THREE.Object3D();
	scene.add( metroLineNodeGroup );	
	var bezierPatchNodeGroup = new THREE.Object3D();
	scene.add( bezierPatchNodeGroup );
	var octContainer = new THREE.Object3D();
	scene.add( octContainer );		
	
  //var sphereGeometry = new THREE.SphereGeometry(5,20,20);
	var circleGeometry = new THREE.CircleGeometry( 5, 20 );	
	var circleGeometryW = new THREE.CircleGeometry( 3, 20 );	
	
	var yellowMaterial = new THREE.MeshBasicMaterial({color: 0xFFFF00, wireframe: false});
	var redMaterial = new THREE.MeshBasicMaterial({color: 0x7D0000, wireframe: false, side: THREE.DoubleSide});
	var blueMaterial = new THREE.MeshBasicMaterial({color: 0x2447B2, wireframe: false});
	//var boundaryMaterial = new THREE.LineBasicMaterial({ opacity: 1.0, linewidth: 5,  color: 0x2447B2 });
	var boundaryMaterial = new THREE.MeshBasicMaterial({color: 0x2447B2, side: THREE.DoubleSide, wireframe: false, transparent: false, opacity: 1});
	var whiteMaterial = new THREE.MeshBasicMaterial({color: 0xFFFFFF, wireframe: false, side: THREE.DoubleSide});
	var blackMaterial = new THREE.MeshBasicMaterial({color: 0x000000, wireframe: false, side: THREE.DoubleSide});
	
	var gstations,goctStations, goctStationsW;
	var boundaryCoords, octCoords;
	var stationArray = [];
	var metroLineFeatures;
	var bezierSurfaceArray = [];
	var myAffineDeformation;

	var patchsize = 256;
	var gridsize = 256/3;


	render();
//-------------------------------------------------------------------------------------------
//load data	
	queue()
		.defer(d3.json, 'data/octlisbonmercator.geojson') // octilinearly aligned station points
		.defer(d3.json, 'data/lisbon-stations.geojson') // station points
		.defer(d3.json, 'data/lisbon-boundary.geojson') // boundary points
		.defer(d3.json, 'data/lisbon-edge.json') // edges
		.await(makeMyMap); // function that uses files

//-------------------------------------------------------------------------------------------
//functions
	function linePathGeom(verts, linewidth)
	{
		var geom = new THREE.Geometry()
		for (var i=0; i<verts.length-1; i++)
		{
			var segment = new THREE.LineCurve3(verts[i],verts[i+1]);
			var segmentGeom =  new THREE.TubeGeometry(segment, 1, linewidth, 5, false);
			geom.merge(segmentGeom);
		}
		return geom;
	}


	function makeMyMap(error, a, b, c, d) {

		boundaryCoords = c.features[0].geometry.coordinates[0];
		octCoords = a.coordinates;
		var metrolines = d;
		var metrostations = b;
		var bounds = getBoundingBox(boundaryCoords);
		
		//compute model scale
		projection = d3.geo.mercator()
			.scale(1 / 2 / Math.PI)
			.translate([0, 0]);
		var pbounds = [projection(bounds[0]), projection(bounds[1])];
		var modelscale = 0.9 / Math.max((pbounds[1][0] - pbounds[0][0]) / width, (pbounds[1][1] - pbounds[0][1]) / -height);
	
		//zoom to model bounding box
		projection
			.scale(modelscale / 2 / Math.PI)
			.translate([width / 2, height / 2]);

		var centroid = [(bounds[0][0]+bounds[1][0])/2, (bounds[0][1]+bounds[1][1])/2];
		var center = projection(centroid);

		zoom = d3.behavior.zoom()
			.scale(projection.scale() * 2 * Math.PI)
			.scaleExtent([1 << 18, 1 << 23])
			.translate([width - center[0], height - center[1]])
			.on("zoom", zoomed);

		/*gstations = d3.select( stationNodeGroup ).selectAll("stations")
			.data(b.features)
			.enter().append( function() { return new THREE.Mesh( circleGeometry, yellowMaterial ); } )
			.attr("position.x", function(d) { return projection(d.geometry.coordinates)[0];})
			.attr("position.y", function(d) { return projection(d.geometry.coordinates)[1];})
			.attr("rotation.x", Math.PI/2)*/

		//parse json and populate metro lines array
		metroLineFeatures = [];
		for(var i=0; i<metrolines.length; i++)
		{
			var  lineCoords = [];
			var  octlineCoords = [];
			for(var j=0; j<metrolines[i].edges.length; j++) {		
				lineCoords.push(metrostations.features[metrolines[i].edges[j][0]-1].geometry.coordinates);
				octlineCoords.push(octCoords[metrolines[i].edges[j][0]-1]);
			}
			lineCoords.push(metrostations.features[metrolines[i].edges[j-1][1]-1].geometry.coordinates);
			octlineCoords.push(octCoords[metrolines[i].edges[j-1][1]-1]);
			var feature =	{	"geometry": {"type": "LineString", "coordinates": lineCoords},
													"octgeometry": {"type": "LineString", "coordinates": octlineCoords},
													"type": "Feature", "properties": {"lineID": i+1, "color": parseInt(metrolines[i].color) } };
			metroLineFeatures.push(feature);
		}
		
		var originalstations = new Array();
		var distortedstations = new Array();
		for (var i=0,  tot=metrostations.features.length; i < tot; i++) {
			originalstations.push(new ImgWarper.Point(metrostations.features[i].geometry.coordinates[0], metrostations.features[i].geometry.coordinates[1]));
			distortedstations.push(new ImgWarper.Point(a.coordinates[i][0], a.coordinates[i][1]));
		}
		
		var octObject = new myObject();
		octObject.initMercatorCoords(a.coordinates);
		goctStations = d3.select( octContainer ).selectAll("octpoints")
			.data(octObject.mercatorCoords)
			.enter().append( function() { return new THREE.Mesh( circleGeometry, blackMaterial ); } )
			.attr("position.x", function(d) { return projection(d)[0];})
			.attr("position.y", function(d) { return projection(d)[1];})
			.attr("position.z", -1)
			.attr("rotation.x", 0)
			
		goctStationsW = d3.select( octContainer ).selectAll("octpointsW")
			.data(octObject.mercatorCoords)
			.enter().append( function() { return new THREE.Mesh( circleGeometryW, whiteMaterial ); } )
			.attr("position.x", function(d) { return projection(d)[0];})
			.attr("position.y", function(d) { return projection(d)[1];})
			.attr("rotation.x", 0)	
			

		myAffineDeformation = new ImgWarper.AffineDeformation(distortedstations, originalstations, 1.5);
			
		glcanvas.call(zoom);
		zoomed();
	}

	function zoomed() {
		//compute visible tiles
		var tiles = tile.scale(zoom.scale())
			.translate(zoom.translate())
			();
	
		//update projection
		projection.scale(zoom.scale() / 2 / Math.PI)
			.translate(zoom.translate());
			
		goctStations.attr("position.x", function(d) { return projection(d)[0];})
			.attr("position.y", function(d) { return projection(d)[1];})

		goctStationsW.attr("position.x", function(d) { return projection(d)[0];})
			.attr("position.y", function(d) { return projection(d)[1];})
			
	
		cleanup(bezierPatchNodeGroup, true);
		for (var i=0; i<tiles.length; i++) {
			var d = tiles[i];
			var zs = tiles.scale/patchsize;			//scale in terms of patchsize unit
			var zt = [tiles.scale*(tiles.translate[0]+d[0]), tiles.scale*(tiles.translate[1]+d[1])];		//translate in terms of scaled patchsize unit
			
			//populate bezier surface control points
			var bzs = new BezierSurface();
			for (var j=0; j<4; j++) {
				var col = [];
				for (var k=0; k<4; k++) {
					var mercatorCoord = projection.invert(transform2D(zs, zt, [(j*gridsize),(k*gridsize)] ));
					var screenCoord = projection(myAffineDeformation.pointMover_2Darray(mercatorCoord));
					col.push(new THREE.Vector2(screenCoord[0], screenCoord[1]));
				}
				bzs.controlPoints.push(col);
			}

			getSurfacePoint = function(u, v) {
						return bzs.getSurfacePoint(u, v);	};
			var bzgeometry = new THREE.ParametricGeometry( getSurfacePoint, 10, 10 );
			//var map = THREE.ImageUtils.loadTexture( "http://" + ["a", "b", "c"][Math.random() * 3 | 0] + ".tile.openstreetmap.org/" + d[2] + "/" + d[0] + "/" + d[1] + ".png");
			var textureLoader = new THREE.TextureLoader();
			textureLoader.crossOrigin="anonymous";
			var map = textureLoader.load( "http://" + ["a", "b", "c"][Math.random() * 3 | 0] + ".tile.openstreetmap.org/" + d[2] + "/" + d[0] + "/" + d[1] + ".png");
			map.flipY = false;			
			var bzmaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1, map: map, side: THREE.DoubleSide, wireframe: false}); 
			var bzobject = new THREE.Mesh( bzgeometry, bzmaterial );
			bezierPatchNodeGroup.add(bzobject);
			
			//wireframe render
			var bzwirematerial = new THREE.MeshBasicMaterial({color: 0xA2A2A2, side: THREE.DoubleSide, wireframe: true, transparent: true, opacity: 0.1}); 
			var bzwireobject = new THREE.Mesh( bzgeometry, bzwirematerial );	
			bezierPatchNodeGroup.add(bzwireobject);
		} //end loop: tiles
		bezierPatchNodeGroup.position.set(0,0,-7);
		cleanup(boundaryNodeGroup);
		//var boundaryGeometry = coords2geometry(boundaryCoords, myAffineDeformation);
		//var boundaryObject = new THREE.Line(boundaryGeometry, boundaryMaterial);
		var boundaryGeometry = linePathGeom(coords2geometry(boundaryCoords, myAffineDeformation).vertices, 2);
		var boundaryObject = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
		boundaryNodeGroup.add(boundaryObject);		
		
		cleanup(metroLineNodeGroup);
		/*
		//WEBGL does not render linewidth correctly
		for (var i=0; i<metroLineFeatures.length; i++) {
			var metrolinegeom = coords2geometry(metroLineFeatures[i].octgeometry.coordinates)
			var metrolinematerial = new THREE.LineBasicMaterial({ color: metroLineFeatures[i].properties.color, opacity: 1, linewidth: 3 });
			var metrolineobject = new THREE.Line(metrolinegeom, metrolinematerial);
			metroLineNodeGroup.add(metrolineobject);
		}*/
		for (var i=0; i<metroLineFeatures.length; i++) {
			var verts = coords2geometry(metroLineFeatures[i].octgeometry.coordinates).vertices;
			var linewidth = 2.5;
			var metrolinematerial = new THREE.MeshBasicMaterial({color: metroLineFeatures[i].properties.color, side: THREE.DoubleSide, wireframe: false, transparent: false, opacity: 1});
			var metrogeom = linePathGeom(verts, linewidth);
			var metrolineobject = new THREE.Mesh(metrogeom, metrolinematerial);
			metroLineNodeGroup.add(metrolineobject);
		}



		metroLineNodeGroup.position.set(0,0,-1);
	}//end func: zoomed
	function transform2D(s, t, p) {
		return [s*p[0]+t[0], s*p[1]+t[1]];
	}
	function render() {
		// render using requestAnimationFrame
		requestAnimationFrame(render);
		renderer.render(scene, camera);
	}
	function getCentroid(jsonfeatures) {
		var centroid = [0.0, 0.0];
		for (key in jsonfeatures) {
				var point = jsonfeatures[key].geometry.coordinates;
				centroid[0] += point[0];
				centroid[1] += point[1];
		}
		var length = jsonfeatures.length;
		centroid[0] /= length;
		centroid[1] /= length;				
		return centroid;
	}
	function getBoundingBox(coords) {
		var bounds = [[Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY], [Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY] ];
		for(var i=0; i<coords.length; i++)
		{
				bounds[0][0] = bounds[0][0]<coords[i][0] ? bounds[0][0] : coords[i][0];
				bounds[0][1] = bounds[0][1]<coords[i][1] ? bounds[0][1] : coords[i][1];
				bounds[1][0] = bounds[1][0]>coords[i][0] ? bounds[1][0] : coords[i][0];
				bounds[1][1] = bounds[1][1]>coords[i][1] ? bounds[1][1] : coords[i][1];
		}			
		return bounds;
	}
	function cleanup(objectNode, hasTexture)	{
		hasTexture = hasTexture || false;
		while (objectNode.children.length>0) {
			var obj = objectNode.children[0];
			objectNode.remove(obj);
			obj.geometry.dispose;
			if (hasTexture)
				obj.material.dispose;
		}	
	}
	function coords2geometry(coords, affineDeformation) {
		affineDeformation = affineDeformation || null;
		var geometry = new THREE.Geometry();
		for (var i=0; i<coords.length; i++) {
			var point = coords[i];
			if (affineDeformation)
				point = affineDeformation.pointMover_2Darray(coords[i]);
			var screenCoord = projection(point);
			geometry.vertices.push(new THREE.Vector3(screenCoord[0],screenCoord[1], -5));
    	}
		return geometry;
	}
