var debugText = [];
var debugHistory = 15;


function wcsSolution() {
		this.equinox = 0;	
}
	
wcsSolution.prototype.init = function(data){
	this.equinox = data.equinox;
	this.x_ref = data.x_ref;
	this.y_ref = data.y_ref;
	this.ra = data.ra;
	this.dec = data.dec;
	this.CD_1_1 = data.CD_1_1;
	this.CD_1_2 = data.CD_1_2;
	this.CD_2_1 = data.CD_2_1;
	this.CD_2_2 = data.CD_2_2;
}

wcsSolution.prototype.toString = function(){
	outStr = "RA: " + this.ra + " DEC: " + this.dec;
	return outStr;
}
	
wcsSolution.prototype.pixelToWorld = function(x, y) {
	abs_x = x - this.x_ref;
	abs_y = y - this.y_ref;
	world_x = this.CD_1_1 * abs_x + this.CD_1_2 * abs_y;
	world_y = this.CD_2_1 * abs_x + this.CD_2_2 * abs_y;
	world_x = world_x + this.ra
	world_y = world_y + this.dec
	worldCoord = {wx: world_x, wy: world_y}
		
	return worldCoord;
}
	
	
	
	
function degToSexString(angle) {
		degrees = Math.floor(angle);
		remainder = angle - degrees;
		minutes = Math.floor(remainder * 60);
		seconds = ((remainder * 60) - minutes) * 60;
		
		outStr = $.format.number(degrees, '00') + ":" + $.format.number(minutes,'00') + ":" + $.format.number(seconds, '00.000');
		
		return outStr;
	}
	

function distance(x1, y1, x2, y2) {
		return Math.sqrt( (x1-x2)*(x1-x2) + (y1-y2)*(y1-y2) )
	}
	
function debug(debugString) {
	if (debugText.length>debugHistory) {
		debugText.shift();
	}
	
	dateString = formatTime(new Date());
	
	debugText.push(String(dateString + " : " + debugString));
	
	debugHTML = "";
	for (i in debugText) {
		debugHTML+= debugText[i] + "<br/>";		
	}
	
	$('#debugPanel').html(debugHTML);
}

function formatTime(date) {
	var hours;
	var minutes;
	var seconds;
	var millis;
	var timeString;
	
	hours = date.getHours();
 	minutes = date.getMinutes();
	seconds = date.getSeconds();
	millis = date.getMilliseconds();
	
	if (hours<10) hours = "0" + hours;
	if (seconds<10) seconds = "0" + seconds;
	if (minutes<10) minutes = "0" + minutes;
	if (millis<100) millis = "0" + millis;
	if (millis<10) millis = "0" + millis;
	
	timeString = hours + ":" + minutes + ":" + seconds + "." + millis;
	return timeString;
}

function zfill(num, len) {
	return (Array(len).join("0") + num).slice(-len);}

