THREE.Vector2.prototype.multiplyScalarNewVec = function ( s ) {
		var vec = new THREE.Vector2(
		this.x * s,
		this.y * s);
		return vec;
}


BezierSurface = function () { //THREE.Vector2 array
	this.controlPoints = [ ];
}

BezierSurface.prototype = {
	
	BernsteinV: function (v, i) {
    var a, b, c, d, r;
		a = this.controlPoints[i][0].multiplyScalarNewVec(Math.pow((1-v),3));							//i=0 bc=1
		b = this.controlPoints[i][1].multiplyScalarNewVec(3*v*Math.pow((1-v),2));					//i=1 bc=3
		c = this.controlPoints[i][2].multiplyScalarNewVec(3*Math.pow(v,2)*(1-v));					//i=2 bc=3
		d = this.controlPoints[i][3].multiplyScalarNewVec(Math.pow(v,3));									//i=3 bc=1
    r = a.add(b.add(c.add(d)));
    return r;
	},
	BernsteinU: function(u, i) {
			var r;
			if (i==0) 
				r = Math.pow((1-u),3);							//i=0 bc=1
			 else if (i==1) 
				r = 3*u*Math.pow((1-u),2);					//i=1 bc=3
			 else if (i==2) 
				r = 3*Math.pow(u,2)*(1-u);					//i=2 bc=3
			 else if (i==3) 
				r = Math.pow(u,3);									//i=3 bc=1
			return r;
	},

	getSurfacePoint: function (u, v) {
		var p = new THREE.Vector2(0,0);
		for (var i=0; i<=3; i++) {
			var bu = this.BernsteinU(u, i);
			var bv = this.BernsteinV(v, i);
			bv.multiplyScalar(bu);
			p.add(bv);
		}
		return new THREE.Vector3(p.x, p.y, 0);
	}
};
