/*
* Canvas Team Draw
* Copyright (c) 2013 Licson (http://licson.net/)
*
* This is released under the MIT License
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
* 
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
* 
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
*/


(function (window) {
	var socket = {};
	if (typeof io !== 'undefined' && io) {
		socket = io.connect();
	} else {
		socket = {
			emit: function () {
				console.log(arguments);
			},
			on: function () {
				console.log(arguments);
			}
		};
	}

	var Paint = function () {
		var self = this;

		// Sessions
		this.sess_id = '';

		// Prepare our canvas
		this.canvaso = $('#imageView')[0];
		this.canvas = $('<canvas id="imageTemp">')[0];
		this.ctxo = this.canvaso.getContext('2d');
		this.ctx = this.canvas.getContext('2d');
		$(this.canvaso).parent().append(this.canvas);

		this.setSize = function (w, h) {
			this.canvaso.width = w;
			this.canvaso.height = h;
			this.canvas.width = w;
			this.canvas.height = h;
		}

		this.setSize(window.innerWidth, window.innerHeight - 50);

		// Tools
		this.tools = {};
		this.currentTool = 'pencil';
		this.toolSelect = $('#dtool');
		this.toolSelect.change(function () {
			self.currentTool = $(this).val();
		});
		this.toolSelect.val(this.currentTool);
		this.addTool = function (name, tool) {
			this.tools[name] = new tool();
		};

		// Handles updates
		this.update = function () {
			socket.emit('update', {
				type: self.currentTool,
				data: self.tools[self.currentTool].data
			});
			self.ctxo.drawImage(this.canvas, 0, 0);
			self.ctx.clearRect(0, 0, self.canvas.width, self.canvas.height);
		};

		// Attach the event handler to our canvas
		this.handler = function (e) {
			if (/^touch(start|move|end)/i.test(e.type)) {
				e.preventDefault();
				if (e.type !== "touchend") {
					e._x = e.originalEvent.touches[0].clientX;
					e._y = e.originalEvent.touches[0].clientY;
				}
				e.type = e.type.replace('touch', 'mouse').replace('start', 'down').replace('end', 'up');
			} else {
				e._x = e.pageX;
				e._y = e.pageY;
			}

			// Call the event handler of the tool.
			self.tools[self.currentTool][e.type](e);

			// Send update immediately
			if (self.tools[self.currentTool].started) {
				self.update();
			}
		}

		this.toNormalizedCoords = function(coords){
			var hw = self.canvaso.width / 2;
			var hh = self.canvaso.height / 2;
			return [-(hw - coords[0]), hh - coords[1]];
		}

		this.toAbsoluteCoords = function(coords){
			var hw = self.canvaso.width / 2;
			var hh = self.canvaso.height / 2;
			return [hw + coords[0], hh - coords[1]];
		}

		$(this.canvas).on('mousedown touchstart', this.handler);
		$(this.canvas).on('mousemove touchmove', this.handler);
		$(this.canvas).on('mouseup touchend', this.handler);

		// Handle our UI
		if (window.location.hash.substr(1) != '') {
			socket.emit('join_session', window.location.hash.substr(1));
		} else {
			$('#startup').modal();
		}

		$('#joinroom').click(function () {
			socket.emit('join_session');
			$('#startup').modal('hide');
		});

		$('#createroom').click(function () {
			socket.emit('create_session');
			$('#startup').modal('hide');
		});

		$('#clear').click(function (e) {
			e.preventDefault();
			self.ctxo.clearRect(0, 0, self.canvaso.width, self.canvaso.height);
			socket.emit('clear');
		});

		// Handle data from the server
		socket.on('session_created', function (id) {
			this.sess_id = id;
			window.location.hash = '#' + this.sess_id;
			$('#share').modal();
		});
		socket.on('new_user', function (id) {
			$('#user_joined .user').text(id);
			$('#user_joined').fadeIn(500).delay(2000).fadeOut(500);
		});
		socket.on('update', function (data) {
			self.tools[data.type].render(data.data);
		});
		socket.on('clear', function (id) {
			self.ctxo.clearRect(0, 0, self.canvaso.width, self.canvaso.height);
			$('#user_cleared .user').text(id);
			$('#user_cleared').fadeIn(500).delay(2000).fadeOut(500);
		});
	};
	// Expose to the global
	window.Paint = Paint;
})(window);

$(function () {
	window.App = new Paint();

	$(window).on('resize', function () {
		App.setSize(window.innerWidth, window.innerHeight - 50);
	});

	App.addTool('pencil', function () {
		var tool = this;
		this.started = false;
		this.data = [];
		this.mousedown = function (e) {
			if (tool.data.length > 0) {
				tool.data = [];
			}
			App.ctx.beginPath();
			App.ctx.moveTo(e._x, e._y);
			tool.data.push(App.toNormalizedCoords([e._x, e._y]));
			tool.started = true;
		};

		this.mousemove = function (e) {
			if (tool.data.length > 500) {
				tool.data = [];
			}

			if (tool.started) {
				App.ctx.lineTo(e._x, e._y);
				tool.data.push(App.toNormalizedCoords([e._x, e._y]));
				App.ctx.stroke();
			}
			else {
				tool.data = [];
			}
		};

		this.mouseup = function (e) {
			if (tool.started) {
				tool.started = false;
			}
		};

		this.render = function (data) {
			App.ctxo.beginPath();
			var first = App.toAbsoluteCoords(data.shift());
			App.ctxo.moveTo(first[0], first[1]);
			for (var i = 0; i < data.length; i++) {
				var point = App.toAbsoluteCoords(data[i]);
				App.ctxo.lineTo(point[0], point[1]);
			}
			App.ctxo.stroke();
		}
	});

	App.addTool('eraser', function () {
		var tool = this;
		this.data = [];
		this.size = 20;
		this.started = false;
		this.mousedown = function (e) {
			if (tool.data.length > 0) {
				tool.data = [];
			}
			tool.started = true;
			tool.data.push(App.toNormalizedCoords([e._x - tool.size / 2, e._y - tool.size / 2]));
			App.ctxo.clearRect(e._x - tool.size / 2, e._y - tool.size / 2, tool.size, tool.size);
		};

		this.mousemove = function (e) {
			if (!tool.started) {
				tool.data = [];
				App.ctx.clearRect(0, 0, App.canvas.width, App.canvas.height);
				return;
			}

			if (tool.data.length > 500) {
				tool.data = [];
			}

			tool.data.push(App.toNormalizedCoords([e._x - tool.size / 2, e._y - tool.size / 2]));
			App.ctxo.clearRect(e._x - tool.size / 2, e._y - tool.size / 2, tool.size, tool.size);
			App.ctx.clearRect(0, 0, App.canvas.width, App.canvas.height);
		};

		this.mouseup = function (e) {
			if (tool.started) {
				tool.started = false;
			}
			App.ctx.clearRect(0, 0, App.canvas.width, App.canvas.height);
		};

		this.render = function (data) {
			App.ctxo.beginPath();
			var first = App.toAbsoluteCoords(data.shift());
			App.ctxo.clearRect(first[0], first[1], tool.size, tool.size);
			for (var i = 0; i < data.length; i++) {
				var point = App.toAbsoluteCoords(data[i]);
				App.ctxo.clearRect(point[0], point[1], tool.size, tool.size);
			}
		}
	});
});
